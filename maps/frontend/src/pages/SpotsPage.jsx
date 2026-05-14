import { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import { useSearchParams } from 'react-router-dom'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useApi } from '../hooks/useApi'
import SpotCard from '../components/SpotCard'
import './SpotsPage.css'

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
        <MapContainer center={[13.7563, 100.5018]} zoom={11} style={{ width: '100%', height: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {spots.map(s => (
            <Marker key={s.id} position={[s.latitude, s.longitude]}>
              <Popup>
                <strong>{s.name}</strong><br />
                <span style={{ color: 'var(--star)' }}>{s.averageRating > 0 ? `★ ${s.averageRating.toFixed(1)}` : 'No ratings'}</span><br />
                {s.type} · {s.address}<br />
                <a href={`/spot/${s.id}`}>View details →</a>
              </Popup>
            </Marker>
          ))}
          {lat && lng && radius && (
            <Circle center={[parseFloat(lat), parseFloat(lng)]} radius={parseFloat(radius) * 1000}
              pathOptions={{ color: 'var(--accent)', fillColor: 'var(--accent)', fillOpacity: 0.1, weight: 2 }} />
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
            <button className="btn btn-primary" onClick={handleSearch}>🔍 Search nearby</button>
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
            <option value="popularity">🔥 Popularity</option>
            <option value="distance" disabled={!lat || !lng || !radius}>📍 Distance</option>
          </select>
        </div>

        <div className="spots-list">
          {spots.length === 0 && status && !status.includes('Loading') && (
            <div className="empty-state">No spots found.</div>
          )}
          {spots.map(s => <SpotCard key={s.id} spot={s} />)}
        </div>
      </div>
    </div>
  )
}
