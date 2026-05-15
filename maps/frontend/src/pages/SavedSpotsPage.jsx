import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { Link } from 'react-router-dom'
import L from 'leaflet'
import { useApi } from '../hooks/useApi'
import SpotCard from '../components/SpotCard'
import './SavedSpotsPage.css'
import 'leaflet/dist/leaflet.css'
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
function FitBounds({ bounds }) {
  const map = useMap()
  useEffect(() => {
    if (bounds?.length) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 })
    }
  }, [bounds, map])
  return null
}

export default function SavedSpotsPage() {
  const { apiFetch } = useApi()
  const [spots, setSpots] = useState([])
  const [status, setStatus] = useState('Loading saved spots...')
  const [bounds, setBounds] = useState([])

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

  useEffect(() => {
    let mounted = true
    const fetchSavedSpots = async () => {
      try {
        const res = await apiFetch('/api/v1/spots/saved')
        const data = await res.json()
        if (!mounted) return
        if (!res.ok) throw new Error(data.error || 'Failed to fetch saved spots')
        
        setSpots(data)
        if (data.length > 0) {
          setStatus(`${data.length} saved spot${data.length === 1 ? '' : 's'}`)
          setBounds(data.map(s => [s.latitude, s.longitude]))
        } else {
          setStatus('You have not saved any spots yet.')
        }
      } catch (err) {
        if (mounted) setStatus(err.message)
      }
    }
    fetchSavedSpots()
    return () => { mounted = false }
  }, [apiFetch])

  // Update status message based on filtered spots
  useEffect(() => {
    if (spots.length === 0) return
    if (filteredSpots.length > 0) {
      setStatus(`${filteredSpots.length} saved spot${filteredSpots.length === 1 ? '' : 's'}`)
    } else {
      setStatus('No spots match the selected categories.')
    }
  }, [filteredSpots, spots.length])

  return (
    <div className="saved-page animate-fade-in">
      <div className="saved-map">
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
                {s.type} · {s.address}<br />
                <Link to={`/spot/${s.id}`}>View details →</Link>
              </Popup>
            </Marker>
          ))}
          {bounds.length > 0 && <FitBounds bounds={bounds} />}
        </MapContainer>
      </div>

      <div className="saved-sidebar">
        <div className="saved-header glass">
          <h1> Saved Spots</h1>
          <p>{status}</p>
        </div>
        
        <div className="saved-list">
          {filteredSpots.length === 0 && !status.includes('Loading') && (
            <div className="empty-state">
              <p>Your saved spots will appear here.</p>
              <Link to="/spots" className="btn btn-primary" style={{ marginTop: '1rem' }}>Discover Spots</Link>
            </div>
          )}
          {filteredSpots.map((s, i) => (
            <div key={s.id} className="animate-fade-up" style={{ animationDelay: `${i * 0.05}s` }}>
              <SpotCard spot={s} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
