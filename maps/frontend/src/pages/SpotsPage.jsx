import { useState, useEffect, useRef, useCallback } from 'react'
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

// Fix default marker icon
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

function FitBounds({ bounds }) {
  const map = useMap()
  useEffect(() => {
    if (bounds?.length) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 })
  }, [bounds, map])
  return null
}

export default function SpotsPage() {
  const { apiFetch } = useApi()
  const [spots, setSpots] = useState([])
  const [status, setStatus] = useState('Loading spots...')
  const [searchParams] = useSearchParams()
  const [searchMode, setSearchMode] = useState('place')

  // Zoom controls component using useMap hook
  const ZoomControls = () => {
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

  // Geo search state
  const [place, setPlace] = useState('')
  const [lat, setLat] = useState(searchParams.get('lat') || '')
  const [lng, setLng] = useState(searchParams.get('lng') || '')
  const [radius, setRadius] = useState(searchParams.get('radiusKm') || '')
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'popularity')
  const [suggestions, setSuggestions] = useState([])
  const [bounds, setBounds] = useState([])
  const geocodeTimer = useRef(null)

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

  const filteredSpots = spots.filter(spot => {
    const normalized = (spot.type || '').trim().toLowerCase().replace('é', 'e')
    return selectedCategories[normalized]
  })

   const loadSpots = useCallback(async (filters) => {
    setStatus('Loading spots...')
    const params = new URLSearchParams()
    
    const modeToUse = filters?.mode || searchMode;

    // Handle different search modes
    if (modeToUse === 'nearby' && filters?.lat && filters?.lng && filters?.radiusKm) {
      // Nearby search by radius
      params.set('lat', filters.lat)
      params.set('lng', filters.lng)
      params.set('radiusKm', filters.radiusKm)
    } else if (modeToUse === 'place' && filters?.search) {
      // Place search by keyword
      params.set('q', filters.search)
    } else if (modeToUse === 'place' && filters?.lat && filters?.lng) {
      // Place search by coordinates (fallback)
      params.set('lat', filters.lat)
      params.set('lng', filters.lng)
    }
    
    params.set('sortBy', filters?.sortBy || sortBy)
    try {
      let dbSpots = []

      // 1. Always fetch from our database
      let path = '/api/v1/spots'
      if (modeToUse === 'place' && filters?.search) {
        path = '/api/v1/spots/search'
      }
      const queryString = params.toString()
      const finalPath = queryString ? `${path}?${queryString}` : path
      try {
        const res = await apiFetch(finalPath)
        const data = await res.json()
        if (res.ok) dbSpots = data
      } catch (e) { console.error('DB spots error:', e) }

      // 2. If nearby mode, also fetch global POIs from Nominatim
      let globalSpots = []
      if (modeToUse === 'nearby' && filters?.lat && filters?.lng && filters?.radiusKm) {
        try {
          // Use Nominatim reverse geocoding to find POIs around the location
          const radiusMeters = parseFloat(filters.radiusKm) * 1000
          const lat = parseFloat(filters.lat)
          const lng = parseFloat(filters.lng)
          // Calculate a bounding box from lat/lng and radius
          const latDelta = radiusMeters / 111320
          const lngDelta = radiusMeters / (111320 * Math.cos(lat * Math.PI / 180))
          const viewbox = `${lng - lngDelta},${lat + latDelta},${lng + lngDelta},${lat - latDelta}`
          
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
  }, [apiFetch, searchMode, sortBy])

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

  useEffect(() => {
    const pLat = searchParams.get('lat'), pLng = searchParams.get('lng'), pR = searchParams.get('radiusKm'), pSort = searchParams.get('sortBy') || 'popularity'
    const pMode = searchParams.get('mode') || 'place' // default to place search
    const pQ = searchParams.get('q')
    setSearchMode(pMode)
    
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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update status message based on filtered spots
  useEffect(() => {
    if (spots.length === 0) return
    setStatus(`${filteredSpots.length} spot${filteredSpots.length === 1 ? '' : 's'} found.`)
  }, [filteredSpots, spots.length])

  // Geocode a place name to get lat/lng
  const geocodePlace = useCallback(async (query) => {
    if (!query || query.length < 2) return
    
    setStatus(`Searching for "${query}"...`)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`, { 
        headers: { 'Accept-Language': 'en' } 
      })
      const data = await res.json()
      if (data && data.length > 0) {
        const result = data[0]
        setLat(result.lat)
        setLng(result.lon)
        setPlace(result.display_name)
        // Load spots for this location - if nearby mode, include radius
        if (searchMode === 'nearby' && radius) {
          loadSpots({ lat: result.lat, lng: result.lon, radiusKm: radius, sortBy, mode: 'nearby' })
        } else {
          loadSpots({ lat: result.lat, lng: result.lon, sortBy })
        }
      } else {
        setStatus('Place not found. Try a different search.')
      }
    } catch (e) {
      setStatus('Error searching for place.')
    }
  }, [loadSpots, sortBy, searchMode, radius])

  // Place autocomplete - search existing spots for suggestions
  const handlePlaceInput = (q) => {
    setPlace(q)
    clearTimeout(geocodeTimer.current)
    if (q.length < 2) { 
      setSuggestions([]); 
      return 
    }
    geocodeTimer.current = setTimeout(async () => {
      try {
        let combinedSuggestions = []

        // 1. Fetch from local backend spots
        try {
          const res = await apiFetch(`/api/v1/spots/search?q=${encodeURIComponent(q)}&limit=5`)
          const data = await res.json()
          if (res.ok && data?.length > 0) {
            combinedSuggestions = [...data]
          }
        } catch (e) { console.error('Backend search error:', e) }

        // 2. Also fetch from Nominatim for global locations (especially useful in nearby mode)
        if (searchMode === 'nearby') {
          try {
            const nomRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=3`, {
              headers: { 'Accept-Language': 'en' }
            })
            const nomData = await nomRes.json()
            if (nomData?.length > 0) {
              const formatted = nomData.map(item => ({
                latitude: parseFloat(item.lat),
                longitude: parseFloat(item.lon),
                name: item.display_name.split(',')[0],
                type: 'Global Location',
                address: item.display_name,
                isGlobal: true
              }))
              const existingNames = new Set(combinedSuggestions.map(s => s.name?.toLowerCase()))
              const uniqueFormatted = formatted.filter(f => !existingNames.has(f.name?.toLowerCase()))
              combinedSuggestions = [...combinedSuggestions, ...uniqueFormatted]
            }
          } catch (e) { console.error('Nominatim search error:', e) }
        }

        setSuggestions(combinedSuggestions)
      } catch (error) {
        console.error('Error fetching suggestions:', error)
        setSuggestions([])
      }
    }, searchMode === 'nearby' ? 800 : 300) // Longer debounce for nearby to respect Nominatim rate limits
  }

  const selectSuggestion = (spot) => {
    setPlace(spot.name)
    setLat(spot.latitude)
    setLng(spot.longitude)
    setSuggestions([])
    if (searchMode === 'nearby' && radius) {
      // In nearby mode with radius set, do a nearby search around the selected location
      loadSpots({ lat: spot.latitude, lng: spot.longitude, radiusKm: radius, sortBy, mode: 'nearby' })
    } else {
      // Load spots for this location
      loadSpots({ lat: spot.latitude, lng: spot.longitude, sortBy })
    }
  }

  const handleSearch = () => {
    if (searchMode === 'nearby') {
      if (!lat || !lng || !radius) { 
        setStatus('Search for a place first, then set a radius.'); 
        return 
      }
      loadSpots({ lat, lng, radiusKm: radius, sortBy })
    } else {
      // Place search mode - search by keyword
      if (!place) {
        setStatus('Enter a place to search.');
        return;
      }
      loadSpots({ search: place, sortBy })
    }
  }



return (
      <div className="spots-page">
        <div className="spots-map">
          {/* Search bar at top left of map */}
          <div 
            className="map-search-bar" 
            style={{ 
              position: 'absolute', 
              top: '1rem', 
              left: '1rem', 
              zIndex: 500, 
              display: 'flex', 
              gap: '0.5rem',
              alignItems: 'flex-start'
            }}
          >
            <div 
              style={{ 
                position: 'relative', 
                flex: 1, 
                minWidth: 300 
              }}
            >
              <input 
                className="input"
                value={place}
                onChange={e => handlePlaceInput(e.target.value)}
                placeholder="Search for a place..."
                autoComplete="off"
                style={{ paddingLeft: '12px', paddingRight: '80px' }}
              />
              {/* Search icon embedded on right side (clickable) */}
              <button
                type="button"
                onClick={handleSearch}
                style={{
                  position: 'absolute',
                  right: '44px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  padding: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.6,
                  zIndex: 1
                }}
                aria-label="Search"
              >
                <img src="/icons/fluent--search-16-regular.svg" alt="Search" style={{ width: '18px', height: '18px' }} />
              </button>
              {/* Ellipsis icon embedded on rightmost side */}
              <button
                type="button"
                onClick={() => setSearchModeDropdownOpen(!searchModeDropdownOpen)}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  padding: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.6,
                  zIndex: 1
                }}
                aria-label="Search options"
              >
                <img src="/icons/stash--ellipsis-v-light.svg" alt="Options" style={{ width: '18px', height: '18px' }} />
              </button>
              {suggestions.length > 0 && (
                <div 
                  className="suggestions-dropdown" 
                  style={{ 
                    position: 'absolute', 
                    top: '100%', 
                    left: 0, 
                    right: 0, 
                    marginTop: '0.25rem', 
                    background: 'var(--bg-surface)', 
                    border: '1px solid var(--border)', 
                    borderRadius: 'var(--radius-md)', 
                    zIndex: 1000 
                  }}
                >
                  {suggestions.map((s, i) => (
                    <div 
                      key={i} 
                      className="suggestion-item" 
                      onClick={() => selectSuggestion(s)}
                    >
                      <div className="suggestion-name">{s.name}</div>
                      <div className="suggestion-full">{s.type} · {s.address}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
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
             {filteredSpots.map(s => (
                <Marker key={s.id} position={[s.latitude, s.longitude]} icon={createMarkerIcon(s.type)}>
                  <Popup>
                    <strong>{s.name}</strong>{s.isGlobal && <span style={{ fontSize: '0.7rem', color: '#888', marginLeft: '4px' }}>🌐</span>}<br />
                    <span style={{ color: 'var(--star)' }}>{s.averageRating > 0 ? ` ${s.averageRating.toFixed(1)}` : s.isGlobal ? 'Global spot' : 'No ratings'}</span><br />
                    {s.type} · {s.address}<br />
                    {!s.isGlobal && <a href={`/spot/${s.id}`}>View details →</a>}
                  </Popup>
                </Marker>
              ))}
             {lat && lng && radius && searchMode === 'nearby' && (
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
            <p className="spots-status" style={{ margin: 0 }}>{status}</p>
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
              <option value="popularity"> Popularity</option>
              <option value="distance" disabled={!(lat && lng && radius)}> Distance</option>
            </select>
          </div>
          
          <div className="spots-list">
            {filteredSpots.length === 0 && status && !status.includes('Loading') && (
              <div className="empty-state">No spots found.</div>
            )}
            {filteredSpots.map(s => (
              s.isGlobal ? (
                <article key={s.id} className="spot-card glass" style={{ cursor: 'default' }}>
                  <div className="spot-card-header">
                    <div className="spot-card-title">
                      <img src="/icons/stash--pin-location-light.svg" alt={`${s.type} icon`} className="spot-card-type-icon" />
                      <div>
                        <h3 className="spot-card-name">{s.name} <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 400 }}>🌐 Global</span></h3>
                        <p className="spot-card-meta">{s.type} · {s.address}</p>
                      </div>
                    </div>
                  </div>
                </article>
              ) : (
                <SpotCard key={s.id} spot={s} />
              )
            ))}
          </div>
        </div>
      </div>
    )
  }
