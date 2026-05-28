import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import Lightbox from '../components/Lightbox'
import ReportModal from '../components/ReportModal'
import './TrailPathDetailPage.css'

// Haversine distance in meters
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Bearing/Heading in degrees
function calculateBearing(lat1, lng1, lat2, lng2) {
  const dLng = (lng2 - lng1) * Math.PI / 180
  const lat1Rad = lat1 * Math.PI / 180
  const lat2Rad = lat2 * Math.PI / 180
  const y = Math.sin(dLng) * Math.cos(lat2Rad)
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng)
  let brng = Math.atan2(y, x) * 180 / Math.PI
  return (brng + 360) % 360
}

const createNavUserIcon = (heading) => {
  const rotation = (heading !== null && heading !== undefined && !isNaN(heading)) ? heading : 0
  return new L.DivIcon({
    html: `
      <div class="nav-user-marker-container">
        <div class="nav-user-dot"></div>
        <div class="nav-user-arrow" style="transform: rotate(${rotation}deg); opacity: ${heading !== null && heading !== undefined ? '1' : '0.4'};">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#3b82f6" stroke="#ffffff" stroke-width="2" stroke-linejoin="round">
            <path d="M12 2L4 20L12 17L20 20L12 2Z" />
          </svg>
        </div>
      </div>
    `,
    className: 'nav-user-leaflet-icon',
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -24],
  })
}

