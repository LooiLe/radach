import { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import { useSearchParams } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useApi } from '../hooks/useApi'
import SpotCard from '../components/SpotCard'
import RatingModeSelector from '../components/RatingModeSelector'
import './SpotsPage.css'

let dynamicIconMap = {
  restaurant: '/icons/material-symbols-light--chef-hat-outline.svg',
  bar: '/icons/guidance--bar.svg',
  hotel: '/icons/material-symbols-light--bed-outline-rounded.svg',
  accommodations: '/icons/material-symbols-light--bed-outline-rounded.svg',
  cafe: '/icons/carbon--cafe.svg',
  café: '/icons/carbon--cafe.svg',
  'food hall': '/icons/material-symbols-light--chef-hat-outline.svg',
  beach: '/icons/fluent--beach-48-regular.svg',
  market: '/icons/healthicons--market-stall-outline.svg',
  activity: '/icons/material-symbols-light--attractions-outline-rounded.svg',
  activities: '/icons/material-symbols-light--attractions-outline-rounded.svg',
  attraction: '/icons/material-symbols-light--attractions-outline-rounded.svg',
  attractions: '/icons/material-symbols-light--attractions-outline-rounded.svg',
  viewpoints: '/icons/material-symbols-light--mountain-flag-outline.svg',
  viewpoint: '/icons/material-symbols-light--mountain-flag-outline.svg',
  child: '/icons/material-symbols-light--child-hat-outline.svg',
  children: '/icons/material-symbols-light--child-hat-outline.svg',
  others: '/icons/stash--pin-location-light.svg',
  default: '/icons/stash--pin-location-light.svg',
}

function createMarkerIcon(type, hasActiveEvent) {
  const normalized = (type || '').toString().trim().toLowerCase().replace('é', 'e')
  const icon = dynamicIconMap[normalized] || dynamicIconMap.default
  const markerClass = hasActiveEvent ? 'custom-map-marker has-active-event' : 'custom-map-marker'
  return new L.DivIcon({
    html: `<div class="${markerClass}">
             <img src="${icon}" alt="${type || 'Spot'}" />
             ${hasActiveEvent ? '<span class="marker-live-badge"></span>' : ''}
           </div>`,
    className: 'custom-leaflet-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  })
}

const targetIcon = new L.DivIcon({
  html: '<div class="custom-map-marker target-map-marker"><img src="/icons/stash--pin-location-light.svg" alt="Target" /></div>',
  className: 'custom-leaflet-marker target-leaflet-marker',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -28],
})

import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster'

function MarkerClusterGroup({ spots, createIcon }) {
  const map = useMap()
  const spotClusterGroupRef = useRef(null)

  useEffect(() => {
    if (!spotClusterGroupRef.current) {
      spotClusterGroupRef.current = L.markerClusterGroup({
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        maxClusterRadius: 50,
      })
    }
    const spotClusterGroup = spotClusterGroupRef.current
    map.addLayer(spotClusterGroup)
    return () => { map.removeLayer(spotClusterGroup) }
  }, [map])

  useEffect(() => {
    const spotClusterGroup = spotClusterGroupRef.current
    if (!spotClusterGroup) return
    spotClusterGroup.clearLayers()
    spots.forEach(s => {
      const marker = L.marker([s.latitude, s.longitude], { icon: createIcon(s.type, s.hasActiveEvent) })
      const popupHtml = document.createElement('div')
      popupHtml.innerHTML = `
        <strong>${s.name}</strong><br />
        <span style="color: var(--star);">${s.averageRating > 0 ? '★ ' + s.averageRating.toFixed(1) : 'No ratings'}</span><br />
        ${s.type}<br />
        ${s.hasActiveEvent ? '<div style="margin-top: 0.25rem; font-size: 0.75rem; color: #ef4444; font-weight: 600;">📅 EVENT TODAY</div>' : ''}
      `
      marker.bindPopup(popupHtml)
      spotClusterGroup.addLayer(marker)
    })
  }, [spots, createIcon])
  return null
}

function MapViewportLoader({ onViewportChange, onMapReady }) {
  const debounceTimer = useRef(null)
  const initialLoadDone = useRef(false)
  const map = useMapEvents({
    moveend: () => { clearTimeout(debounceTimer.current); debounceTimer.current = setTimeout(() => onViewportChange(map), 400) },
    zoomend: () => { clearTimeout(debounceTimer.current); debounceTimer.current = setTimeout(() => onViewportChange(map), 400) },
  })
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true
      const timer = setTimeout(() => onViewportChange(map), 200)
      if (onMapReady) onMapReady(map)
      return () => { clearTimeout(timer); clearTimeout(debounceTimer.current) }
    }
    return () => clearTimeout(debounceTimer.current)
  }, [map, onViewportChange, onMapReady])
  return null
}

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const journeyIconMap = {
  'walks & trails': '/icons/ph--person-simple-hike.svg',
  'food & drink': '/icons/boxicons--food-menu.svg',
  'scenic & photography': '/icons/mdi--camera.svg',
  'culture & history': '/icons/proicons--museum.svg',
  'local experiences': '/icons/icon-park-solid--local.svg',
}

