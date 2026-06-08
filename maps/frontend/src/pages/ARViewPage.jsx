import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useDeviceSensors } from '../hooks/useDeviceSensors'
import { useARProjection } from '../hooks/useARProjection'
import './ARViewPage.css'

// Reuse icon mapping from ItineraryDetailPage
const iconMap = {
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

function getIconUrl(type) {
  const normalized = (type || '').toString().trim().toLowerCase().replace('é', 'e')
  return iconMap[normalized] || iconMap.default
}

// Format distance nicely
function formatDistance(meters) {
  if (meters < 1000) return `${meters}m`
  return `${(meters / 1000).toFixed(1)}km`
}

// Compass direction label
function getCompassLabel(heading) {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  const index = Math.round(heading / 45) % 8
  return directions[index]
}

export default function ARViewPage() {
  const { itineraryId, spotId } = useParams()
  const navigate = useNavigate()
  const { apiFetch } = useApi()

  // Sensor data
  const {
    position, heading, tilt,
    isSupported, hasPermission, requiresSecureContext, requestPermission, error: sensorError
  } = useDeviceSensors()

  // State
  const [cameraStream, setCameraStream] = useState(null)
  const [cameraError, setCameraError] = useState(null)
  const [itineraryStops, setItineraryStops] = useState([])
  const [nearbySpots, setNearbySpots] = useState([])
  const [selectedPOI, setSelectedPOI] = useState(null)
  const [showInfoSheet, setShowInfoSheet] = useState(false)
  const [explanation, setExplanation] = useState(null)
  const [explanationError, setExplanationError] = useState(null)
  const [alternatives, setAlternatives] = useState([])
  const [maxRange, setMaxRange] = useState(500)
  const [showSettings, setShowSettings] = useState(false)
  const [loading, setLoading] = useState(true)
  const [screenDimensions, setScreenDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  })

  const videoRef = useRef(null)
  const radarRef = useRef(null)
  const cameraStreamRef = useRef(null)
  const activeCameraStreamsRef = useRef(new Set())
  const cameraStoppedRef = useRef(true)

  const stopCamera = useCallback((updateState = true) => {
    cameraStoppedRef.current = true
    const streams = new Set(activeCameraStreamsRef.current)
    if (cameraStreamRef.current) {
      streams.add(cameraStreamRef.current)
    }

    streams.forEach(stream => {
      stream.getTracks().forEach(track => {
        if (track.readyState !== 'ended') {
          track.stop()
        }
      })
    })

    activeCameraStreamsRef.current.clear()
    cameraStreamRef.current = null

    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.srcObject = null
      videoRef.current.removeAttribute('src')
      videoRef.current.load()
    }

    if (updateState) {
      setCameraStream(null)
    }
  }, [])

  const handleExitAR = useCallback(() => {
    stopCamera(true)
    navigate(-1)
  }, [navigate, stopCamera])

  // Track window resizes
  useEffect(() => {
    const handler = () => setScreenDimensions({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Combine itinerary stops + nearby spots into one POI list
  const excludeIds = useMemo(
    () => itineraryStops.map(s => s.spot?.id).filter(Boolean),
    [itineraryStops]
  )

  const allPOIs = useMemo(() => [
    ...itineraryStops.map((s, idx) => ({
      ...s.spot,
      isItineraryStop: true,
      stopNumber: idx + 1,
      notes: s.notes,
      startTime: s.startTime,
    })),
    ...nearbySpots.filter(ns =>
      !excludeIds.includes(ns.id)
    ).map(s => ({ ...s, isItineraryStop: false }))
  ], [itineraryStops, nearbySpots, excludeIds])

  const positionLatitude = position?.latitude
  const positionLongitude = position?.longitude

  // Project POIs to screen positions
  const projectedPOIs = useARProjection({
    userLat: positionLatitude,
    userLng: positionLongitude,
    heading,
    tilt,
    pois: allPOIs,
    cameraFOV: 60,
    maxDistance: maxRange,
    screenWidth: screenDimensions.width,
    screenHeight: screenDimensions.height
  })

  // ─── Camera initialization ───
  useEffect(() => {
    if (!isSupported || !hasPermission) return
    let cancelled = false
    cameraStoppedRef.current = false

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        })

        if (cancelled || cameraStoppedRef.current) {
          stream.getTracks().forEach(track => track.stop())
          return
        }

        activeCameraStreamsRef.current.add(stream)
        cameraStreamRef.current = stream
        stream.getTracks().forEach(track => {
          track.addEventListener('ended', () => {
            activeCameraStreamsRef.current.delete(stream)
            if (cameraStreamRef.current === stream) {
              cameraStreamRef.current = null
            }
          }, { once: true })
        })
        setCameraStream(stream)
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      } catch (err) {
        if (cancelled) return
        console.error('Camera access failed:', err)
        setCameraError('Camera access denied. Please enable camera permissions.')
      }
    }

    startCamera()

    return () => {
      cancelled = true
      stopCamera(false)
    }
  }, [isSupported, hasPermission, stopCamera])

  useEffect(() => {
    const releaseCamera = () => stopCamera(false)
    window.addEventListener('pagehide', releaseCamera)
    window.addEventListener('beforeunload', releaseCamera)
    return () => {
      window.removeEventListener('pagehide', releaseCamera)
      window.removeEventListener('beforeunload', releaseCamera)
    }
  }, [stopCamera])

  // Attach stream to video element when ref or stream changes
  useEffect(() => {
    if (videoRef.current && cameraStream && cameraStream.active) {
      videoRef.current.srcObject = cameraStream
    }
  }, [cameraStream])

  // ─── Load itinerary data ───
  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        if (itineraryId) {
          const res = await apiFetch(`/api/v1/itineraries/${itineraryId}`)
          if (res.ok) {
            const data = await res.json()
            const stops = (data.stops || []).map(stop => {
              if (stop.spot) return stop
              return {
                ...stop,
                spot: {
                  id: stop.spotId,
                  name: stop.spotName || 'Unknown',
                  type: stop.spotType || '',
                  address: stop.spotAddress || '',
                  latitude: stop.spotLatitude,
                  longitude: stop.spotLongitude,
                  photos: stop.spotPhotos || [],
                  averageRating: stop.spotAverageRating || 0
                }
              }
            })
            setItineraryStops(stops)
          }
        } else if (spotId) {
          // Spot-only mode — load the single spot
          const res = await apiFetch(`/api/v1/spots/${spotId}`)
          if (res.ok) {
            const spot = await res.json()
            setItineraryStops([{ spot, notes: '', startTime: '' }])
          }
        }
      } catch (err) {
        console.error('Failed to load itinerary/spot data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [itineraryId, spotId, apiFetch])

  // ─── Fetch nearby spots when position changes ───
  useEffect(() => {
    if (positionLatitude == null || positionLongitude == null) return

    const controller = new AbortController()
    const excludedSpotIds = excludeIds.join(',')

    async function fetchNearby() {
      try {
        const res = await apiFetch(
          `/api/v1/ar/nearby?lat=${positionLatitude}&lng=${positionLongitude}&radiusM=${maxRange}&excludeIds=${excludedSpotIds}`,
          { signal: controller.signal }
        )
        if (res.ok) {
          setNearbySpots(await res.json())
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Failed to fetch nearby spots:', err)
        }
      }
    }

    // Debounce — only fetch when position changes significantly
    const timer = setTimeout(fetchNearby, 1500)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [positionLatitude, positionLongitude, maxRange, excludeIds, apiFetch])

  // ─── Select a POI (open info sheet) ───
  const handleSelectPOI = useCallback(async (poi) => {
    setSelectedPOI(poi)
    setShowInfoSheet(true)
    setExplanation(null)
    setExplanationError(null)
    setAlternatives([])

    // Fetch explanation
    try {
      const url = `/api/v1/ar/explain?spotId=${poi.id}${itineraryId ? `&itineraryId=${itineraryId}` : ''}`
      const res = await apiFetch(url)
      if (res.ok) {
        setExplanation(await res.json())
      } else {
        setExplanationError('Local guide is unavailable for this spot.')
      }
    } catch {
      setExplanationError('Local guide is unavailable for this spot.')
    }

    // Fetch alternatives
    if (position) {
      try {
        const res = await apiFetch(
          `/api/v1/ar/alternatives?spotId=${poi.id}&lat=${position.latitude}&lng=${position.longitude}&radiusM=${maxRange}`
        )
        if (res.ok) {
          setAlternatives(await res.json())
        }
      } catch { /* ignore */ }
    }
  }, [apiFetch, position, maxRange, itineraryId])

  const handleCloseSheet = useCallback(() => {
    setShowInfoSheet(false)
    setTimeout(() => {
      setSelectedPOI(null)
      setExplanation(null)
      setExplanationError(null)
      setAlternatives([])
    }, 350)
  }, [])

  // ─── Draw Radar Minimap ───
  useEffect(() => {
    const canvas = radarRef.current
    if (!canvas || !position) return

    const ctx = canvas.getContext('2d')
    const size = 120 * (window.devicePixelRatio || 1)
    canvas.width = size
    canvas.height = size
    const center = size / 2
    const radius = center - 8

    // Clear
    ctx.clearRect(0, 0, size, size)

    // Background circle
    ctx.beginPath()
    ctx.arc(center, center, radius, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(10, 10, 20, 0.65)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Distance rings
    const rings = [0.33, 0.66, 1.0]
    rings.forEach(r => {
      ctx.beginPath()
      ctx.arc(center, center, radius * r, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'
      ctx.lineWidth = 0.5
      ctx.stroke()
    })

    // Heading wedge (field of view)
    const fovRad = (60 / 2) * Math.PI / 180
    const headingRad = -(heading * Math.PI / 180) + Math.PI / 2
    ctx.beginPath()
    ctx.moveTo(center, center)
    ctx.arc(center, center, radius, -headingRad - fovRad - Math.PI / 2, -headingRad + fovRad - Math.PI / 2)
    ctx.closePath()
    ctx.fillStyle = 'rgba(139, 92, 246, 0.15)'
    ctx.fill()

    // POI dots
    allPOIs.forEach(poi => {
      const lat = poi.latitude ?? poi.lat
      const lng = poi.longitude ?? poi.lng
      if (lat == null || lng == null) return

      const dLat = lat - position.latitude
      const dLng = (lng - position.longitude) * Math.cos(position.latitude * Math.PI / 180)
      const dist = Math.sqrt(dLat * dLat + dLng * dLng)
      const maxDeg = maxRange / 111320 // approximate degrees for maxRange meters

      if (dist > maxDeg) return

      const scale = (dist / maxDeg) * radius
      const angle = Math.atan2(dLng, dLat) - (heading * Math.PI / 180)

      const dotX = center + scale * Math.sin(angle)
      const dotY = center - scale * Math.cos(angle)

      ctx.beginPath()
      ctx.arc(dotX, dotY, poi.isItineraryStop ? 4 : 2.5, 0, Math.PI * 2)
      ctx.fillStyle = poi.isItineraryStop ? '#8b5cf6' : '#64748b'
      ctx.fill()
    })

    // User dot (center)
    ctx.beginPath()
    ctx.arc(center, center, 4, 0, Math.PI * 2)
    ctx.fillStyle = '#22d3ee'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(center, center, 7, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.4)'
    ctx.lineWidth = 2
    ctx.stroke()

  }, [position, heading, allPOIs, maxRange])

  // ─── Render: Desktop fallback ───
  if (!isSupported) {
    const fallbackTitle = requiresSecureContext ? 'Secure Connection Required' : 'AR Explorer'
    const fallbackDescription = requiresSecureContext
      ? 'Your phone browser blocks camera, GPS, and motion sensors on plain HTTP. Open the app through HTTPS, or use a secure tunnel to this dev server.'
      : 'Open this page on your phone to explore spots in augmented reality.'

    return (
      <div className="ar-page">
        <div className="ar-fallback">
          <div className="ar-fallback-card">
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>{requiresSecureContext ? '🔒' : '📱'}</div>
            <h2>{fallbackTitle}</h2>
            <p>{fallbackDescription}</p>
            {sensorError && <div className="ar-error-msg ar-error-msg--block">{sensorError}</div>}
            {requiresSecureContext && (
              <div className="ar-fallback-help">
                <div>For local phone testing, use an HTTPS tunnel URL such as ngrok or Cloudflare Tunnel.</div>
                <div>Current URL:</div>
              </div>
            )}
            <div className="ar-fallback-url">{window.location.href}</div>
            <button
              className="ar-fallback-copy-btn"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href).catch(() => {})
              }}
            >
              📋 Copy Link
            </button>
            <div style={{ marginTop: '20px' }}>
              <button className="ar-back-btn" onClick={handleExitAR}>← Go Back</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Render: Permission gate (iOS) ───
  if (!hasPermission) {
    return (
      <div className="ar-page">
        <div className="ar-permission-gate">
          <div className="ar-permission-icon">🔮</div>
          <div className="ar-permission-title">AR Explorer</div>
          <div className="ar-permission-desc">
            We need access to your camera, location, and motion sensors to show
            spots around you in augmented reality.
          </div>
          <button className="ar-permission-btn" onClick={requestPermission}>
            ✨ Enable AR
          </button>
          {sensorError && <div className="ar-error-msg">{sensorError}</div>}
          <div style={{ marginTop: '20px' }}>
            <button className="ar-back-btn" onClick={handleExitAR}>← Go Back</button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Render: Loading ───
  if (loading) {
    return (
      <div className="ar-page">
        <div className="ar-loading">
          <div className="ar-loading-spinner" />
          <div className="ar-loading-text">Loading AR Explorer...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="ar-page">
      {/* Camera Feed */}
      <video
        ref={videoRef}
        className="ar-camera-feed"
        autoPlay
        playsInline
        muted
      />

      {cameraError && (
        <div className="ar-permission-gate">
          <div className="ar-permission-icon">📷</div>
          <div className="ar-permission-title">Camera Required</div>
          <div className="ar-permission-desc">{cameraError}</div>
          <button className="ar-back-btn" onClick={handleExitAR}>← Go Back</button>
        </div>
      )}

      {/* AR Overlay */}
      <div className="ar-overlay">

        {/* Top Bar */}
        <div className="ar-top-bar">
          <button className="ar-back-btn" onClick={handleExitAR}>
            ← Back
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="ar-compass">
              <span
                className="ar-compass-arrow"
                style={{ transform: `rotate(${-heading}deg)` }}
              >
                🧭
              </span>
              {Math.round(heading)}° {getCompassLabel(heading)}
            </div>
          </div>

          <button
            className="ar-settings-btn"
            onClick={() => setShowSettings(prev => !prev)}
          >
            ⚙️
          </button>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="ar-settings-panel">
            <div className="ar-settings-label">Detection Range</div>
            <div className="ar-settings-value">{maxRange}m</div>
            <input
              type="range"
              className="ar-range-slider"
              min={100}
              max={1000}
              step={50}
              value={maxRange}
              onChange={(e) => setMaxRange(Number(e.target.value))}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
              <span>100m</span>
              <span>1km</span>
            </div>

            {position && (
              <div style={{ marginTop: '12px', fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>
                GPS: {position.latitude.toFixed(5)}, {position.longitude.toFixed(5)}
                <br />Accuracy: ±{Math.round(position.accuracy)}m
              </div>
            )}
          </div>
        )}

        {/* POI Markers */}
        <div className="ar-markers-container">
          {projectedPOIs
            .filter(poi => poi.isVisible)
            .map((poi) => (
            <div
              key={`ar-marker-${poi.id}`}
              className={`ar-marker ${
                poi.isItineraryStop ? 'ar-marker--current' : 'ar-marker--nearby'
              }`}
              style={{
                left: `${poi.screenX}px`,
                top: `${poi.screenY}px`,
                transform: `translate(-50%, -100%) scale(${poi.scale})`,
                opacity: poi.distance < 50 ? 1 : Math.max(0.5, 1 - (poi.distance / maxRange) * 0.5),
                zIndex: 1000 - poi.distance,
              }}
              onClick={() => handleSelectPOI(poi)}
            >
              <div className="ar-marker-card">
                <div className="ar-marker-bubble">
                  {poi.isItineraryStop && (
                    <div className="ar-marker-number">{poi.stopNumber}</div>
                  )}
                  <img
                    src={getIconUrl(poi.type)}
                    alt={poi.type || 'Spot'}
                    className="ar-marker-icon"
                  />
                  <div className="ar-marker-info">
                    <div className="ar-marker-name">{poi.name}</div>
                    <div className="ar-marker-distance">{formatDistance(poi.distance)}</div>
                  </div>
                </div>
                <div className="ar-marker-stem" />
              </div>
            </div>
          ))}
        </div>

        {/* Radar Minimap */}
        <div className="ar-radar">
          <canvas ref={radarRef} className="ar-radar-canvas" />
        </div>

        {/* Info Sheet */}
        <div className={`ar-info-sheet ${showInfoSheet ? 'ar-info-sheet--open' : ''}`}>
          <div className="ar-info-sheet-content">
            <div className="ar-info-drag-handle" />

            {selectedPOI && (
              <>
                <div className="ar-info-header">
                  <div>
                    <div className="ar-info-spot-name">
                      {selectedPOI.isItineraryStop && (
                        <span style={{ color: '#8b5cf6', marginRight: '6px' }}>
                          #{selectedPOI.stopNumber}
                        </span>
                      )}
                      {selectedPOI.name}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="ar-info-spot-type">
                      <img src={getIconUrl(selectedPOI.type)} alt="" style={{ width: '14px', height: '14px', filter: 'brightness(0) invert(0.7)' }} />
                      {selectedPOI.type}
                    </span>
                    <button className="ar-info-close-btn" onClick={handleCloseSheet}>✕</button>
                  </div>
                </div>

                <div className="ar-info-meta">
                  <span>📍 {formatDistance(selectedPOI.distance)}</span>
                  {selectedPOI.averageRating > 0 && (
                    <span>
                      ⭐ <span className="ar-info-rating">{selectedPOI.averageRating?.toFixed?.(1) || selectedPOI.averageRating}</span>
                    </span>
                  )}
                  {selectedPOI.address && (
                    <span style={{ fontSize: '0.75rem', opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                      {selectedPOI.address}
                    </span>
                  )}
                </div>

                {/* Explanation */}
                {explanation ? (
                  <div className="ar-explanation">
                    <div className="ar-explanation-heading">
                      <div className="ar-explanation-label">About this spot</div>
                      <div className={`ar-explanation-source ${explanation.aiEnhanced ? 'ar-explanation-source--ai' : ''}`}>
                        {explanation.aiEnhanced ? 'AI enhanced' : 'Local guide'}
                      </div>
                    </div>
                    <div className="ar-explanation-text">
                      {explanation.whatIsThis && (
                        <div className="ar-explanation-desc" style={{ marginBottom: '8px', lineHeight: '1.4' }}>
                          {explanation.whatIsThis}
                        </div>
                      )}

                      {explanation.highlights?.length > 0 && (
                        <div className="ar-explanation-highlights">
                          {explanation.highlights.slice(0, 5).map((highlight, idx) => (
                            <div key={`ar-highlight-${idx}`} className="ar-explanation-highlight">
                              {highlight}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {explanation.whoIsThisFor && (
                        <div className="ar-explanation-audience" style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>👥</span> <span>{explanation.whoIsThisFor}</span>
                        </div>
                      )}

                      {explanation.quickFact && (
                        <div className="ar-explanation-fact" style={{ marginBottom: '8px' }}>
                          💡 {explanation.quickFact}
                        </div>
                      )}
                      {explanation.visitTip && (
                        <div className="ar-explanation-tip">
                          <span className="ar-explanation-kicker">AR tip</span>
                          <span>{explanation.visitTip}</span>
                        </div>
                      )}
                    </div>

                    {explanation.shouldYouSwitch && (
                      <div className="ar-explanation-switch">
                        <div className="ar-explanation-switch-title">
                          <span>🔄</span> Should you switch?
                        </div>
                        <div className="ar-explanation-switch-content">
                          {explanation.shouldYouSwitch}
                        </div>
                      </div>
                    )}

                    {explanation.friendSays && (
                      <div className="ar-explanation-friend">
                        👤 A friend says: "{explanation.friendSays}"
                      </div>
                    )}
                  </div>
                ) : explanationError ? (
                  <div className="ar-explanation ar-explanation--muted">
                    <div className="ar-explanation-label">About this spot</div>
                    <div className="ar-explanation-text">{explanationError}</div>
                  </div>
                ) : selectedPOI && (
                  <div className="ar-explanation ar-explanation--loading">
                    <div className="ar-explanation-label">About this spot</div>
                    <div className="ar-explanation-text">Building a quick guide...</div>
                  </div>
                )}

                {/* Actions */}
                <div className="ar-info-actions">
                  <Link
                    to={`/spot/${selectedPOI.id}`}
                    className="ar-action-btn ar-action-btn--primary"
                    style={{ textDecoration: 'none' }}
                    onClick={() => stopCamera(true)}
                  >
                    📄 Details
                  </Link>
                  <Link
                    to={`/directions/${selectedPOI.id}`}
                    className="ar-action-btn"
                    style={{ textDecoration: 'none' }}
                    onClick={() => stopCamera(true)}
                  >
                    📍 Directions
                  </Link>
                </div>

                {/* Alternatives */}
                {alternatives.length > 0 && (
                  <div className="ar-alternatives">
                    <div className="ar-alternatives-label">
                      Similar spots nearby
                    </div>
                    <div className="ar-alt-list">
                      {alternatives.map(alt => (
                        <div
                          key={`alt-${alt.id}`}
                          className="ar-alt-card"
                          onClick={() => handleSelectPOI({
                            ...alt,
                            isItineraryStop: false,
                            distance: selectedPOI.distance // rough — will recalculate
                          })}
                        >
                          <img
                            src={getIconUrl(alt.type)}
                            alt={alt.type}
                            className="ar-alt-icon"
                          />
                          <div className="ar-alt-info">
                            <div className="ar-alt-name">{alt.name}</div>
                            <div className="ar-alt-meta">
                              {alt.type}
                              {alt.averageRating > 0 && ` · ⭐${alt.averageRating.toFixed?.(1) || alt.averageRating}`}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
