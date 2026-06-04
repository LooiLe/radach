import { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import { useSearchParams } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useApi } from '../hooks/useApi'
import SpotCard from '../components/SpotCard'
import './SpotsPage.css'

let dynamicIconMap = {
  restaurant: '/icons/material-symbols-light--chef-hat-outline.svg',
  bar: '/icons/guidance--bar.svg',
  hotel: '/icons/material-symbols-light--hotel-outline-rounded.svg',
  cafe: '/icons/carbon--cafe.svg',
  'food hall': '/icons/material-symbols-light--chef-hat-outline.svg',
  beach: '/icons/streamline-plump--beach.svg',
  market: '/icons/material-symbols-light--attractions-outline-rounded.svg',
  attraction: '/icons/material-symbols-light--attractions-outline-rounded.svg',
  attractions: '/icons/material-symbols-light--attractions-outline-rounded.svg',
  viewpoints: '/icons/game-icons--hill-conquest.svg',
  viewpoint: '/icons/game-icons--hill-conquest.svg',
  default: '/icons/stash--pin-location-light.svg',
}

function createMarkerIcon(type) {
  const normalized = (type || '').toString().trim().toLowerCase().replace('é', 'e')
  const icon = dynamicIconMap[normalized] || dynamicIconMap.default
  return new L.DivIcon({
    html: `<div class="custom-map-marker"><img src="${icon}" alt="${type || 'Spot'}" /></div>`,
    className: 'custom-leaflet-marker',
    iconSize: [44, 44],
    iconAnchor: [22, 44],
    popupAnchor: [0, -44],
  })
}

import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster'

// MarkerClusterGroup component
function MarkerClusterGroup({ spots, createIcon }) {
  const map = useMap()
  const clusterGroupRef = useRef(null)

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

    return () => {
      map.removeLayer(clusterGroup)
    }
  }, [map])

  useEffect(() => {
    const clusterGroup = clusterGroupRef.current
    if (!clusterGroup) return

    clusterGroup.clearLayers()

    spots.forEach(s => {
      const marker = L.marker([s.latitude, s.longitude], {
        icon: createIcon(s.type)
      })

      const popupHtml = document.createElement('div')
      popupHtml.innerHTML = `
        <strong>${s.name}</strong>${s.isGlobal ? '<span style="font-size: 0.7rem; color: #888; margin-left: 4px;">🌐</span>' : ''}<br />
        <span style="color: var(--star);">${s.averageRating > 0 ? `★ ${s.averageRating.toFixed(1)}` : s.isGlobal ? 'Global spot' : 'No ratings'}</span><br />
        ${s.type} · ${s.address}<br />
        ${!s.isGlobal ? `<a href="/spot/${s.id}">View details →</a>` : ''}
      `
      marker.bindPopup(popupHtml)
      clusterGroup.addLayer(marker)
    })
  }, [spots, createIcon])

  return null
}

// Fix default marker icon
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Helper to map Nominatim types to friendly category names
function mapNominatimType(type, cls) {
  const typeMap = {
    restaurant: 'Restaurant', cafe: 'Cafe', bar: 'Bar', pub: 'Bar',
    hotel: 'Hotel', hostel: 'Hotel', motel: 'Hotel', guest_house: 'Hotel',
    museum: 'Attraction', gallery: 'Attraction', theatre: 'Attraction', cinema: 'Attraction',
    park: 'Attraction', garden: 'Attraction', zoo: 'Attraction',
    beach: 'Beach', viewpoint: 'Viewpoint',
    marketplace: 'Market', supermarket: 'Market',
    fast_food: 'Restaurant', food_court: 'Food Hall',
  }
  return typeMap[type] || typeMap[cls] || 'Other'
}

function FitBounds({ bounds }) {
  const map = useMap()
  useEffect(() => {
    if (bounds?.length) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 })
  }, [bounds, map])
  return null
}

