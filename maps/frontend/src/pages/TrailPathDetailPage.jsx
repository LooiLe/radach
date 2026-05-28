import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import Lightbox from '../components/Lightbox'
import './TrailPathDetailPage.css'

// Fix default marker icon
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const createEndpointIcon = (color) => new L.DivIcon({
  html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
  className: 'endpoint-icon',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

function FitToPath({ positions }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length > 1) {
      map.fitBounds(positions, { padding: [40, 40], maxZoom: 17 })
    } else if (positions.length === 1) {
      map.setView(positions[0], 16)
    }
  }, [positions, map])
  return null
}

function ZoomControls() {
  const map = useMap()
  return (
    <div className="leaflet-control-zoom" style={{ position: 'absolute', top: '60px', right: '20px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <button type="button" className="leaflet-control-zoom-in" title="Zoom in" onClick={(e) => { e.preventDefault(); map.zoomIn() }}>+</button>
      <button type="button" className="leaflet-control-zoom-out" title="Zoom out" onClick={(e) => { e.preventDefault(); map.zoomOut() }}>–</button>
    </div>
  )
}

export default function TrailPathDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { apiFetch } = useApi()
  const { userId } = useAuth()

  const [path, setPath] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [deleting, setDeleting] = useState(false)
  const [upvoting, setUpvoting] = useState(false)

  useEffect(() => {
    async function loadPath() {
      try {
        const res = await apiFetch(`/api/v1/paths/${id}`)
        if (res.ok) {
          const data = await res.json()
          setPath(data)
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    loadPath()
  }, [id, apiFetch])

  const handleDelete = async () => {
    if (!window.confirm('Delete this trail path? This cannot be undone.')) return
    setDeleting(true)
    try {
      const res = await apiFetch(`/api/v1/paths/${id}`, { method: 'DELETE' })
      if (res.ok) {
        navigate(`/spot/${path.spotId}`)
      }
    } catch {
      alert('Error deleting path.')
    } finally {
      setDeleting(false)
    }
  }

  const handleUpvote = async () => {
    if (!userId) {
      alert('Please log in to upvote.')
      return
    }
    setUpvoting(true)
    try {
      const res = await apiFetch(`/api/v1/paths/${id}/upvote`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setPath(data)
      }
    } catch {
      alert('Error upvoting path.')
    } finally {
      setUpvoting(false)
    }
  }

  if (loading) return <div className="trail-path-detail"><div className="empty-state" style={{ padding: '3rem' }}>Loading trail path...</div></div>
  if (!path) return <div className="trail-path-detail"><div className="empty-state" style={{ padding: '3rem' }}>Trail path not found.</div></div>

  // Parse GeoJSON to get positions (convert from [lng, lat] to [lat, lng])
  let positions = []
  try {
    const geo = JSON.parse(path.geoJson)
    if (geo.coordinates) {
      positions = geo.coordinates.map(([lng, lat]) => [lat, lng])
    }
  } catch {
    // fallback
  }

  const isOwner = String(path.submittedBy) === String(userId)

  const formatDistance = (meters) => {
    if (!meters) return '—'
    return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`
  }

  const formatDuration = (minutes) => {
    if (!minutes) return '—'
    if (minutes >= 60) {
      const hrs = Math.floor(minutes / 60)
      const mins = minutes % 60
      return `${hrs}h ${mins}m`
    }
    return `${minutes} min`
  }

  return (
    <div className="trail-path-detail animate-fade-in">
      {/* Map Section */}
      <div className="path-map-section">
        <button className="path-back-btn" onClick={() => navigate(-1)}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>

        <MapContainer center={positions.length > 0 ? positions[0] : [13.7563, 100.5018]} zoom={15} style={{ width: '100%', height: '100%' }} zoomControl={false}>
          <TileLayer
            url={`https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key=${import.meta.env.VITE_STADIA_API_KEY}`}
            attribution='Map tiles by <a href="https://stadiamaps.com/">Stadia Maps</a>'
          />

          {positions.length >= 2 && (
            <>
              <Polyline positions={positions} pathOptions={{ color: '#3b82f6', weight: 5, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }} />
              <Marker position={positions[0]} icon={createEndpointIcon('#22c55e')} />
              <Marker position={positions[positions.length - 1]} icon={createEndpointIcon('#ef4444')} />
            </>
          )}

          <FitToPath positions={positions} />
          <ZoomControls />
        </MapContainer>
      </div>

      {/* Info Section */}
      <div className="path-info-section">
        <div className="path-info-header">
          <div>
            <h1>{path.name}</h1>
            <div className="path-meta">
              <span className={`difficulty-badge ${path.difficulty?.toLowerCase()}`}>
                {path.difficulty?.charAt(0) + path.difficulty?.slice(1).toLowerCase()}
              </span>
              {path.isPrivate && (
                <span className="path-private-badge">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                  Private
                </span>
              )}
              {path.spotName && (
                <Link to={`/spot/${path.spotId}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                  📍 {path.spotName}
                </Link>
              )}
              <span>· {new Date(path.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button className={`btn btn-sm ${path.isUpvoted ? 'btn-primary' : 'btn-ghost'}`} onClick={handleUpvote} disabled={upvoting} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', border: path.isUpvoted ? 'none' : '1px solid var(--border)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill={path.isUpvoted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
              {path.upvoteCount || 0}
            </button>
            {isOwner && (
              <div className="path-owner-actions">
                <button className="btn btn-ghost btn-sm" onClick={handleDelete} disabled={deleting} style={{ color: 'var(--text-error)' }}>
                  {deleting ? '...' : 'Delete'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="path-stats-row glass">
          <div className="stat-item">
            <span className="stat-label">Distance</span>
            <span className="stat-value">{formatDistance(path.distanceMeters)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Duration</span>
            <span className="stat-value">{formatDuration(path.estimatedDurationMin)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Difficulty</span>
            <span className="stat-value">{path.difficulty?.charAt(0) + path.difficulty?.slice(1).toLowerCase()}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Status</span>
            <span className="stat-value">{path.status}</span>
          </div>
        </div>

        {/* Description */}
        {path.description && (
          <div className="path-description">
            <h3>About this path</h3>
            <p>{path.description}</p>
          </div>
        )}

        {/* Photos */}
        {path.photos?.length > 0 && (
          <div className="path-photos-section">
            <h3>Photos</h3>
            <div className="path-photos-grid">
              {path.photos.map((url, idx) => (
                <img key={idx} src={url} alt={`Trail photo ${idx + 1}`} onClick={() => { setLightboxIndex(idx); setLightboxOpen(true) }} />
              ))}
            </div>
          </div>
        )}

        {/* Submitter */}
        {path.submitterName && (
          <div className="path-submitter glass">
            Submitted by{' '}
            <Link to={`/user/${path.submittedBy}`}>{path.submitterName}</Link>
          </div>
        )}

        {/* Navigate button */}
        {path.spotId && (
          <button className="btn btn-primary" onClick={() => navigate(`/directions/${path.spotId}`)} style={{ width: '100%', marginTop: '1.5rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
            Get Directions to Trail
          </button>
        )}
      </div>

      {lightboxOpen && (
        <Lightbox images={path.photos} initialIndex={lightboxIndex} onClose={() => setLightboxOpen(false)} />
      )}
    </div>
  )
}
