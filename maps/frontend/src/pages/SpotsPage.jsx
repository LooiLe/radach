import { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { MapContainer, TileLayer, Circle, useMap, useMapEvents } from 'react-leaflet'
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
  hotel: '/icons/material-symbols-light--hotel-outline-rounded.svg',
  cafe: '/icons/carbon--cafe.svg',
  'food hall': '/icons/material-symbols-light--chef-hat-outline.svg',
  beach: '/icons/streamline-plump--beach.svg',
  market: '/icons/material-symbols-light--attractions-outline-rounded.svg',
  attraction: '/icons/material-symbols-light--attractions-outline-rounded.svg',
  attractions: '/icons/material-symbols-light--attractions-outline-rounded.svg',
  viewpoints: '/icons/game-icons--hill-conquest.svg',
  viewpoint: '/icons/game-icons--hill-conquest.svg',
  sport: '/icons/solar--football-linear.svg',
  market: '/icons/healthicons--market-stall-outline.svg',
  default: '/icons/stash--pin-location-light.svg',
}

function createMarkerIcon(type) {
  const normalized = (type || '').toString().trim().toLowerCase().replace('é', 'e')
  const icon = dynamicIconMap[normalized] || dynamicIconMap.default
  return new L.DivIcon({
    html: `<div class="custom-map-marker"><img src="${icon}" alt="${type || 'Spot'}" /></div>`,
    className: 'custom-leaflet-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  })
}

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
      const marker = L.marker([s.latitude, s.longitude], { icon: createIcon(s.type) })
      const popupHtml = document.createElement('div')
      popupHtml.innerHTML = `
        <strong>${s.name}</strong><br />
        <span style="color: var(--star);">${s.averageRating > 0 ? '★ ' + s.averageRating.toFixed(1) : 'No ratings'}</span><br />
        ${s.type}<br />
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
  const [bounds, setBounds] = useState([])
  const geocodeTimer = useRef(null)
  const suggestionsAbort = useRef(null)
  const suggestionsRequestId = useRef(0)
  const viewportRequestId = useRef(0)
  const mapInstanceRef = useRef(null)
  const [page, setPage] = useState(0)

  const [ratingMode, setRatingMode] = useState(() => searchParams.get('mode') || 'global')
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
            if (c.iconUrl) dynamicIconMap[norm] = c.iconUrl
          })
          setSelectedCategories(selMap)
        }
      } catch { /* ignore */ }
    }
    fetchCatList()
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

  const visibleMapSpots = useMemo(() => {
    const anySelected = Object.keys(selectedCategories).some(k => k !== 'all' && selectedCategories[k])
    if (!anySelected) return []
    return mapSpots.filter(spot => {
      const normalized = (spot.type || '').trim().toLowerCase().replace('é', 'e')
      return selectedCategories[normalized]
    })
  }, [mapSpots, selectedCategories])

  // Pagination: 50 per page
  const pageSize = 50
  const totalPages = Math.max(1, Math.ceil(visibleMapSpots.length / pageSize))
  const currentPage = Math.min(page, totalPages - 1)
  const pagedSpots = useMemo(() => {
    const start = currentPage * pageSize
    return visibleMapSpots.slice(start, start + pageSize)
  }, [visibleMapSpots, currentPage, pageSize])

  const getActiveMapType = useCallback(() => {
    const selected = Object.keys(selectedCategories).filter(k => k !== 'all' && selectedCategories[k])
    if (selected.length === 1) return selected[0]
    return null
  }, [selectedCategories])

  const loadMapViewport = useCallback(async (map) => {
    if (!map || place || lat || lng) return
    const requestId = ++viewportRequestId.current
    const mapBounds = map.getBounds()
    const params = new URLSearchParams({
      swLat: mapBounds.getSouth().toFixed(6),
      swLng: mapBounds.getWest().toFixed(6),
      neLat: mapBounds.getNorth().toFixed(6),
      neLng: mapBounds.getEast().toFixed(6),
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
  }, [apiFetch, place, lat, lng, getActiveMapType, ratingMode])

  const isInitialCategoryLoad = useRef(true)
  useEffect(() => {
    if (isInitialCategoryLoad.current) { isInitialCategoryLoad.current = false; return }
    if (mapInstanceRef.current && !place && !lat && !lng) {
      setPage(0)
      loadMapViewport(mapInstanceRef.current)
    }
  }, [selectedCategories, loadMapViewport, place, lat, lng])

  const handleClearSearch = () => {
    setPlace(''); setLat(''); setLng(''); setRadius(''); setSuggestions([]); setBounds([]); setMapSpots([]); setPage(0)
    setStatus('Loading map spots...')
    if (mapInstanceRef.current) loadMapViewport(mapInstanceRef.current)
  }

  useEffect(() => {}, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePlaceInput = (q) => {
    setPlace(q)
    clearTimeout(geocodeTimer.current); suggestionsAbort.current?.abort()
    const requestId = ++suggestionsRequestId.current
    if (q.length < 2) { setSuggestions([]); return }
    geocodeTimer.current = setTimeout(async () => {
      const controller = new AbortController(); suggestionsAbort.current = controller
      try {
        let combinedSuggestions = []
        try {
          const res = await apiFetch(`/api/v1/spots/search?q=${encodeURIComponent(q)}&limit=5`, { signal: controller.signal })
          const data = await res.json()
          if (res.ok && data?.length > 0) combinedSuggestions = [...data]
        } catch (e) { if (e.name !== 'AbortError') console.error(e) }
        if (requestId === suggestionsRequestId.current && !controller.signal.aborted) setSuggestions(combinedSuggestions)
      } catch (error) { if (error.name !== 'AbortError' && requestId === suggestionsRequestId.current) setSuggestions([]) }
    }, 250)
  }

  const selectSuggestion = (spot) => {
    setPlace(spot.name); setLat(spot.latitude); setLng(spot.longitude); setSuggestions([]); setPage(0)
    if (spot.isCityDestination) {
      setRadius(radius || '50')
    } else if (searchMode === 'nearby' && radius) {
      // keep radius
    } else {
      setRadius(''); setStatus('1 spot found.'); setMapSpots([spot]); setMapTotal(1); setBounds([[spot.latitude, spot.longitude]])
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

  // Status text shows page info when paginating
  const statusText = useMemo(() => {
    if (status.includes('Loading')) return status
    if (totalPages > 1) {
      const start = currentPage * pageSize + 1
      const end = Math.min((currentPage + 1) * pageSize, visibleMapSpots.length)
      return `Showing page ${currentPage + 1} of ${totalPages} (spots ${start.toLocaleString()}-${end.toLocaleString()} of ${mapTotal.toLocaleString()})`
    }
    if (visibleMapSpots.length === 0 && !status.includes('spots in view')) return status
    return `Showing ${visibleMapSpots.length.toLocaleString()} of ${mapTotal.toLocaleString()} spots in view${mapLimited ? '' : '.'}`
  }, [status, visibleMapSpots.length, mapTotal, mapLimited, totalPages, currentPage, pageSize])

  // Page numbers for pagination — max 5 pages
  const pageNumbers = useMemo(() => {
    if (totalPages <= 1) return []
    const maxVisible = 5
    const pages = []
    let start = Math.max(0, currentPage - Math.floor(maxVisible / 2))
    let end = Math.min(totalPages, start + maxVisible)
    if (end - start < maxVisible) start = Math.max(0, end - maxVisible)
    for (let i = start; i < end; i++) pages.push(i)
    return pages
  }, [totalPages, currentPage])

  return (
    <div className="spots-page">
      <div className="spots-map">
        <div className="map-search-container">
          <div className="map-search-bar-wrapper">
            <input className="input map-search-input" value={place} onChange={e => handlePlaceInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleSearch() }} placeholder="Search spots or cities..." autoComplete="off" />
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
                <input type="radio" checked={searchMode === 'place'} onChange={() => { setSearchMode('place'); setSearchModeDropdownOpen(false) }} style={{ width: '14px', height: '14px', accentColor: 'var(--text-primary)' }} /><span>Place</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.75rem', cursor: 'pointer', fontSize: '0.75rem' }}>
                <input type="radio" checked={searchMode === 'nearby'} onChange={() => { setSearchMode('nearby'); setSearchModeDropdownOpen(false) }} style={{ width: '14px', height: '14px', accentColor: 'var(--text-primary)' }} /><span>Nearby</span>
              </label>
              <div style={{ padding: '0.35rem 0.75rem', borderTop: '1px solid var(--border)', marginTop: '0.25rem' }}>
                <label className="label" style={{ marginBottom: '0.15rem', fontSize: '0.65rem' }}>Radius (km)</label>
                <input className="input" type="number" min="0.1" step="0.1" value={radius} onChange={e => setRadius(e.target.value)} placeholder="5" style={{ width: '80px', fontSize: '0.75rem', padding: '0.3rem 0.5rem' }} />
              </div>
            </div>
          )}
        </div>

        <div className="map-filter-container" style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 500 }}>
          <button className="btn btn-primary" onClick={() => setFilterDropdownOpen(!filterDropdownOpen)} style={{ whiteSpace: 'nowrap', padding: '0.5rem 1rem' }}>Categories</button>
          {filterDropdownOpen && (
            <div className="map-filter-dropdown" style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem', minWidth: '200px', zIndex: 1000 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500', marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                <input type="checkbox" checked={selectedCategories.all} onChange={() => toggleCategory('all')} style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--text-primary)' }} /><span>All</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
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
            </div>
          )}
        </div>

        <MapContainer center={[7.8804, 98.3923]} zoom={12} style={{ width: '100%', height: '100%' }} zoomControl={false}>
          <TileLayer url={`https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key=${import.meta.env.VITE_STADIA_API_KEY}`}
            attribution='Map tiles by <a href="https://stadiamaps.com/">Stadia Maps</a>, <a href="https://openmaptiles.org/">OpenMapTiles</a>, and <a href="http://openstreetmap.org">OpenStreetMap</a> contributors' />
          <MapViewportLoader onViewportChange={loadMapViewport} onMapReady={(map) => { mapInstanceRef.current = map }} />
          <MarkerClusterGroup spots={visibleMapSpots} createIcon={createMarkerIcon} />
          {lat && lng && radius && (
            <Circle center={[parseFloat(lat), parseFloat(lng)]} radius={parseFloat(radius) * 1000}
              pathOptions={{ color: 'var(--border-color)', fillColor: 'var(--border-color)', fillOpacity: 0.08, weight: 2 }} />
          )}
          <FitBounds bounds={bounds} />
          <ZoomControls />
        </MapContainer>
      </div>

      <div className="spots-sidebar">
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', alignItems: 'center', marginTop: '1.5rem', marginBottom: '0.5rem' }}>
          <RatingModeSelector mode={ratingMode} onChange={(m) => {
            setRatingMode(m)
            // Re-fetch map with new mode
            if (mapInstanceRef.current && !place && !lat && !lng) {
              setPage(0)
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
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.2rem', padding: '0.2rem 0 0.4rem', whiteSpace: 'nowrap', overflowX: 'visible', borderBottom: '1px solid var(--border)', marginBottom: '0.5rem' }}>
            <button className="btn btn-ghost" onClick={() => setPage(0)} disabled={currentPage === 0} style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem', flexShrink: 0 }}>«</button>
            <button className="btn btn-ghost" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 0} style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem', flexShrink: 0 }}>‹</button>
            {pageNumbers.map(p => (
              <button key={p}
                className={`btn ${p === currentPage ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setPage(p)}
                style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem', minWidth: '24px', flexShrink: 0 }}
              >{p + 1}</button>
            ))}
            <button className="btn btn-ghost" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= totalPages - 1} style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem', flexShrink: 0 }}>›</button>
            <button className="btn btn-ghost" onClick={() => setPage(totalPages - 1)} disabled={currentPage >= totalPages - 1} style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem', flexShrink: 0 }}>»</button>
          </div>
        )}
        <div className="spots-list">
          {pagedSpots.length === 0 && !status.includes('Loading') ? (
            <div className="empty-state">No spots in this area.</div>
          ) : (
            pagedSpots.map(s => <SpotCard key={s.id} spot={s} />)
          )}
        </div>
      </div>
    </div>
  )
}