// Zoom controls component using useMap hook
function ZoomControls() {
  const map = useMap()

  const handleZoomIn = (e) => {
    e.preventDefault()
    if (map) map.zoomIn()
  }

  const handleZoomOut = (e) => {
    e.preventDefault()
    if (map) map.zoomOut()
  }

  return (
    <div className="leaflet-control-zoom" style={{ position: 'absolute', bottom: '20px', left: '20px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <button
        type="button"
        className="leaflet-control-zoom-in"
        title="Zoom in"
        onClick={handleZoomIn}
      >
        +
      </button>
      <button
        type="button"
        className="leaflet-control-zoom-out"
        title="Zoom out"
        onClick={handleZoomOut}
      >
        –
      </button>
    </div>
  )
}

const SpotResultsList = memo(function SpotResultsList({ filteredSpots, status }) {
  return (
    <div className="spots-list">
      {filteredSpots.length === 0 && status && !status.includes('Loading') && (
        <div className="empty-state">No spots found.</div>
      )}
      {filteredSpots.slice(0, 100).map(s => (
        s.isGlobal ? (
          <article key={s.id} className="spot-card glass" style={{ cursor: 'default' }}>
            <div className="spot-card-header">
              <div className="spot-card-title">
                <img src="/icons/stash--pin-location-light.svg" alt={`${s.type} icon`} className="spot-card-type-icon" />
                <div>
                  <h3 className="spot-card-name">{s.name} <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 400 }}>Global</span></h3>
                  <p className="spot-card-meta">{s.type} - {s.address}</p>
                </div>
              </div>
            </div>
          </article>
        ) : (
          <SpotCard key={s.id} spot={s} />
        )
      ))}
      {filteredSpots.length > 100 && (
        <div className="spots-limit-info" style={{ padding: '1rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)', borderTop: '1px dashed var(--border)' }}>
          Showing top 100 of {filteredSpots.length} spots. Use filters or search to find specific spots.
        </div>
      )}
    </div>
  )
})