function JourneyMarkerLayer({ journeys }) {
  const map = useMap()
  const clusterGroupRef = useRef(null)

  function getFirstCoordinate(geoJson) {
    if (!geoJson) return null
    try {
      const parsed = JSON.parse(geoJson)
      if (parsed.coordinates && parsed.coordinates.length > 0) {
        const coord = parsed.coordinates[0]
        // GeoJSON is [lng, lat]
        if (Array.isArray(coord) && coord.length >= 2) {
          return [coord[1], coord[0]]
        }
      }
    } catch {
      // ignore parse errors
    }
    return null
  }

  function getJourneyIconUrl(categoryName) {
    const key = (categoryName || '').toLowerCase().trim()
    return journeyIconMap[key] || '/icons/ph--person-simple-hike.svg'
  }

  useEffect(() => {
    if (!clusterGroupRef.current) {
      clusterGroupRef.current = L.markerClusterGroup({
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        maxClusterRadius: 50,
      })
    }
    const clusterGroup = clusterGroupRef.current
    map.addLayer(clusterGroup)
    return () => { map.removeLayer(clusterGroup) }
  }, [map])

  // Add/update markers
  useEffect(() => {
    const clusterGroup = clusterGroupRef.current
    if (!clusterGroup) return
    clusterGroup.clearLayers()

    journeys.forEach(j => {
      const position = getFirstCoordinate(j.geoJson)
      if (!position) return
      const iconUrl = getJourneyIconUrl(j.journeyCategoryName)
      const icon = new L.DivIcon({
        html: `<div class="custom-map-marker"><img src="${iconUrl}" alt="Journey" /></div>`,
        className: 'custom-leaflet-marker',
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -28],
      })
      const marker = L.marker(position, { icon })
      const popupHtml = document.createElement('div')
      popupHtml.innerHTML = `
        <strong>${j.name}</strong><br />
        <span style="color: var(--text-secondary); font-size: 0.85em;">${j.journeyCategoryName || 'Journey'}</span><br />
        ${j.difficulty ? `<span style="font-size: 0.85em;">${j.difficulty}</span>` : ''}
        ${j.distanceMeters ? `<span style="font-size: 0.85em;"> · ${j.distanceMeters >= 1000 ? (j.distanceMeters / 1000).toFixed(1) + ' km' : j.distanceMeters + ' m'}</span>` : ''}
      `
      marker.bindPopup(popupHtml)
      clusterGroup.addLayer(marker)
    })
  }, [journeys])

  return null
}

function FitBounds({ bounds }) {
  const map = useMap()
  useEffect(() => { if (bounds?.length) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 }) }, [bounds, map])
  return null
}

