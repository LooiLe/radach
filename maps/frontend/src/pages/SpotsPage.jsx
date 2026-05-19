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
      let path = '/api/v1/spots'
      if (modeToUse === 'place' && filters?.search) {
        path = '/api/v1/spots/search'
      }
      const queryString = params.toString()
      const finalPath = queryString ? `${path}?${queryString}` : path
      const res = await apiFetch(finalPath)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load spots.')
      setSpots(data)
      setStatus(`${data.length} spot${data.length === 1 ? '' : 's'} found.`)
      if (data.length) setBounds(data.map(s => [s.latitude, s.longitude]))
    } catch (e) { setStatus(e.message) }
  }, [apiFetch, searchMode, sortBy])

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
        // Load spots for this location
        loadSpots({ lat: result.lat, lng: result.lon, sortBy: sortBy })
      } else {
        setStatus('Place not found. Try a different search.')
      }
    } catch (e) {
      setStatus('Error searching for place.')
    }
  }, [loadSpots, sortBy])

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
        // Use our own spots API for suggestions instead of Nominatim
        const res = await apiFetch(`/api/v1/spots/search?q=${encodeURIComponent(q)}&limit=5`)
        const data = await res.json()
        if (res.ok) {
          setSuggestions(data || [])
        } else {
          setSuggestions([])
        }
      } catch (error) {
        console.error('Error fetching suggestions:', error)
        setSuggestions([])
      }
    }, 300)
  }

  const selectSuggestion = (spot) => {
    setPlace(spot.name)
    setLat(spot.latitude)
    setLng(spot.longitude)
    setSuggestions([])
    // Load spots for this location
    loadSpots({ lat: spot.latitude, lng: spot.longitude, sortBy })
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
                gap: '0.5rem' 
              }}
            >
              <div 
                style={{ 
                  position: 'relative', 
                  flex: 1, 
                  minWidth: 200 
                }}
              >
                <input 
                  className="input"
                  value={place}
                  onChange={e => handlePlaceInput(e.target.value)}
                  placeholder="Search for a place..."
                  autoComplete="off"
                />
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
            
            {/* Mode toggle */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={searchMode === 'place'}
                  onChange={() => setSearchMode('place')}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--text-primary)' }}
                />
                <span>Place</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  checked={searchMode === 'nearby'}
                  onChange={() => setSearchMode('nearby')}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--text-primary)' }}
                />
                <span>Nearby</span>
              </label>
              {searchMode === 'nearby' && (
                <div style={{ marginTop: '0.25rem' }}>
                  <label className="label" style={{ marginBottom: '0.25rem', fontSize: '0.7rem' }}>Radius (km)</label>
                  <input
                    className="input"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={radius}
                    onChange={e => setRadius(e.target.value)}
                    placeholder="5"
                    style={{ width: '80px' }}
                  />
                </div>
              )}
            </div>
            
             <button 
               className="btn btn-primary"
               onClick={handleSearch}
               style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
             >
               Search
             </button>
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
                   <strong>{s.name}</strong><br />
                   <span style={{ color: 'var(--star)' }}>{s.averageRating > 0 ? ` ${s.averageRating.toFixed(1)}` : 'No ratings'}</span><br />
                   {s.type} · {s.address}<br />
                   <a href={`/spot/${s.id}`}>View details →</a>
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
            {filteredSpots.map(s => <SpotCard key={s.id} spot={s} />)}
          </div>
        </div>
      </div>
    )
  }
