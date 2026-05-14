import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { Link } from 'react-router-dom'
import L from 'leaflet'
import { useApi } from '../hooks/useApi'
import SpotCard from '../components/SpotCard'
import './SavedSpotsPage.css'
import 'leaflet/dist/leaflet.css'

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

  return (
    <div className="saved-page animate-fade-in">
      <div className="saved-map">
        <MapContainer center={[13.7563, 100.5018]} zoom={11} style={{ width: '100%', height: '100%' }}>
          <TileLayer
            url="https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors'
          />
          {spots.map(s => (
            <Marker key={s.id} position={[s.latitude, s.longitude]}>
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
          {spots.length === 0 && !status.includes('Loading') && (
            <div className="empty-state">
              <p>Your saved spots will appear here.</p>
              <Link to="/spots" className="btn btn-primary" style={{ marginTop: '1rem' }}>Discover Spots</Link>
            </div>
          )}
          {spots.map((s, i) => (
            <div key={s.id} className="animate-fade-up" style={{ animationDelay: `${i * 0.05}s` }}>
              <SpotCard spot={s} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