function ZoomControls() {
  const map = useMap()
  const handleZoomIn = (e) => { e.preventDefault(); map.zoomIn() }
  const handleZoomOut = (e) => { e.preventDefault(); map.zoomOut() }
  return (
    <div className="leaflet-control-zoom" style={{ position: 'absolute', bottom: '20px', left: '20px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <button type="button" className="leaflet-control-zoom-in" title="Zoom in" onClick={handleZoomIn}>+</button>
      <button type="button" className="leaflet-control-zoom-out" title="Zoom out" onClick={handleZoomOut}>–</button>
    </div>
  )
}

// Haversine distance in meters
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371e3 // metres
  const phi1 = lat1 * Math.PI/180
  const phi2 = lat2 * Math.PI/180
  const deltaPhi = (lat2-lat1) * Math.PI/180
  const deltaLambda = (lng2-lng1) * Math.PI/180

  const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

  return R * c // in meters
}

export default function SpotsPage() {
  const { apiFetch } = useApi()
  const [mapSpots, setMapSpots] = useState([])
  const [mapTotal, setMapTotal] = useState(0)
  const [mapLimited, setMapLimited] = useState(false)
  const [status, setStatus] = useState('Loading spots...')
  const [searchParams] = useSearchParams()
  const [searchMode, setSearchMode] = useState(() => searchParams.get('mode') || 'place')
  const [place, setPlace] = useState('')
  const [lat, setLat] = useState(searchParams.get('lat') || '')
  const [lng, setLng] = useState(searchParams.get('lng') || '')
  const [radius, setRadius] = useState(searchParams.get('radiusKm') || '')
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'popularity')
  const [suggestions, setSuggestions] = useState([])
  const [viewingSingleSpot, setViewingSingleSpot] = useState(false)
  const [bounds, setBounds] = useState(() => {
    const pLat = parseFloat(searchParams.get('lat'))
    const pLng = parseFloat(searchParams.get('lng'))
    if (!isNaN(pLat) && !isNaN(pLng)) {
      return [[pLat, pLng]]
    }
    return []
  })

  useEffect(() => {
    const queryLat = searchParams.get('lat')
    const queryLng = searchParams.get('lng')
    const queryMode = searchParams.get('mode')
    if (queryMode) {
      setSearchMode(queryMode)
      if (queryMode === 'nearby') setViewingSingleSpot(false)
    }
    if (queryLat && queryLng) {
      const parsedLat = parseFloat(queryLat)
      const parsedLng = parseFloat(queryLng)
      if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
        setLat(queryLat)
        setLng(queryLng)
        setBounds([[parsedLat, parsedLng]])
        const queryRadius = searchParams.get('radiusKm') || searchParams.get('radius')
        setRadius(queryRadius || (queryMode === 'nearby' || searchMode === 'nearby' ? '5' : ''))
      }
    }
  }, [searchParams, searchMode])

  const handleSetSearchMode = (mode) => {
    setSearchMode(mode)
    if (mode === 'nearby') {
      setViewingSingleSpot(false)
      if (!radius) setRadius('5')
    } else {
      setRadius('')
    }
  }

  const geocodeTimer = useRef(null)
  const suggestionsAbort = useRef(null)
  const suggestionsRequestId = useRef(0)
  const viewportRequestId = useRef(0)
  const mapInstanceRef = useRef(null)
  const [page, setPage] = useState(0)

  const [ratingMode, setRatingMode] = useState(() => searchParams.get('ratingMode') || 'global')
  const [categoriesList, setCategoriesList] = useState([])
  const [selectedCategories, setSelectedCategories] = useState({ all: true })
  const [journeyCategoriesList, setJourneyCategoriesList] = useState([])
  const [selectedJourneyCategories, setSelectedJourneyCategories] = useState({})
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false)
  const [eventCategoriesList, setEventCategoriesList] = useState([])
  const [selectedEventCategories, setSelectedEventCategories] = useState({})
  const [allEventCategoriesSelected, setAllEventCategoriesSelected] = useState(true)
  const [searchModeDropdownOpen, setSearchModeDropdownOpen] = useState(false)
  const [journeys, setJourneys] = useState([])
  const [journeysLoading, setJourneysLoading] = useState(false)
  const [allJourneyCategoriesSelected, setAllJourneyCategoriesSelected] = useState(true)
  const [mapBounds, setMapBounds] = useState(null)
  const [categoriesReady, setCategoriesReady] = useState(false)
  const initialCatLoadRef = useRef({ categories: false, journeyCategories: false })
  const [searchedSpot, setSearchedSpot] = useState(null)
  const [searchedJourney, setSearchedJourney] = useState(null)

  // Interest → spot category mapping
  const INTEREST_SPOT_MAP = {
    coffee: ['café', 'cafe'],
    photography: [],
    food: ['restaurant', 'food hall'],
    alcohol: ['bar'],
    'exquisite food': ['restaurant', 'food hall'],
    travelling: [],
    hiking: [],
    beach: ['beach'],
    museum: [],
    nightlife: ['bar'],
    shopping: [],
    fitness: [],
  }

  // Interest → journey category name mapping
  const INTEREST_JOURNEY_MAP = {
    coffee: ['food & drink'],
    photography: ['scenic & photography'],
    food: ['food & drink'],
    alcohol: ['food & drink'],
    'exquisite food': ['food & drink'],
    travelling: ['local experiences'],
    hiking: ['walks & trails'],
    beach: ['walks & trails'],
    museum: ['culture & history'],
    nightlife: ['food & drink'],
    shopping: ['local experiences'],
    fitness: ['walks & trails'],
  }

  function isJourneyInBounds(j, bounds) {
    if (!bounds || !j.geoJson) return false
    try {
      const geo = JSON.parse(j.geoJson)
      if (geo.coordinates && geo.coordinates.length > 0) {
        const [lng, lat] = geo.coordinates[0]
        return lat >= bounds.southWest.lat && lat <= bounds.northEast.lat &&
               lng >= bounds.southWest.lng && lng <= bounds.northEast.lng
      }
    } catch { /* ignore */ }
    return false
  }

  useEffect(() => {
    async function fetchCatList() {
      try {
        const res = await apiFetch('/api/v1/categories')
        const data = await res.json()
        if (res.ok && data.length > 0) {
          const sorted = data.sort((a, b) => {
            const aIsOther = a.name.toLowerCase() === 'other' || a.name.toLowerCase() === 'others';
            const bIsOther = b.name.toLowerCase() === 'other' || b.name.toLowerCase() === 'others';
            if (aIsOther && !bIsOther) return 1;
            if (!aIsOther && bIsOther) return -1;
            return a.name.localeCompare(b.name);
          })
          setCategoriesList(sorted)
          const selMap = { all: true }
          sorted.forEach(c => {
            const norm = c.name.trim().toLowerCase().replace('é', 'e')
            selMap[norm] = true
            if (c.iconUrl) dynamicIconMap[norm] = c.iconUrl
          })
          // Auto-select categories based on user interests
          const stored = localStorage.getItem('interests')
          if (stored) {
            const userInterests = stored.split(',').filter(Boolean)
            if (userInterests.length > 0) {
              Object.keys(selMap).forEach(k => { selMap[k] = false })
              userInterests.forEach(interest => {
                const mapped = INTEREST_SPOT_MAP[interest] || []
                mapped.forEach(catName => { if (selMap[catName] !== undefined) selMap[catName] = true })
              })
              const allSelected = Object.keys(selMap).filter(k => k !== 'all').every(k => selMap[k] === true)
              selMap.all = allSelected
            }
          }
          setSelectedCategories(selMap)
          // Check if both are loaded
          if (initialCatLoadRef.current.journeyCategories) setCategoriesReady(true)
          initialCatLoadRef.current.categories = true
        }
      } catch { /* ignore */ }
    }
    fetchCatList()

    async function fetchJourneyCatList() {
      try {
        const res = await apiFetch('/api/v1/journey-categories')
        const data = await res.json()
        if (res.ok && data.length > 0) {
          const sorted = data.sort((a, b) => a.name.localeCompare(b.name))
          setJourneyCategoriesList(sorted)
          // Auto-select journey categories based on user interests
          const stored = localStorage.getItem('interests')
          const next = {}
          if (stored) {
            const userInterests = stored.split(',').filter(Boolean)
            if (userInterests.length > 0) {
              const journeyNamesToSelect = new Set()
              userInterests.forEach(interest => {
                const mapped = INTEREST_JOURNEY_MAP[interest] || []
                mapped.forEach(catName => journeyNamesToSelect.add(catName))
              })
              sorted.forEach(cat => {
                if (journeyNamesToSelect.has(cat.name.toLowerCase())) {
                  next[cat.id] = true
                }
              })
              setSelectedJourneyCategories(next)
              setAllJourneyCategoriesSelected(sorted.every(c => next[c.id]))
            } else {
              sorted.forEach(cat => { next[cat.id] = true })
              setSelectedJourneyCategories(next)
              setAllJourneyCategoriesSelected(true)
            }
          } else {
            sorted.forEach(cat => { next[cat.id] = true })
            setSelectedJourneyCategories(next)
            setAllJourneyCategoriesSelected(true)
          }
          // Check if both are loaded
          if (initialCatLoadRef.current.categories) setCategoriesReady(true)
          initialCatLoadRef.current.journeyCategories = true
        }
      } catch { /* ignore */ }
    }
    fetchJourneyCatList()

    async function fetchEventCatList() {
      try {
        const res = await apiFetch('/api/v1/event-categories')
        const data = await res.json()
        if (res.ok && data.length > 0) {
          const sorted = data.sort((a, b) => a.name.localeCompare(b.name))
          setEventCategoriesList(sorted)
          const next = {}
          sorted.forEach(cat => { next[cat.id] = true })
          setSelectedEventCategories(next)
          setAllEventCategoriesSelected(true)
        }
      } catch { /* ignore */ }
    }
    fetchEventCatList()
  }, [apiFetch])

  useEffect(() => {
    return () => { clearTimeout(geocodeTimer.current); suggestionsAbort.current?.abort() }
  }, [])

  const toggleCategory = (categoryId) => {
    if (categoryId === 'all') {
      const allSelected = Object.keys(selectedCategories).filter(k => k !== 'all').every(k => selectedCategories[k] === true)
      const newState = { all: !allSelected }
      categoriesList.forEach(c => { const norm = c.name.trim().toLowerCase().replace('é', 'e'); newState[norm] = !allSelected })
      setSelectedCategories(newState)
    } else {
      setSelectedCategories(prev => ({ ...prev, [categoryId]: !prev[categoryId] }))
    }
  }

  // Journey → spot type mappings (by category name)
  const JOURNEY_SPOT_TYPES = {
    'walks & trails': ['trail'],
    'food & drink': [],
    'scenic & photography': [],
    'culture & history': [],
    'local experiences': [],
  }

  const toggleAllJourneyCategories = () => {
    const allSelected = journeyCategoriesList.every(c => selectedJourneyCategories[c.id])
    const newState = {}
    journeyCategoriesList.forEach(c => { newState[c.id] = !allSelected })
    setSelectedJourneyCategories(newState)
    setAllJourneyCategoriesSelected(!allSelected)
  }

  const toggleJourneyCategory = (categoryId) => {
    setSelectedJourneyCategories(prev => {
      const next = { ...prev, [categoryId]: !prev[categoryId] }
      const allNowSelected = journeyCategoriesList.every(c => next[c.id])
      setAllJourneyCategoriesSelected(allNowSelected)
      return next
    })
  }

  const toggleAllEventCategories = () => {
    const allSelected = eventCategoriesList.every(c => selectedEventCategories[c.id])
    const newState = {}
    eventCategoriesList.forEach(c => { newState[c.id] = !allSelected })
    setSelectedEventCategories(newState)
    setAllEventCategoriesSelected(!allSelected)
  }

  const toggleEventCategory = (categoryId) => {
    setSelectedEventCategories(prev => {
      const next = { ...prev, [categoryId]: !prev[categoryId] }
      const allNowSelected = eventCategoriesList.every(c => next[c.id])
      setAllEventCategoriesSelected(allNowSelected)
      return next
    })
  }

  const filteredJourneys = useMemo(() => {
    // If a specific journey is searched, only show that one
    if (searchedJourney) return [searchedJourney]
    // If a specific spot is searched, don't show any journeys
    if (searchedSpot) return []
    if (!journeyCategoriesList.length) return journeys
    const anySelected = journeyCategoriesList.some(c => selectedJourneyCategories[c.id])
    if (!anySelected) return []
    const selectedIds = new Set(journeyCategoriesList.filter(c => selectedJourneyCategories[c.id]).map(c => c.id))
    return journeys.filter(j => selectedIds.has(j.journeyCategoryId) && isJourneyInBounds(j, mapBounds))
  }, [journeys, journeyCategoriesList, selectedJourneyCategories, mapBounds, searchedJourney, searchedSpot])

  const visibleMapSpots = useMemo(() => {
    // If a specific spot is searched, only show that one
    if (searchedSpot) return [searchedSpot]
    // If a specific journey is searched, don't show any spots
    if (searchedJourney) return []
    const spotCategoriesActive = Object.keys(selectedCategories).some(k => k !== 'all' && selectedCategories[k])
    const journeyCategoriesActive = journeyCategoriesList.some(c => selectedJourneyCategories[c.id])
    const eventCategoriesActive = eventCategoriesList.some(c => selectedEventCategories[c.id])

    if (!spotCategoriesActive && !journeyCategoriesActive && !eventCategoriesActive) return []

    let filtered = mapSpots.filter(spot => {
      // 1. Match spot categories
      if (spotCategoriesActive) {
        const normalized = (spot.type || '').trim().toLowerCase().replace('é', 'e')
        if (selectedCategories[normalized]) return true
      }

      // 2. Match journey categories
      if (journeyCategoriesActive) {
        const normalized = (spot.type || '').trim().toLowerCase().replace('é', 'e')
        for (const cat of journeyCategoriesList) {
          if (selectedJourneyCategories[cat.id]) {
            const types = JOURNEY_SPOT_TYPES[cat.name.toLowerCase()] || []
            if (types.includes(normalized)) return true
          }
        }
      }

      // 3. Match event categories
      if (eventCategoriesActive && spot.hasActiveEvent && spot.activeEventCategories) {
        const activeCats = spot.activeEventCategories.split(',').map(c => c.trim().toLowerCase())
        for (const cat of eventCategoriesList) {
          if (selectedEventCategories[cat.id]) {
            if (activeCats.includes(cat.name.toLowerCase())) return true
          }
        }
      }

      return false
    })

    // 2. Filter by distance/radius if searchMode is 'nearby'
    if (searchMode === 'nearby' && lat && lng && radius) {
      const targetLat = parseFloat(lat)
      const targetLng = parseFloat(lng)
      const maxDistanceMeters = parseFloat(radius) * 1000
      if (!isNaN(targetLat) && !isNaN(targetLng) && !isNaN(maxDistanceMeters)) {
        filtered = filtered.filter(spot => {
          const dist = haversineDistance(targetLat, targetLng, spot.latitude, spot.longitude)
          return dist <= maxDistanceMeters
        })
      }
    }

    // 3. Sort by distance or popularity
    if (sortBy === 'distance' && lat && lng) {
      const targetLat = parseFloat(lat)
      const targetLng = parseFloat(lng)
      if (!isNaN(targetLat) && !isNaN(targetLng)) {
        filtered = [...filtered].sort((a, b) => {
          const distA = haversineDistance(targetLat, targetLng, a.latitude, a.longitude)
          const distB = haversineDistance(targetLat, targetLng, b.latitude, b.longitude)
          return distA - distB
        })
      }
    }

    return filtered
  }, [mapSpots, selectedCategories, selectedJourneyCategories, journeyCategoriesList, selectedEventCategories, eventCategoriesList, searchMode, lat, lng, radius, sortBy, searchedSpot, searchedJourney])

  // Pagination: 50 per page
  const pageSize = 50
  const totalPages = Math.max(1, Math.ceil(visibleMapSpots.length / pageSize))
  const currentPage = Math.min(page, totalPages - 1)
  const pagedSpots = useMemo(() => {
    const start = currentPage * pageSize
    return visibleMapSpots.slice(start, start + pageSize)
  }, [visibleMapSpots, currentPage, pageSize])

  const getActiveMapType = useCallback(() => {
    // When journey categories are active, don't filter API by spot type
    // because journey types (e.g. "trail") are different spot types that need to be loaded too
    const journeyActive = journeyCategoriesList.some(c => selectedJourneyCategories[c.id])
    if (journeyActive) return null
    const selected = Object.keys(selectedCategories).filter(k => k !== 'all' && selectedCategories[k])
    if (selected.length === 1) return selected[0]
    return null
  }, [selectedCategories, journeyCategoriesList, selectedJourneyCategories])

  const loadMapViewport = useCallback(async (map) => {
    if (!map || (viewingSingleSpot && searchMode !== 'nearby')) return
    const requestId = ++viewportRequestId.current
    const bounds = map.getBounds()
    setMapBounds({
      southWest: { lat: bounds.getSouth(), lng: bounds.getWest() },
      northEast: { lat: bounds.getNorth(), lng: bounds.getEast() },
    })
    const params = new URLSearchParams({
      swLat: bounds.getSouth().toFixed(6),
      swLng: bounds.getWest().toFixed(6),
      neLat: bounds.getNorth().toFixed(6),
      neLng: bounds.getEast().toFixed(6),
      zoom: String(Math.round(map.getZoom())),
    })
    const activeType = getActiveMapType()
    if (activeType) params.set('type', activeType)
    params.set('mode', ratingMode)

    setStatus('Loading map spots...')
    try {
      const res = await apiFetch(`/api/v1/spots/map?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load map spots.')
      if (requestId !== viewportRequestId.current) return

      const nextSpots = (data.spots || []).map(s => ({
        ...s,
        address: '',
        averageRating: s.averageRating || 0,
        status: 'ACTIVE',
        tags: [],
      }))
      setMapTotal(data.total || 0)
      setMapLimited(!!data.limited)
      setMapSpots(nextSpots)
      setPage(0)
      const loadedCount = nextSpots.length
      const totalCount = data.total || 0
      setStatus(`Showing ${loadedCount.toLocaleString()} of ${totalCount.toLocaleString()} spots in view${data.limited ? '' : '.'}`)
    } catch (e) {
      if (requestId === viewportRequestId.current) setStatus(e.message)
    }
  }, [apiFetch, viewingSingleSpot, searchMode, getActiveMapType, ratingMode])

  const isInitialCategoryLoad = useRef(true)
  useEffect(() => {
    if (isInitialCategoryLoad.current) { isInitialCategoryLoad.current = false; return }
    if (mapInstanceRef.current && !viewingSingleSpot) {
      setPage(0)
      loadMapViewport(mapInstanceRef.current)
    }
  }, [selectedCategories, loadMapViewport, viewingSingleSpot, categoriesReady])

  const handleClearSearch = () => {
    setPlace(''); setLat(''); setLng(''); setRadius(''); setSuggestions([]); setBounds([]); setMapSpots([]); setPage(0)
    setViewingSingleSpot(false)
    setSearchedSpot(null); setSearchedJourney(null)
    setStatus('Loading map spots...')
    if (mapInstanceRef.current) loadMapViewport(mapInstanceRef.current)
  }

  // Fetch all journeys on mount
  useEffect(() => {
    setJourneysLoading(true)
    apiFetch('/api/v1/journeys')
      .then(res => res.json())
      .then(data => setJourneys(data || []))
      .catch(() => setJourneys([]))
      .finally(() => setJourneysLoading(false))
  }, [apiFetch])

  const handlePlaceInput = (q) => {
    setPlace(q)
    setViewingSingleSpot(false)
    clearTimeout(geocodeTimer.current); suggestionsAbort.current?.abort()
    const requestId = ++suggestionsRequestId.current
    if (q.length < 2) { setSuggestions([]); return }
    geocodeTimer.current = setTimeout(async () => {
      const controller = new AbortController(); suggestionsAbort.current = controller
        try {
          let combinedSuggestions = []
          // 1. Backend spot search
          try {
            const res = await apiFetch(`/api/v1/spots/search?q=${encodeURIComponent(q)}&limit=3`, { signal: controller.signal })
            const data = await res.json()
            if (res.ok && data?.length > 0) combinedSuggestions = [...data]
          } catch (e) { if (e.name !== 'AbortError') console.error(e) }
          // 2. Journey search (client-side from already loaded journeys)
          try {
            const qLower = q.toLowerCase()
            const matchingJourneys = journeys.filter(j => j.name?.toLowerCase().includes(qLower)).slice(0, 3)
            if (matchingJourneys.length > 0) {
              const formatted = matchingJourneys.map(j => ({
                name: j.name,
                type: 'Journey',
                address: j.journeyCategoryName || 'Journey',
                latitude: null,
                longitude: null,
                isJourney: true,
                journeyData: j,
              }))
              const existingNames = new Set(combinedSuggestions.map(s => s.name))
              combinedSuggestions.push(...formatted.filter(f => !existingNames.has(f.name)))
            }
          } catch (e) { console.error(e) }
          // 3. Nominatim city/place search
          try {
            const nomRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=3`, {
              headers: { 'Accept-Language': 'en' },
              signal: controller.signal
            })
            const nomData = await nomRes.json()
            if (nomData?.length > 0) {
              const formatted = nomData.map(item => ({
                name: item.display_name.split(',')[0],
                type: 'Place',
                address: item.display_name,
                latitude: parseFloat(item.lat),
                longitude: parseFloat(item.lon),
                isPlace: true,
              }))
              const existingNames = new Set(combinedSuggestions.map(s => s.name))
              combinedSuggestions.push(...formatted.filter(f => !existingNames.has(f.name)))
            }
          } catch (e) { if (e.name !== 'AbortError') console.error(e) }
          if (requestId === suggestionsRequestId.current && !controller.signal.aborted) setSuggestions(combinedSuggestions)
        } catch (error) { if (error.name !== 'AbortError' && requestId === suggestionsRequestId.current) setSuggestions([]) }
    }, 250)
  }

  const selectSuggestion = (spot) => {
    setPlace(spot.name); setLat(spot.latitude); setLng(spot.longitude); setSuggestions([]); setPage(0)
    setSearchedSpot(null)
    setSearchedJourney(null)
    if (spot.isJourney) {
      // Journey selected — show only this journey
      setSearchedJourney(spot.journeyData)
      setMapSpots([])
      setMapTotal(0)
      setRadius('')
      setStatus(`Journey: ${spot.name}`)
      // Fly to journey start point if available
      if (spot.journeyData?.geoJson && mapInstanceRef.current) {
        try {
          const geo = JSON.parse(spot.journeyData.geoJson)
          if (geo.coordinates && geo.coordinates.length > 0) {
            const [lng, lat] = geo.coordinates[0]
            mapInstanceRef.current.flyTo([lat, lng], 13, { duration: 1.2 })
          }
        } catch { /* ignore */ }
      }
    } else if (spot.isPlace) {
      // City/place from Nominatim — fly map to that location
      setRadius(searchMode === 'nearby' ? (radius || '5') : '')
      setMapSpots([])
      setMapTotal(0)
      setPage(0)
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyTo([spot.latitude, spot.longitude], 12, { duration: 1.5 })
      }
      setStatus(`Viewing ${spot.name}`)
      // Trigger a viewport load after fly animation
      setTimeout(() => {
        if (mapInstanceRef.current) loadMapViewport(mapInstanceRef.current)
      }, 1600)
    } else if (spot.isCityDestination) {
      setViewingSingleSpot(false)
      setRadius(radius || '50')
    } else if (searchMode === 'nearby' && radius) {
      setViewingSingleSpot(false)
      // keep radius
    } else {
      setViewingSingleSpot(true)
      setRadius('')
      setStatus('1 spot found.')
      setMapSpots([spot])
      setMapTotal(1)
      setBounds([[spot.latitude, spot.longitude]])
    }
  }

  const handleSearch = async () => {
    if (searchMode === 'nearby') {
      if (!lat || !lng || !radius) { setStatus('Search for a place first, then set a radius.'); return }
    } else {
      const query = place.trim()
      if (!query) { setStatus('Enter a place name to search.'); return }
      setStatus('Searching...'); setSuggestions([]); setLat(''); setLng(''); setRadius(''); setPage(0)
    }
  }

  // Status text
  const statusText = useMemo(() => {
    if (status.includes('Loading')) return status
    const spotActive = Object.keys(selectedCategories).some(k => k !== 'all' && selectedCategories[k])
    const journeyActive = journeyCategoriesList.some(c => selectedJourneyCategories[c.id])
    const eventActive = eventCategoriesList.some(c => selectedEventCategories[c.id])
    if (!spotActive && !journeyActive && !eventActive) return 'Select a category!'
    if (visibleMapSpots.length === 0 && !status.includes('spots in view') && !journeyActive) return status
    const spotCount = visibleMapSpots.length
    const journeyCount = filteredJourneys.length
    if (spotActive && journeyActive) {
      const total = spotCount + journeyCount
      if (total > 1000) return `More than 1000 spots and journeys found.`
      return `${total.toLocaleString()} spots and journeys found.`
    } else if (journeyActive) {
      if (journeyCount > 1000) return `More than 1000 journeys found.`
      return `${journeyCount.toLocaleString()} journeys found.`
    }
    if (spotCount > 1000) return `More than 1000 spots found.`
    return `${spotCount.toLocaleString()} spots found.`
  }, [status, visibleMapSpots.length, filteredJourneys.length, mapTotal, mapLimited, totalPages, currentPage, pageSize, selectedCategories, selectedJourneyCategories, journeyCategoriesList, selectedEventCategories, eventCategoriesList])

  // Page numbers for pagination — show current group of 5, can shift groups with arrows
  const pageNumbers = useMemo(() => {
    if (totalPages <= 1) return []
    const maxVisible = 5
    const pages = []
    // Shift the 5-page window by 5 each time, centered on current page
    let start = Math.floor(currentPage / maxVisible) * maxVisible
    let end = Math.min(totalPages, start + maxVisible)
    if (end - start < maxVisible && start > 0) {
      start = Math.max(0, end - maxVisible)
    }
    for (let i = start; i < end; i++) pages.push(i)
    return { pages, groupStart: start, groupEnd: end }
  }, [totalPages, currentPage])

  return (
    <div className="spots-page">
      <div className="spots-map">
        <div className="map-search-container">
          <div className="map-search-bar-wrapper">
            <input className="input map-search-input" value={place} onChange={e => handlePlaceInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSearch() }} placeholder="Search spots, experiences or cities..." autoComplete="off" />
            <button type="button" className={`map-search-icon-btn clear-btn${(place || lat || lng) ? ' active' : ''}`} onClick={handleClearSearch} title="Clear search & location" aria-label="Clear search">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <button type="button" className="map-search-icon-btn search-btn" onClick={handleSearch} title="Search" aria-label="Search"><img src="/icons/fluent--search-16-regular.svg" alt="Search" /></button>
            <button type="button" className="map-search-icon-btn options-btn" onClick={() => setSearchModeDropdownOpen(!searchModeDropdownOpen)} title="Search mode options" aria-label="Search options"><img src="/icons/stash--ellipsis-v-light.svg" alt="Options" /></button>
            {suggestions.length > 0 && (
              <div className="suggestions-dropdown">
                {suggestions.map((s, i) => (
                  <div key={i} className="suggestion-item" onClick={() => selectSuggestion(s)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div className="suggestion-icon" style={{ display: 'flex', alignItems: 'center', opacity: 0.6, color: 'var(--text-secondary)' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="suggestion-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                      <div className="suggestion-full" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.type} · {s.address}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button type="button" className="locate-me-btn glass-btn" onClick={() => { setStatus('Getting location...'); if (!navigator.geolocation) { setStatus('Geolocation not supported'); return; } navigator.geolocation.getCurrentPosition(pos => { const { latitude, longitude } = pos.coords; if (mapInstanceRef.current) { mapInstanceRef.current.flyTo([latitude, longitude], 14, { duration: 1.2 }); } setStatus(`Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`); }, err => { setStatus('Could not get location'); console.warn('Geolocation error:', err); }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }); }} title="Locate me" aria-label="Locate me">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line></svg>
          </button>
          {searchModeDropdownOpen && (
            <div style={{ position: 'absolute', top: '0', left: '100%', marginLeft: '0.5rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', zIndex: 1001, minWidth: '180px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.75rem' }}>
                <input type="radio" checked={searchMode === 'place'} onChange={() => { handleSetSearchMode('place'); setSearchModeDropdownOpen(false) }} style={{ width: '14px', height: '14px', accentColor: 'var(--text-primary)' }} /><span>Place</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.75rem' }}>
                <input type="radio" checked={searchMode === 'nearby'} onChange={() => { handleSetSearchMode('nearby'); setSearchModeDropdownOpen(false) }} style={{ width: '14px', height: '14px', accentColor: 'var(--text-primary)' }} /><span>Nearby</span>
              </label>
              <div style={{ padding: '0.35rem 0.75rem', borderTop: '1px solid var(--border)', marginTop: '0.25rem' }}>
                <label className="label" style={{ marginBottom: '0.15rem', fontSize: '0.65rem' }}>Radius (km)</label>
                <input className="input" type="number" min="0.1" step="0.1" value={radius} onChange={e => setRadius(e.target.value)} placeholder="5" style={{ width: '80px', fontSize: '0.75rem', padding: '0.3rem 0.5rem' }} />
              </div>
            </div>
          )}
        </div>

        <div className="map-filter-container" style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 500 }}>
          <button className="btn btn-primary" onClick={() => setFilterDropdownOpen(!filterDropdownOpen)} style={{ whiteSpace: 'nowrap', padding: '0.5rem 1rem' }}>Discover</button>
          {filterDropdownOpen && (
            <div className="map-filter-dropdown" style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem', minWidth: '200px', zIndex: 1000 }}>
              <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', paddingBottom: '0.25rem', borderBottom: '1px solid var(--border)' }}>Spots</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                <input type="checkbox" checked={selectedCategories.all} onChange={() => toggleCategory('all')} style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--text-primary)' }} /><span>All Spots</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto', marginBottom: '0.75rem' }}>
                {categoriesList.map(cat => {
                  const norm = cat.name.trim().toLowerCase().replace('é', 'e')
                  return (
                    <label key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500' }}>
                      <input type="checkbox" checked={!!selectedCategories[norm]} onChange={() => toggleCategory(norm)} style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--text-primary)' }} />
                      <img src={cat.iconUrl || '/icons/stash--pin-location-light.svg'} alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} /><span>{cat.name}</span>
                    </label>
                  )
                })}
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', paddingBottom: '0.25rem', borderBottom: '1px solid var(--border)', marginTop: '0.5rem' }}>Experiences</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                <input type="checkbox" checked={allJourneyCategoriesSelected} onChange={toggleAllJourneyCategories} style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--text-primary)' }} /><span>All Experiences</span>
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {journeyCategoriesList.map(cat => (
                  <label key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500' }}>
                    <input type="checkbox" checked={!!selectedJourneyCategories[cat.id]} onChange={() => toggleJourneyCategory(cat.id)} style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--text-primary)' }} />
                    <img src={cat.iconUrl || '/icons/stash--pin-location-light.svg'} alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} /><span>{cat.name}</span>
                  </label>
                ))}
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', paddingBottom: '0.25rem', borderBottom: '1px solid var(--border)', marginTop: '0.5rem' }}>Events</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                <input type="checkbox" checked={allEventCategoriesSelected} onChange={toggleAllEventCategories} style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--text-primary)' }} /><span>All Events</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
                {eventCategoriesList.map(cat => (
                  <label key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500' }}>
                    <input type="checkbox" checked={!!selectedEventCategories[cat.id]} onChange={() => toggleEventCategory(cat.id)} style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--text-primary)' }} />
                    <img src={cat.iconUrl || '/icons/stash--pin-location-light.svg'} alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} /><span>{cat.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <MapContainer center={[7.8804, 98.3923]} zoom={12} style={{ width: '100%', height: '100%' }} zoomControl={false}>
          <TileLayer url={`https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key=${import.meta.env.VITE_STADIA_API_KEY}`}
            attribution='Map tiles by <a href="https://stadiamaps.com/">Stadia Maps</a>, <a href="https://openmaptiles.org/">OpenMapTiles</a>, and <a href="http://openstreetmap.org">OpenStreetMap</a> contributors' />
          <MapViewportLoader onViewportChange={loadMapViewport} onMapReady={(map) => { mapInstanceRef.current = map }} />
          <MarkerClusterGroup spots={visibleMapSpots} createIcon={createMarkerIcon} />
          {lat && lng && (
            <Marker position={[parseFloat(lat), parseFloat(lng)]} icon={targetIcon}>
              <Popup>
                <div style={{ textAlign: 'center', padding: '0.2rem' }}>
                  <strong>Target Location</strong>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    {parseFloat(lat).toFixed(6)}, {parseFloat(lng).toFixed(6)}
                  </div>
                </div>
              </Popup>
            </Marker>
          )}
          <JourneyMarkerLayer journeys={filteredJourneys} />
          {lat && lng && radius && (
            <Circle center={[parseFloat(lat), parseFloat(lng)]} radius={parseFloat(radius) * 1000}
              pathOptions={{ color: 'var(--border-color)', fillColor: 'var(--border-color)', fillOpacity: 0.08, weight: 2 }} />
          )}
          <FitBounds bounds={bounds} />
          <ZoomControls />
        </MapContainer>
      </div>

      <div className="spots-sidebar">
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', alignItems: 'center', marginTop: '0.25rem', marginBottom: '0.5rem' }}>
          <RatingModeSelector mode={ratingMode} onChange={(m) => {
            setRatingMode(m)
            setPage(0)
            if (mapInstanceRef.current && !viewingSingleSpot) {
              loadMapViewport(mapInstanceRef.current)
            }
          }} />
          <select className="input select" style={{ width: 'auto', padding: '0.4rem 2.5rem 0.4rem 1rem' }}
            value={sortBy} onChange={e => { setSortBy(e.target.value) }}>
            <option value="popularity"> Trending</option>
            <option value="distance" disabled={!(lat && lng && radius)}> Distance</option>
          </select>
        </div>
        <p className="spots-status" style={{ textAlign: 'center', marginBottom: '0.25rem' }}>{statusText}</p>
        <div className="spots-list">
          {journeysLoading && (
            <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading journeys...</div>
          )}
          {filteredJourneys.length > 0 && filteredJourneys.map(j => (
            <div key={j.id} className="glass" style={{ padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', cursor: 'pointer', transition: 'border-color 0.2s', marginBottom: '0.5rem' }}
              onClick={() => window.location.href = `/journey/${j.id}`}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: j.upvoteCount > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill={j.upvoteCount > 0 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                  {j.upvoteCount || 0}
                </div>
              </div>
              <h3 style={{ margin: '0 0 0.25rem', fontSize: '0.95rem', fontWeight: 600 }}>{j.name}</h3>
              {j.description && <p style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{j.description}</p>}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {j.journeyCategoryName && <span>🏷️ {j.journeyCategoryName}</span>}
                {j.difficulty && <span>• {j.difficulty}</span>}
                {j.distanceMeters && <span>• {j.distanceMeters >= 1000 ? `${(j.distanceMeters / 1000).toFixed(1)} km` : `${j.distanceMeters} m`}</span>}
              </div>
            </div>
          ))}
          {pagedSpots.length === 0 && journeys.length === 0 && !journeysLoading && !status.includes('Loading') ? (
            <div className="empty-state">Uh oh!</div>
          ) : (
            pagedSpots.map(s => <SpotCard key={s.id} spot={s} />)
          )}
          {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.2rem', padding: '0.4rem 0', whiteSpace: 'nowrap', overflowX: 'visible', alignItems: 'center' }}>
            {/* First page */}
            <button className="btn btn-ghost" onClick={() => setPage(0)} disabled={currentPage === 0} style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem', flexShrink: 0 }}>«</button>
            {/* Previous group (shift 5 back) */}
            <button className="btn btn-ghost" onClick={() => setPage(Math.max(0, pageNumbers.groupStart - 5))} disabled={pageNumbers.groupStart === 0} style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem', flexShrink: 0 }}>‹</button>
            {/* Page numbers in current group */}
            {pageNumbers.pages.map(p => (
              <button key={p}
                className={`btn ${p === currentPage ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setPage(p)}
                style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem', minWidth: '24px', flexShrink: 0 }}
              >{p + 1}</button>
            ))}
            {/* Next group (shift 5 forward) */}
            <button className="btn btn-ghost" onClick={() => setPage(Math.min(totalPages - 1, pageNumbers.groupEnd))} disabled={pageNumbers.groupEnd >= totalPages - 1} style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem', flexShrink: 0 }}>›</button>
            {/* Last page */}
            <button className="btn btn-ghost" onClick={() => setPage(totalPages - 1)} disabled={currentPage >= totalPages - 1} style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem', flexShrink: 0 }}>»</button>
          </div>
          )}
        </div>
      </div>
    </div>
  )
}