export default function SpotsPage() {
  const { apiFetch } = useApi()
  const [spots, setSpots] = useState([])
  const [status, setStatus] = useState('Loading spots...')
  const [searchParams] = useSearchParams()
  const [searchMode, setSearchMode] = useState(() => searchParams.get('mode') || 'place')

  // Geo search state
  const [place, setPlace] = useState('')
  const [lat, setLat] = useState(searchParams.get('lat') || '')
  const [lng, setLng] = useState(searchParams.get('lng') || '')
  const [radius, setRadius] = useState(searchParams.get('radiusKm') || '')
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'popularity')
  const [suggestions, setSuggestions] = useState([])
  const [bounds, setBounds] = useState([])
  const geocodeTimer = useRef(null)
  const suggestionsAbort = useRef(null)
  const suggestionsRequestId = useRef(0)

  // Category filter state
  const [categoriesList, setCategoriesList] = useState([])
  const [selectedCategories, setSelectedCategories] = useState({ all: true })
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false)
  const [searchModeDropdownOpen, setSearchModeDropdownOpen] = useState(false)



  useEffect(() => {
    async function fetchCatList() {
      try {
        const res = await apiFetch('/api/v1/categories')
        const data = await res.json()
        if (res.ok && data.length > 0) {
          const sorted = data.sort((a, b) => {
            if (a.name.toLowerCase() === 'other') return 1;
            if (b.name.toLowerCase() === 'other') return -1;
            return a.name.localeCompare(b.name);
          })
          setCategoriesList(sorted)

          const selMap = { all: true }
          sorted.forEach(c => {
            const norm = c.name.trim().toLowerCase().replace('é', 'e')
            selMap[norm] = true
            if (c.iconUrl) {
              dynamicIconMap[norm] = c.iconUrl
            }
          })
          setSelectedCategories(selMap)
        }
      } catch { /* ignore */ }
    }
    fetchCatList()
  }, [apiFetch])

  useEffect(() => {
    return () => {
      clearTimeout(geocodeTimer.current)
      suggestionsAbort.current?.abort()
    }
  }, [])

  const toggleCategory = (categoryId) => {
    if (categoryId === 'all') {
      const allSelected = Object.keys(selectedCategories).filter(k => k !== 'all').every(k => selectedCategories[k] === true)
      const newState = { all: !allSelected }
      categoriesList.forEach(c => {
        const norm = c.name.trim().toLowerCase().replace('é', 'e')
        newState[norm] = !allSelected
      })
      setSelectedCategories(newState)
    } else {
      setSelectedCategories(prev => ({
        ...prev,
        [categoryId]: !prev[categoryId]
      }))
    }
  }

  const filteredSpots = useMemo(() => spots.filter(spot => {
    const normalized = (spot.type || '').trim().toLowerCase().replace('é', 'e')
    return selectedCategories[normalized]
  }), [spots, selectedCategories])

  const filteredSpotCounts = useMemo(() => ({
    db: filteredSpots.filter(s => !s.isGlobal).length,
    global: filteredSpots.filter(s => s.isGlobal).length,
  }), [filteredSpots])

  const loadSpots = useCallback(async (filters) => {
    setStatus('Loading spots...')
    const params = new URLSearchParams()

    const modeToUse = filters?.mode || searchMode
    const currentSortBy = filters?.sortBy || sortBy
    const isTrendingSort = ['popularity', 'trending_friends', 'trending_experts'].includes(currentSortBy)

    const currentLat = filters?.lat !== undefined ? filters.lat : lat
    const currentLng = filters?.lng !== undefined ? filters.lng : lng
    const currentRadius = filters?.radiusKm !== undefined ? filters.radiusKm : radius

    const hasLocation = !!(currentLat && currentLng)
    const currentSearch = filters?.search !== undefined ? filters.search : (hasLocation ? '' : place)

    // Build query params
    if (currentSearch) {
      params.set('q', currentSearch)
    } else if (isTrendingSort) {
      if (hasLocation) {
        params.set('lat', currentLat)
        params.set('lng', currentLng)
        params.set('radiusKm', currentRadius || '10')
      }
    } else {
      // Normal search mode behavior
      if (modeToUse === 'nearby' && hasLocation && currentRadius) {
        params.set('lat', currentLat)
        params.set('lng', currentLng)
        params.set('radiusKm', currentRadius)
      } else if (modeToUse === 'place' && hasLocation) {
        params.set('lat', currentLat)
        params.set('lng', currentLng)
        params.set('radiusKm', currentRadius || '5')
      }
    }

    // Don't send custom trending sort keys to standard endpoints
    if (currentSortBy && !currentSortBy.startsWith('trending_')) {
      params.set('sortBy', currentSortBy)
    }

    try {
      let dbSpots = []

      // 1. Always fetch from our database
      let path = '/api/v1/spots'
      if (currentSearch) {
        path = '/api/v1/spots/search'
      } else if (currentSortBy === 'trending_friends' || currentSortBy === 'trending_experts') {
        path = '/api/v1/spots/trending'
        params.set('type', currentSortBy === 'trending_friends' ? 'personalized' : 'expert')
      }
      const queryString = params.toString()
      const finalPath = queryString ? `${path}?${queryString}` : path
      try {
        const res = await apiFetch(finalPath)
        const data = await res.json()
        if (res.ok) dbSpots = data
      } catch (e) { console.error('DB spots error:', e) }

      // 2. If nearby mode is active, also fetch global POIs from Nominatim
      let globalSpots = []
      const isNearbyGeo = hasLocation && modeToUse === 'nearby'
      const fetchLat = currentLat
      const fetchLng = currentLng
      const fetchRadius = currentRadius || '10'

      if (isNearbyGeo && fetchRadius) {
        try {
          // Use Nominatim reverse geocoding to find POIs around the location
          const radiusMeters = parseFloat(fetchRadius) * 1000
          const latVal = parseFloat(fetchLat)
          const lngVal = parseFloat(fetchLng)
          // Calculate a bounding box from lat/lng and radius
          const latDelta = radiusMeters / 111320
          const lngDelta = radiusMeters / (111320 * Math.cos(latVal * Math.PI / 180))
          const viewbox = `${lngVal - lngDelta},${latVal + latDelta},${lngVal + lngDelta},${latVal - latDelta}`

          const nomRes = await fetch(
            `https://nominatim.openstreetmap.org/search?q=restaurant+OR+cafe+OR+bar+OR+hotel+OR+attraction&format=json&limit=20&viewbox=${viewbox}&bounded=1`,
            { headers: { 'Accept-Language': 'en' } }
          )
          const nomData = await nomRes.json()
          if (nomData?.length > 0) {
            // Get existing DB spot names to avoid duplicates
            const dbNames = new Set(dbSpots.map(s => s.name?.toLowerCase()))
            globalSpots = nomData
              .filter(item => !dbNames.has(item.display_name?.split(',')[0]?.toLowerCase()))
              .map((item, idx) => ({
                id: `global-${idx}`,
                name: item.display_name.split(',')[0],
                type: mapNominatimType(item.type, item.class),
                address: item.display_name.split(',').slice(1, 3).join(',').trim(),
                latitude: parseFloat(item.lat),
                longitude: parseFloat(item.lon),
                averageRating: 0,
                tags: [],
                status: 'ACTIVE',
                isGlobal: true
              }))
          }
        } catch (e) { console.error('Nominatim nearby error:', e) }
      }

      const allSpots = [...dbSpots, ...globalSpots]
      setSpots(allSpots)
      const dbCount = dbSpots.length
      const globalCount = globalSpots.length
      let statusMsg = `${allSpots.length} spot${allSpots.length === 1 ? '' : 's'} found`
      if (globalCount > 0) statusMsg += ` (${dbCount} from Radach, ${globalCount} nearby)`
      statusMsg += '.'
      setStatus(statusMsg)
      if (allSpots.length) setBounds(allSpots.map(s => [s.latitude, s.longitude]))
    } catch (e) { setStatus(e.message) }
  }, [apiFetch, searchMode, sortBy, lat, lng, radius, place])

  const handleLocateMe = () => {
    setStatus('Getting your location...')
    setSuggestions([])

    const fallbackToIpLocation = async (reason) => {
      setStatus(`HTML5 Geolocation unavailable (${reason}). Trying IP-based location...`)
      try {
        const res = await fetch('https://get.geojs.io/v1/ip/geo.json')
        const data = await res.json()
        if (data.latitude && data.longitude) {
          const uLat = parseFloat(data.latitude)
          const uLng = parseFloat(data.longitude)
          setLat(uLat)
          setLng(uLng)
          setRadius('10')
          setPlace(data.city || 'Your location')
          setStatus(`Showing spots near ${data.city || 'your region'} (IP-based estimate).`)
          loadSpots({ lat: uLat, lng: uLng, radiusKm: '10' })
        } else {
          throw new Error('Invalid IP data')
        }
      } catch {
        setStatus('Unable to retrieve location. HTML5 Geolocation requires HTTPS, and IP fallback failed.')
        setSpots([])
      }
    }

    if (!navigator.geolocation) {
      fallbackToIpLocation('Requires HTTPS or localhost')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const uLat = pos.coords.latitude
        const uLng = pos.coords.longitude
        setLat(uLat)
        setLng(uLng)
        setRadius('10')
        setPlace('Your location')
        setStatus('Showing spots near you.')
        loadSpots({ lat: uLat, lng: uLng, radiusKm: '10' })
      },
      (err) => {
        fallbackToIpLocation(err.message || 'Permission denied')
      },
      { timeout: 5000, maximumAge: 60000 }
    )
  }

  const handleClearSearch = () => {
    setPlace('')
    setLat('')
    setLng('')
    setRadius('')
    setSuggestions([])
    setStatus('Loading spots...')
    loadSpots({ lat: '', lng: '', radiusKm: '', search: '' })
  }

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    const pLat = searchParams.get('lat'), pLng = searchParams.get('lng'), pR = searchParams.get('radiusKm'), pSort = searchParams.get('sortBy') || 'popularity'
    const pMode = searchParams.get('mode') || 'place' // default to place search
    const pQ = searchParams.get('q')

    if (pQ && pMode === 'place') {
      // Place search by keyword from URL
      loadSpots({ search: pQ, sortBy: pSort, mode: pMode })
    } else if (pLat && pLng && pR && pMode === 'nearby') {
      // Nearby search with radius
      loadSpots({ lat: pLat, lng: pLng, radiusKm: pR, sortBy: pSort, mode: pMode })
    } else if (pLat && pLng && pMode === 'place') {
      // Place search by coordinates from URL
      loadSpots({ lat: pLat, lng: pLng, sortBy: pSort, mode: pMode })
    } else {
      // Default search - load popular spots
      loadSpots({ sortBy: pSort, mode: pMode })
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Computed status text to avoid setState-in-effect lint warning
  const getStatusText = () => {
    if (status.endsWith('found.') || status.includes('spot found') || status.includes('spots found')) {
      let msg = `${filteredSpots.length} spot${filteredSpots.length === 1 ? '' : 's'} found`
      if (spots.length > 0) {
        const globalCount = spots.filter(s => s.isGlobal).length
        if (globalCount > 0) {
          msg += ` (${filteredSpotCounts.db} from Radach, ${filteredSpotCounts.global} nearby)`
        }
      }
      msg += '.'
      return msg
    }
    return status
  }

  // Place autocomplete - search existing spots for suggestions
  const handlePlaceInput = (q) => {
    setPlace(q)
    clearTimeout(geocodeTimer.current)
    suggestionsAbort.current?.abort()
    const requestId = ++suggestionsRequestId.current
    if (q.length < 2) {
      setSuggestions([]);
      return
    }
    geocodeTimer.current = setTimeout(async () => {
      const controller = new AbortController()
      suggestionsAbort.current = controller
      try {
        let combinedSuggestions = []

        // 1. Fetch from local backend spots
        try {
          const res = await apiFetch(`/api/v1/spots/search?q=${encodeURIComponent(q)}&limit=5`, {
            signal: controller.signal,
          })
          const data = await res.json()
          if (res.ok && data?.length > 0) {
            combinedSuggestions = [...data]
          }
        } catch (e) {
          if (e.name !== 'AbortError') console.error('Backend search error:', e)
        }

        // 2. Only fetch from Nominatim in 'nearby' mode (place mode = database only)
        if (searchMode === 'nearby') {
          try {
            const nomRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=3`, {
              headers: { 'Accept-Language': 'en' },
              signal: controller.signal,
            })
            const nomData = await nomRes.json()
            if (nomData?.length > 0) {
              const formatted = nomData.map(item => ({
                latitude: parseFloat(item.lat),
                longitude: parseFloat(item.lon),
                name: item.display_name.split(',')[0],
                type: 'City/Region',
                address: item.display_name,
                isCityDestination: true
              }))
              const existingNames = new Set(combinedSuggestions.map(s => s.name?.toLowerCase()))
              const uniqueFormatted = formatted.filter(f => !existingNames.has(f.name?.toLowerCase()))
              combinedSuggestions = [...combinedSuggestions, ...uniqueFormatted]
            }
          } catch (e) {
            if (e.name !== 'AbortError') console.error('Nominatim search error:', e)
          }
        }

        if (requestId === suggestionsRequestId.current && !controller.signal.aborted) {
          setSuggestions(combinedSuggestions)
        }
      } catch (error) {
        if (error.name === 'AbortError') return
        console.error('Error fetching suggestions:', error)
        if (requestId === suggestionsRequestId.current) setSuggestions([])
      }
    }, 250)
  }

  const selectSuggestion = (spot) => {
    setPlace(spot.name)
    setLat(spot.latitude)
    setLng(spot.longitude)
    setSuggestions([])
    if (spot.isCityDestination) {
      setRadius('50')
      loadSpots({ lat: spot.latitude, lng: spot.longitude, radiusKm: '50', sortBy })
    } else if (searchMode === 'nearby' && radius) {
      // In nearby mode with radius set, do a nearby search around the selected location
      loadSpots({ lat: spot.latitude, lng: spot.longitude, radiusKm: radius, sortBy, mode: 'nearby' })
    } else {
      // Load and display ONLY this specific spot
      setRadius('')
      setStatus('Loading spot details...')
      apiFetch(`/api/v1/spots/${spot.id}`)
        .then(res => res.json())
        .then(data => {
          setSpots([data])
          setStatus('1 spot found.')
          setBounds([[data.latitude, data.longitude]])
        })
        .catch(err => {
          console.error(err)
          setSpots([spot])
          setStatus('1 spot found.')
          setBounds([[spot.latitude, spot.longitude]])
        })
    }
  }

  const handleSearch = async () => {
    if (searchMode === 'nearby') {
      if (!lat || !lng || !radius) {
        setStatus('Search for a place first, then set a radius.')
        return
      }
      loadSpots({ lat, lng, radiusKm: radius, sortBy })
    } else {
      // Place mode: database-only search
      const query = place.trim()
      if (!query) {
        setStatus('Enter a place name to search.')
        return
      }

      setStatus('Searching...')
      setSuggestions([])

      // In place mode, only search the database — no Nominatim
      setLat('')
      setLng('')
      setRadius('')
      loadSpots({ search: query, lat: '', lng: '', radiusKm: '', mode: 'place' })
    }
  }



  return (
    <div className="spots-page">
      <div className="spots-map">
        {/* Unified Search & Location Bar */}
        <div className="map-search-container">
          <div className="map-search-bar-wrapper">
            <input
              className="input map-search-input"
              value={place}
              onChange={e => handlePlaceInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
              placeholder="Search spots or cities..."
              autoComplete="off"
            />
            
            {/* Clear Button (rendered unconditionally for smooth transitions & stable positioning) */}
            <button
              type="button"
              className={`map-search-icon-btn clear-btn${(place || lat || lng) ? ' active' : ''}`}
              onClick={handleClearSearch}
              title="Clear search & location"
              aria-label="Clear search"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>

            {/* Search Action Button */}
            <button
              type="button"
              className="map-search-icon-btn search-btn"
              onClick={handleSearch}
              title="Search"
              aria-label="Search"
            >
              <img src="/icons/fluent--search-16-regular.svg" alt="Search" />
            </button>

            {/* Options Ellipsis Button */}
            <button
              type="button"
              className="map-search-icon-btn options-btn"
              onClick={() => setSearchModeDropdownOpen(!searchModeDropdownOpen)}
              title="Search mode options"
              aria-label="Search options"
            >
              <img src="/icons/stash--ellipsis-v-light.svg" alt="Options" />
            </button>

            {suggestions.length > 0 && (
              <div className="suggestions-dropdown">
                {suggestions.map((s, i) => (
                  <div
                    key={i}
                    className="suggestion-item"
                    onClick={() => selectSuggestion(s)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}
                  >
                    <div className="suggestion-icon" style={{ display: 'flex', alignItems: 'center', opacity: 0.6, color: 'var(--text-secondary)' }}>
                      {s.isCityDestination ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
                          <line x1="9" y1="22" x2="9" y2="16"></line>
                          <line x1="15" y1="22" x2="15" y2="16"></line>
                          <line x1="9" y1="16" x2="15" y2="16"></line>
                          <path d="M8 6h2v2H8V6zm0 4h2v2H8v-2zm8-4h2v2h-2V6zm0 4h2v2h-2v-2z"></path>
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                          <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                      )}
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

          {/* Locate Me Button */}
          <button
            type="button"
            className="locate-me-btn glass-btn"
            onClick={handleLocateMe}
            title="Locate me / Near me"
            aria-label="Locate me"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <circle cx="12" cy="12" r="3"></circle>
              <line x1="12" y1="1" x2="12" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="23"></line>
              <line x1="1" y1="12" x2="3" y2="12"></line>
              <line x1="21" y1="12" x2="23" y2="12"></line>
            </svg>
          </button>

          {/* Mode popup on right side of search bar (same level) */}
          {searchModeDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: '0',
                left: '100%',
                marginLeft: '0.5rem',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                zIndex: 1001,
                minWidth: '180px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.75rem' }}>
                <input
                  type="radio"
                  checked={searchMode === 'place'}
                  onChange={() => { setSearchMode('place'); setSearchModeDropdownOpen(false) }}
                  style={{ width: '14px', height: '14px', accentColor: 'var(--text-primary)' }}
                />
                <span>Place</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.75rem' }}>
                <input
                  type="radio"
                  checked={searchMode === 'nearby'}
                  onChange={() => { setSearchMode('nearby'); setSearchModeDropdownOpen(false) }}
                  style={{ width: '14px', height: '14px', accentColor: 'var(--text-primary)' }}
                />
                <span>Nearby</span>
              </label>
              {/* Radius input - always visible in popup */}
              <div style={{ padding: '0.35rem 0.75rem', borderTop: '1px solid var(--border)', marginTop: '0.25rem' }}>
                <label className="label" style={{ marginBottom: '0.15rem', fontSize: '0.65rem' }}>Radius (km)</label>
                <input
                  className="input"
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={radius}
                  onChange={e => setRadius(e.target.value)}
                  placeholder="5"
                  style={{ width: '80px', fontSize: '0.75rem', padding: '0.3rem 0.5rem' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Category filter button (moved to top right) */}
        <div className="map-filter-container" style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 500 }}>
          <button
            className="btn btn-primary"
            onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
            style={{ whiteSpace: 'nowrap', padding: '0.5rem 1rem' }}
          >
            Categories
          </button>
          {filterDropdownOpen && (
            <div className="map-filter-dropdown" style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem', minWidth: '200px', zIndex: 1000 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                <input
                  type="checkbox"
                  checked={selectedCategories.all}
                  onChange={() => toggleCategory('all')}
                  style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--text-primary)' }}
                />
                <span>All</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
                {categoriesList.map(cat => {
                  const norm = cat.name.trim().toLowerCase().replace('é', 'e')
                  return (
                    <label key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500' }}>
                      <input
                        type="checkbox"
                        checked={!!selectedCategories[norm]}
                        onChange={() => toggleCategory(norm)}
                        style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--text-primary)' }}
                      />
                      <img src={cat.iconUrl || '/icons/stash--pin-location-light.svg'} alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} />
                      <span>{cat.name}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <MapContainer
          center={[13.7563, 100.5018]}
          zoom={11}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false} /* Disable default zoom controls to customize position */
        >
          <TileLayer
            url={`https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key=${import.meta.env.VITE_STADIA_API_KEY}`}
            attribution='Map tiles by <a href="https://stadiamaps.com/">Stadia Maps</a>, <a href="https://openmaptiles.org/">OpenMapTiles</a>, and <a href="http://openstreetmap.org">OpenStreetMap</a> contributors'
          />
          <MarkerClusterGroup spots={filteredSpots} createIcon={createMarkerIcon} />
          {lat && lng && radius && (
            <Circle center={[parseFloat(lat), parseFloat(lng)]} radius={parseFloat(radius) * 1000}
              pathOptions={{ color: 'var(--border-color)', fillColor: 'var(--border-color)', fillOpacity: 0.08, weight: 2 }} />
          )}
          <FitBounds bounds={bounds} />
          {/* Custom zoom controls at bottom left - using useMap hook */}
          <ZoomControls />
        </MapContainer>
      </div>

      <div className="spots-sidebar">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', marginBottom: '1rem' }}>
          <p className="spots-status" style={{ margin: 0 }}>{getStatusText()}</p>
          <select className="input select" style={{ width: 'auto', padding: '0.4rem 2.5rem 0.4rem 1rem' }}
            value={sortBy}
            onChange={e => {
              const newSort = e.target.value
              setSortBy(newSort)
              loadSpots({
                lat: lat || undefined,
                lng: lng || undefined,
                radiusKm: radius || undefined,
                sortBy: newSort
              })
            }}
          >
            <option value="popularity"> Trending (Global)</option>
            <option value="trending_friends"> Trending (Friends)</option>
            <option value="trending_experts"> Trending (Experts)</option>
            <option value="distance" disabled={!(lat && lng && radius)}> Distance</option>
          </select>
        </div>



        <SpotResultsList filteredSpots={filteredSpots} status={status} />
      </div>
    </div>
  )
}