function FollowUser({ liveLocation, isNavigating }) {
  const map = useMap()
  useEffect(() => {
    if (isNavigating && liveLocation) {
      map.flyTo([liveLocation.lat, liveLocation.lng], 17, { animate: true, duration: 1 })
    }
  }, [liveLocation, isNavigating, map])
  return null
}

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
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [reportTarget, setReportTarget] = useState({ type: '', id: null })

  // Navigation states
  const [isNavigating, setIsNavigating] = useState(false)
  const [liveLocation, setLiveLocation] = useState(null)
  const [watchId, setWatchId] = useState(null)
  const [isSimulating, setIsSimulating] = useState(false)
  const [simIndex, setSimIndex] = useState(0)

  // Parse GeoJSON to get positions (convert from [lng, lat] to [lat, lng])
  const positions = useMemo(() => {
    if (!path?.geoJson) return []
    try {
      const geo = JSON.parse(path.geoJson)
      if (geo.coordinates) {
        return geo.coordinates.map(([lng, lat]) => [lat, lng])
      }
    } catch {
      // fallback
    }
    return []
  }, [path])

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

  // GPS Simulation logic
  useEffect(() => {
    let interval
    if (isSimulating && positions.length > 0) {
      setSimIndex(0)
      setLiveLocation({
        lat: positions[0][0],
        lng: positions[0][1],
        heading: 0
      })
      interval = setInterval(() => {
        setSimIndex(prev => {
          const next = prev + 1
          if (next >= positions.length) {
            clearInterval(interval)
            setIsSimulating(false)
            alert('✓ Simulation complete! You reached the end of the trail.')
            return prev
          }
          const p1 = positions[prev]
          const p2 = positions[next]
          const heading = calculateBearing(p1[0], p1[1], p2[0], p2[1])
          setLiveLocation({
            lat: p2[0],
            lng: p2[1],
            heading
          })
          return next
        })
      }, 1500)
    }
    return () => clearInterval(interval)
  }, [isSimulating, positions])

  // Cleanup GPS watch on unmount
  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [watchId])

  // Navigation metrics (distance to trail, remaining distance, off-trail check)
  const navStats = useMemo(() => {
    if (!liveLocation || positions.length === 0) return null

    let closestIdx = 0
    let minDistance = Infinity
    for (let i = 0; i < positions.length; i++) {
      const dist = haversineDistance(
        liveLocation.lat,
        liveLocation.lng,
        positions[i][0],
        positions[i][1]
      )
      if (dist < minDistance) {
        minDistance = dist
        closestIdx = i
      }
    }

    let remainingMeters = 0
    if (closestIdx < positions.length - 1) {
      remainingMeters += haversineDistance(
        liveLocation.lat,
        liveLocation.lng,
        positions[closestIdx + 1][0],
        positions[closestIdx + 1][1]
      )
      for (let i = closestIdx + 1; i < positions.length - 1; i++) {
        remainingMeters += haversineDistance(
          positions[i][0],
          positions[i][1],
          positions[i + 1][0],
          positions[i + 1][1]
        )
      }
    }

    const isOffTrail = minDistance > 25

    return {
      closestIdx,
      distanceToTrail: minDistance,
      remainingDistance: remainingMeters,
      isOffTrail
    }
  }, [liveLocation, positions])

  const handleDelete = async () => {
    if (!window.confirm('Delete this trail path? This cannot be undone.')) return
    setDeleting(true)
    try {
      const res = await apiFetch(`/api/v1/paths/${id}`, { method: 'DELETE' })
      if (res.ok) {
        navigate(`/spot/${path?.spotId}`)
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

  // Navigation handlers
  const startNavigation = (simulate = false) => {
    setIsNavigating(true)
    setLiveLocation(null)
    if (simulate) {
      setIsSimulating(true)
    } else {
      if (navigator.geolocation) {
        const id = navigator.geolocation.watchPosition(
          (position) => {
            setLiveLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              heading: position.coords.heading !== null ? position.coords.heading : null
            })
          },
          (error) => {
            console.warn('GPS error:', error)
            alert('GPS Error: ' + (error.message || 'Unable to retrieve location'))
          },
          { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
        )
        setWatchId(id)
      } else {
        alert('Geolocation is not supported by your browser.')
      }
    }
  }

  const stopNavigation = () => {
    setIsNavigating(false)
    setIsSimulating(false)
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId)
      setWatchId(null)
    }
    setLiveLocation(null)
    setSimIndex(0)
  }

  const completedPath = isNavigating && navStats ? positions.slice(0, navStats.closestIdx + 1) : []
  const remainingPath = isNavigating && navStats ? positions.slice(navStats.closestIdx) : positions

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
    <div className={`trail-path-detail ${isNavigating ? 'navigating' : ''} animate-fade-in`}>
      {/* Map Section */}
      <div className="path-map-section">
        {!isNavigating && (
          <button className="path-back-btn" onClick={() => navigate(-1)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>
        )}

        <MapContainer center={positions.length > 0 ? positions[0] : [13.7563, 100.5018]} zoom={15} style={{ width: '100%', height: '100%' }} zoomControl={false}>
          <TileLayer
            url={`https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key=${import.meta.env.VITE_STADIA_API_KEY}`}
            attribution='Map tiles by <a href="https://stadiamaps.com/">Stadia Maps</a>'
          />

          {isNavigating && completedPath.length >= 2 && (
            <Polyline positions={completedPath} pathOptions={{ color: '#10b981', weight: 6, opacity: 0.6, lineCap: 'round', lineJoin: 'round' }} />
          )}

          {remainingPath.length >= 2 && (
            <Polyline positions={remainingPath} pathOptions={{ color: '#3b82f6', weight: 6, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }} />
          )}

          {positions.length >= 1 && (
            <>
              <Marker position={positions[0]} icon={createEndpointIcon('#22c55e')} />
              <Marker position={positions[positions.length - 1]} icon={createEndpointIcon('#ef4444')} />
            </>
          )}

          {isNavigating && liveLocation && (
            <Marker position={[liveLocation.lat, liveLocation.lng]} icon={createNavUserIcon(liveLocation.heading)} zIndexOffset={1000} />
          )}

          {!isNavigating && <FitToPath positions={positions} />}
          {isNavigating && <FollowUser liveLocation={liveLocation} isNavigating={isNavigating} />}
          <ZoomControls />
        </MapContainer>

        {isNavigating && (
          <div className="nav-hud-overlay glass animate-fade-up">
            <div className="nav-hud-header">
              <h2>Trail Navigation</h2>
              <button className="btn btn-danger btn-sm" onClick={stopNavigation}>Exit</button>
            </div>
            
            <div className="nav-hud-body">
              {navStats ? (
                <>
                  {navStats.isOffTrail ? (
                    <div className="nav-hud-alert alert-danger">
                      ⚠️ Off Trail! ({Math.round(navStats.distanceToTrail)}m away)
                    </div>
                  ) : (
                    <div className="nav-hud-alert alert-success">
                      ✓ On Trail
                    </div>
                  )}
                  
                  <div className="nav-hud-stats">
                    <div className="nav-hud-stat">
                      <span className="label">Remaining Dist</span>
                      <span className="value">
                        {navStats.remainingDistance >= 1000 
                          ? `${(navStats.remainingDistance / 1000).toFixed(2)} km` 
                          : `${Math.round(navStats.remainingDistance)} m`}
                      </span>
                    </div>
                    <div className="nav-hud-stat">
                      <span className="label">Est. Time Left</span>
                      <span className="value">
                        {Math.round(navStats.remainingDistance / 1.25 / 60)} min
                      </span>
                    </div>
                  </div>
                  
                  {isSimulating && (
                    <div className="nav-simulating-tag">
                      🤖 Simulating location ({simIndex + 1}/{positions.length})
                    </div>
                  )}
                </>
              ) : (
                <p className="loading-gps">Waiting for GPS signal...</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="path-info-section">
        <div className="path-info-header">
          <div>
            <h1>{path.name}</h1>
            <div className="path-meta">
              <span className={`difficulty-badge ${path.difficulty?.toLowerCase() || ''}`}>
                {path.difficulty ? (path.difficulty.charAt(0) + path.difficulty.slice(1).toLowerCase()) : 'Unknown'}
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
            {userId && !isOwner && (
              <button 
                className="btn btn-ghost btn-sm" 
                onClick={() => {
                  setReportTarget({ type: 'TRAIL_PATH', id: path.id })
                  setReportModalOpen(true)
                }} 
                style={{ color: 'var(--text-secondary)' }}
              >
                🚨 Report
              </button>
            )}
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
            <span className="stat-value">{path.difficulty ? (path.difficulty.charAt(0) + path.difficulty.slice(1).toLowerCase()) : 'Unknown'}</span>
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

        {/* Navigation Options */}
        <div className="path-navigation-options" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <button className="btn btn-primary" onClick={() => startNavigation(false)} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', padding: '0.6rem' }}>
              Start Navigation
            </button>
            <button className="btn btn-secondary" onClick={() => startNavigation(true)} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', padding: '0.6rem' }}>
              Simulate Route
            </button>
          </div>
          {path.spotId && (
            <button className="btn btn-ghost" onClick={() => navigate(`/directions/${path.spotId}`)} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', border: '1px solid var(--border)', padding: '0.6rem' }}>
              Directions to Trailhead
            </button>
          )}
        </div>
      </div>

      {lightboxOpen && (
        <Lightbox images={path.photos} initialIndex={lightboxIndex} onClose={() => setLightboxOpen(false)} />
      )}
      {reportModalOpen && (
        <ReportModal 
          contentType={reportTarget.type} 
          contentId={reportTarget.id} 
          onClose={() => setReportModalOpen(false)}
          onSuccess={() => alert('Thank you. This trail path has been reported for review.')}
        />
      )}
    </div>
  )
}
