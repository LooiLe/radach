import { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import { useSearchParams } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useApi } from '../hooks/useApi'
import SpotCard from '../components/SpotCard'
import './SpotsPage.css'

const markerIconMap = {
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
  const icon = markerIconMap[normalized] || markerIconMap.default
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
  const [selectedCategories, setSelectedCategories] = useState({
    all: true,
    restaurant: true,
    bar: true,
    hotel: true,
    cafe: true,
    'food hall': true,
    beach: true,
    market: true,
    viewpoint: true,
    activities: true,
    'dine & play': true,
    children: true,
    sport: true,
    trail: true,
    other: true,
  })

  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false)

  const categoryLabels = {
    all: 'All',
    restaurant: 'Restaurant',
    bar: 'Bar',
    hotel: 'Hotel',
    cafe: 'Café',
    'food hall': 'Food Hall',
    beach: 'Beach',
    market: 'Market',
    viewpoint: 'Viewpoint',
    activities: 'Activities',
    'dine & play': 'Dine & Play',
    children: 'Children',
    sport: 'Sport',
    trail: 'Trail',
    other: 'Other',
  }

  const categories = Object.keys(selectedCategories).filter(c => c !== 'all').map(c => ({
    id: c,
    label: categoryLabels[c],
  }))

  const toggleCategory = (categoryId) => {
    if (categoryId === 'all') {
      const allSelected = Object.values(selectedCategories).every(v => v === true)
      const newState = {}
      Object.keys(categoryLabels).forEach(key => {
        newState[key] = !allSelected
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
    if (filters?.lat && filters?.lng && filters?.radiusKm) {
      params.set('lat', filters.lat); params.set('lng', filters.lng); params.set('radiusKm', filters.radiusKm)
    }
    params.set('sortBy', filters?.sortBy || sortBy)
    try {
      const path = params.toString() ? `/api/v1/spots?${params}` : '/api/v1/spots'
      const res = await apiFetch(path)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load spots.')
      setSpots(data)
      setStatus(`${data.length} spot${data.length === 1 ? '' : 's'} found.`)
      if (data.length) setBounds(data.map(s => [s.latitude, s.longitude]))
    } catch (e) { setStatus(e.message) }
  }, [apiFetch])

  useEffect(() => {
    const pLat = searchParams.get('lat'), pLng = searchParams.get('lng'), pR = searchParams.get('radiusKm'), pSort = searchParams.get('sortBy') || 'popularity'
    if (pLat && pLng && pR) loadSpots({ lat: pLat, lng: pLng, radiusKm: pR, sortBy: pSort })
    else loadSpots({ sortBy: pSort })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update status message based on filtered spots
  useEffect(() => {
    if (spots.length === 0) return
    setStatus(`${filteredSpots.length} spot${filteredSpots.length === 1 ? '' : 's'} found.`)
  }, [filteredSpots, spots.length])

  // Place autocomplete
  const handlePlaceInput = (q) => {
    setPlace(q)
    clearTimeout(geocodeTimer.current)
    if (q.length < 3) { setSuggestions([]); return }
    geocodeTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`, { headers: { 'Accept-Language': 'en' } })
        const data = await res.json()
        setSuggestions(data || [])
      } catch { setSuggestions([]) }
    }, 300)
  }

  const selectSuggestion = (s) => {
    setPlace(s.display_name)
    setLat(s.lat); setLng(s.lon)
    setSuggestions([])
  }

  const handleSearch = () => {
    if (!lat || !lng || !radius) { setStatus('Search for a place first, then set a radius.'); return }
    loadSpots({ lat, lng, radiusKm: radius, sortBy })
  }

  const handleClear = () => {
    setPlace(''); setLat(''); setLng(''); setRadius(''); setSortBy('popularity')
    setSuggestions([]); loadSpots({ sortBy: 'popularity' })
  }

  return (
    <div className="spots-page">
      <div className="spots-map">
        <div className="map-filter-container" style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 500 }}>
          <button 
            className="btn btn-primary"
            onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
            style={{ whiteSpace: 'nowrap' }}>
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
                {categories.map(cat => (
                  <label key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500' }}>
                    <input
                      type="checkbox"
                      checked={selectedCategories[cat.id]}
                      onChange={() => toggleCategory(cat.id)}
                      style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--text-primary)' }}
                    />
                    <span>{cat.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <MapContainer center={[13.7563, 100.5018]} zoom={11} style={{ width: '100%', height: '100%' }}>
          <TileLayer
            url="https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors'
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
          {lat && lng && radius && (
            <Circle center={[parseFloat(lat), parseFloat(lng)]} radius={parseFloat(radius) * 1000}
              pathOptions={{ color: 'var(--border-color)', fillColor: 'var(--border-color)', fillOpacity: 0.08, weight: 2 }} />
          )}
          <FitBounds bounds={bounds} />
        </MapContainer>
      </div>

      <div className="spots-sidebar">
        <div className="spots-search glass">
          <div className="field" style={{ position: 'relative' }}>
            <label className="label">Search place</label>
            <input className="input" value={place} onChange={e => handlePlaceInput(e.target.value)}
              placeholder="e.g. Central Park, Bangkok" autoComplete="off"
              onFocus={() => suggestions.length && setSuggestions(suggestions)} />
            {suggestions.length > 0 && (
              <div className="suggestions-dropdown">
                {suggestions.map((s, i) => (
                  <div key={i} className="suggestion-item" onClick={() => selectSuggestion(s)}>
                    <div className="suggestion-name">{s.display_name.split(',')[0]}</div>
                    <div className="suggestion-full">{s.display_name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="geo-row">
            <span className="geo-display">{lat || 'Latitude'}</span>
            <span className="geo-display">{lng || 'Longitude'}</span>
          </div>
          <div className="field">
            <label className="label">Radius (km)</label>
            <input className="input" type="number" min="0.1" step="0.1" value={radius}
              onChange={e => setRadius(e.target.value)} placeholder="5" />
          </div>
          <div className="search-actions">
            <button className="btn btn-primary" onClick={handleSearch}> Search nearby</button>
            <button className="btn" onClick={handleClear}>Clear</button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', marginBottom: '1rem' }}>
          <p className="spots-status" style={{ margin: 0 }}>{status}</p>
          <select className="input select" style={{ width: 'auto', padding: '0.4rem 2.5rem 0.4rem 1rem' }} 
            value={sortBy} 
            onChange={e => {
              const newSort = e.target.value
              setSortBy(newSort)
              loadSpots({ lat, lng, radiusKm: radius, sortBy: newSort })
            }}>
            <option value="popularity"> Popularity</option>
            <option value="distance" disabled={!lat || !lng || !radius}> Distance</option>
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
