import { useState, useEffect, useRef, useCallback, Fragment } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useAuth } from '../context/AuthContext'
import { useApi } from '../hooks/useApi'
import 'leaflet/dist/leaflet.css'
import './ItinerarySharePage.css'

// Custom map markers mapping
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

function createNumberMarkerIcon(number, type) {
  const icon = getIconUrl(type)
  return new L.DivIcon({
    html: `
      <div class="itinerary-map-marker">
        <div class="marker-number">${number}</div>
        <img src="${icon}" alt="${type || 'Spot'}" />
      </div>
    `,
    className: 'custom-itinerary-marker',
    iconSize: [44, 44],
    iconAnchor: [22, 44],
    popupAnchor: [0, -44],
  })
}

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371.0
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return R * 2 * Math.asin(Math.sqrt(a))
}

function estimateTravelTimeMinutes(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return 15
  const dist = haversineDistance(lat1, lng1, lat2, lng2)
  if (dist < 1.0) {
    return Math.max(5, Math.round((dist * 12.0) + 2.0))
  } else {
    return Math.max(7, Math.round((dist * 2.0) + 3.0))
  }
}

function FitBounds({ bounds }) {
  const map = useMap()
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      map.invalidateSize({ animate: false })
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 })
    }
  }, [bounds, map])

  return null
}

function MapRefSetter({ mapRefCallback }) {
  const map = useMap()
  useEffect(() => {
    mapRefCallback(map)
  }, [map, mapRefCallback])
  return null
}

function createPrintMapOverlay(map, printPoints) {
  if (!map || printPoints.length === 0) return null

  const mapContainer = map.getContainer()
  const wrapper = mapContainer.closest('.detail-map-container')
  if (!wrapper) return null

  wrapper.querySelector('.print-map-overlay')?.remove()

  const size = map.getSize()
  const containerPoints = printPoints.map(point => ({
    ...point,
    containerPoint: map.latLngToContainerPoint([point.lat, point.lng])
  }))

  const overlay = document.createElement('div')
  overlay.setAttribute('class', 'print-map-overlay')

  if (containerPoints.length > 1) {
    const points = containerPoints
      .map(point => `${point.containerPoint.x},${point.containerPoint.y}`)
      .join(' ')

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('class', 'print-route-overlay')
    svg.setAttribute('viewBox', `0 0 ${size.x} ${size.y}`)
    svg.setAttribute('preserveAspectRatio', 'none')

    const route = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
    route.setAttribute('points', points)
    route.setAttribute('fill', 'none')
    route.setAttribute('stroke', '#7c3aed')
    route.setAttribute('stroke-width', '5')
    route.setAttribute('stroke-linecap', 'round')
    route.setAttribute('stroke-linejoin', 'round')
    route.setAttribute('stroke-dasharray', '10 12')
    route.setAttribute('stroke-opacity', '0.96')

    svg.appendChild(route)
    overlay.appendChild(svg)
  }

  containerPoints.forEach(point => {
    const marker = document.createElement('div')
    marker.setAttribute('class', 'print-map-marker')
    marker.style.left = `${Math.round(point.containerPoint.x - 19)}px`
    marker.style.top = `${Math.round(point.containerPoint.y - 42)}px`
    marker.innerHTML = `
      <div class="print-marker-number">${point.number}</div>
      <img src="${getIconUrl(point.type)}" alt="${point.type || 'Spot'}" />
    `
    overlay.appendChild(marker)
  })

  wrapper.appendChild(overlay)
  return overlay
}

function buildPrintPoints(stops) {
  return stops
    .filter(stop => stop.spotLatitude != null && stop.spotLongitude != null)
    .map((stop, idx) => ({
      lat: stop.spotLatitude,
      lng: stop.spotLongitude,
      type: stop.spotType,
      number: idx + 1
    }))
}

export default function ItinerarySharePage() {
  const { shareToken } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const { apiFetch } = useApi()

  const [itinerary, setItinerary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [cloning, setCloning] = useState(false)
  const [cloneSuccess, setCloneSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [travelLegs, setTravelLegs] = useState([])
  const mapInstanceRef = useRef(null)
  const setMapRef = useCallback((mapInstance) => { mapInstanceRef.current = mapInstance }, [])

  // Fetch OSRM segments for public share page
  useEffect(() => {
    const stops = itinerary?.stops || []
    if (stops.length <= 1) {
      setTravelLegs([])
      return
    }

    async function fetchAllLegs() {
      const legs = []
      for (let i = 0; i < stops.length - 1; i++) {
        const curStop = stops[i]
        const nextStop = stops[i + 1]
        
        const lat1 = curStop.spotLatitude
        const lng1 = curStop.spotLongitude
        const lat2 = nextStop.spotLatitude
        const lng2 = nextStop.spotLongitude

        if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) {
          legs.push(null)
          continue
        }

        const dist = haversineDistance(lat1, lng1, lat2, lng2)
        let durationMinutes = estimateTravelTimeMinutes(lat1, lng1, lat2, lng2)
        let mode = dist < 1.0 ? 'walk' : 'drive'
        let distanceKm = dist.toFixed(1)

        try {
          const profile = dist < 1.0 ? 'foot' : 'driving'
          const url = `https://router.project-osrm.org/route/v1/${profile}/${lng1},${lat1};${lng2},${lat2}?overview=false`
          const res = await fetch(url)
          const data = await res.json()
          if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            const route = data.routes[0]
            durationMinutes = Math.round(route.duration / 60)
            distanceKm = (route.distance / 1000).toFixed(1)
          }
        } catch (e) {
          console.error("OSRM fetch failed, falling back to approximation", e)
        }

        legs.push({ durationMinutes, distanceKm, mode })
      }
      setTravelLegs(legs)
    }

    fetchAllLegs()
  }, [itinerary])

  useEffect(() => {
    loadSharedItinerary()
  }, [shareToken])

  async function loadSharedItinerary() {
    setLoading(true)
    setErrorMessage('')
    try {
      const res = await fetch(`/api/v1/itineraries/share/${shareToken}`)
      if (res.ok) {
        const data = await res.json()
        setItinerary(data)
      } else {
        setErrorMessage('Itinerary not found or the link has expired.')
      }
    } catch (e) {
      console.error(e)
      setErrorMessage('Failed to load itinerary. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCloneItinerary() {
    if (!isAuthenticated) {
      // Redirect to login page and redirect back after login
      navigate(`/login?redirect=/itineraries/share/${shareToken}`)
      return
    }

    setCloning(true)
    setErrorMessage('')
    try {
      const payload = {
        title: `Copy of ${itinerary.title}`,
        description: itinerary.description || '',
        date: itinerary.date || null,
        stops: itinerary.stops.map((s, idx) => ({
          spotId: s.spotId,
          stopOrder: idx + 1,
          startTime: s.startTime,
          endTime: s.endTime,
          durationMinutes: s.durationMinutes || 60,
          notes: s.notes
        }))
      }

      const res = await apiFetch('/api/v1/itineraries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        const newItinerary = await res.json()
        setCloneSuccess(true)
        setTimeout(() => {
          navigate(`/itineraries/${newItinerary.id}`)
        }, 1500)
      } else {
        const err = await res.json().catch(() => ({}))
        setErrorMessage(err.error || 'Failed to clone itinerary')
      }
    } catch (e) {
      console.error(e)
      setErrorMessage('Failed to connect to backend')
    } finally {
      setCloning(false)
    }
  }

  if (loading) {
    return (
      <div className="itinerary-share-page">
        <div style={{ textAlign: 'center', padding: '5rem', color: '#999' }}>
          <div className="loading-spinner" />
          Loading shared itinerary...
        </div>
      </div>
    )
  }

  if (errorMessage && !itinerary) {
    return (
      <div className="itinerary-share-page error-pane">
        <div className="error-card glass">
          <h2>⚠️ Access Error</h2>
          <p>{errorMessage}</p>
          <Link to="/" className="btn btn-primary">Go to Home</Link>
        </div>
      </div>
    )
  }

  const mapBounds = (itinerary.stops || [])
    .filter(s => s.spotLatitude != null && s.spotLongitude != null)
    .map(s => [s.spotLatitude, s.spotLongitude])

  function handlePrint() {
    const pageEl = document.querySelector('.itinerary-share-page')
    const map = mapInstanceRef.current
    if (!pageEl) { window.print(); return }

    const printPoints = buildPrintPoints(itinerary.stops || [])
    let printMapOverlay = null

    const renderPrintMapOverlay = () => {
      if (!map) return
      printMapOverlay?.remove()
      map.invalidateSize({ animate: false })
      if (mapBounds.length > 0) {
        map.fitBounds(mapBounds, { padding: [40, 40], maxZoom: 15, animate: false })
      }
      printMapOverlay = createPrintMapOverlay(map, printPoints)
    }

    pageEl.classList.add('print-layout-active')

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (map) {
          map.invalidateSize({ animate: false })
          if (mapBounds.length > 0) {
            map.fitBounds(mapBounds, { padding: [40, 40], maxZoom: 15 })
          }
        }
        requestAnimationFrame(() => {
          setTimeout(() => {
            // Convert translate3d to translate (2D) inside the map container.
            // Chrome's print renderer skips GPU-composited layers created by translate3d.
            const saved = []
            const mapContainer = map ? map.getContainer() : null
            if (mapContainer) {
              mapContainer.querySelectorAll('*').forEach(el => {
                const t = el.style.transform
                if (t && t.includes('translate3d')) {
                  saved.push({ el, transform: t })
                  el.style.transform = t.replace(
                    /translate3d\(([^,]+),\s*([^,]+),\s*[^)]*\)/g,
                    'translate($1, $2)'
                  )
                }
              })
            }

            renderPrintMapOverlay()

            let didCleanup = false
            const cleanupPrintLayout = () => {
              if (didCleanup) return
              didCleanup = true

              // Restore original 3D transforms and screen layout
              printMapOverlay?.remove()
              saved.forEach(({ el, transform }) => { el.style.transform = transform })
              pageEl.classList.remove('print-layout-active')
              window.removeEventListener('beforeprint', renderPrintMapOverlay)
              window.removeEventListener('afterprint', cleanupPrintLayout)
              if (map) {
                map.invalidateSize({ animate: false })
                if (mapBounds.length > 0) {
                  map.fitBounds(mapBounds, { padding: [50, 50], maxZoom: 15 })
                }
              }
            }

            window.addEventListener('beforeprint', renderPrintMapOverlay)
            window.addEventListener('afterprint', cleanupPrintLayout, { once: true })
            window.print()
          }, 350)
        })
      })
    })
  }

  return (
    <div className="itinerary-share-page">
      <div className="print-header">
        <h1>Unlike — Discover Popular Spots</h1>
      </div>
      
      {/* MAP VIEW */}
      <div className="detail-map-container">
        <MapContainer center={mapBounds[0] || [13.7563, 100.5018]} zoom={13} style={{ width: '100%', height: '100%' }}>
          <TileLayer
            url={`https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key=${import.meta.env.VITE_STADIA_API_KEY}`}
            attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="http://openstreetmap.org">OpenStreetMap</a>'
          />
          {(itinerary.stops || []).map((stop, idx) => (
            stop.spotLatitude != null && stop.spotLongitude != null && (
              <Marker
                key={`marker-${stop.spotId}-${idx}`}
                position={[stop.spotLatitude, stop.spotLongitude]}
                icon={createNumberMarkerIcon(idx + 1, stop.spotType)}
              >
                <Popup>
                  <strong>#{idx + 1} {stop.spotName}</strong><br />
                  {stop.startTime} - {stop.endTime}<br />
                  {stop.notes && <em>"{stop.notes}"</em>}
                </Popup>
              </Marker>
            )
          ))}
          {mapBounds.length > 1 && (
            <Polyline
              positions={mapBounds}
              color="#8b5cf6"
              weight={4}
              opacity={0.8}
              dashArray="8, 12"
              className="itinerary-route-line"
            />
          )}
          {mapBounds.length > 0 && <FitBounds bounds={mapBounds} />}
          <MapRefSetter mapRefCallback={setMapRef} />
        </MapContainer>
      </div>

      {/* TIMELINE SIDEBAR */}
      <div className="detail-sidebar">
        {/* HEADER SECTION */}
        <div className="detail-header glass">
          <div className="header-meta">
            <span className="shared-badge">🔗 Shared View</span>
            {itinerary.source === 'GENERATED' && <span className="source-badge generated">⚡Generated</span>}
            {itinerary.source === 'MANUAL' && <span className="source-badge manual">✏️ Manual Plan</span>}
          </div>

          <div className="display-fields">
            <h2>{itinerary.title}</h2>
            {itinerary.date && <div className="detail-date">📅 {itinerary.date}</div>}
            {itinerary.description && <p className="detail-desc">{itinerary.description}</p>}
          </div>

          <div className="action-row">
            <button 
              onClick={handleCloneItinerary} 
              disabled={cloning || cloneSuccess} 
              className={`btn-clone ${cloneSuccess ? 'success' : ''}`}
            >
              {cloneSuccess 
                ? '✓ Cloned successfully!' 
                : cloning 
                  ? 'Cloning...' 
                  : isAuthenticated 
                    ? '👥 Save to My Itineraries' 
                    : '👥 Sign in to Clone'}
            </button>
            <button onClick={handlePrint} className="btn-print">
              🖨️ Export PDF / Print
            </button>
          </div>
          {errorMessage && <div className="action-error">{errorMessage}</div>}
        </div>

        {/* TIMELINE LIST */}
        <div className="detail-timeline-section">
          <h3>Route Timeline</h3>

          {(!itinerary.stops || itinerary.stops.length === 0) ? (
            <div className="empty-timeline-message">
              No stops in this itinerary.
            </div>
          ) : (
            <div className="detail-timeline-list">
              {itinerary.stops.map((stop, idx) => (
                <Fragment key={`stop-group-${idx}`}>
                  <div className="detail-stop-card glass">
                    <div className="stop-badge">#{idx + 1}</div>

                    <div className="stop-details">
                      <div className="stop-header">
                        <h4 className="stop-name">{stop.spotName}</h4>
                        <span className="stop-type">{stop.spotType}</span>
                      </div>

                      <div className="stop-time">
                        🕒 {stop.startTime} - {stop.endTime} ({stop.durationMinutes} mins)
                      </div>

                      {stop.notes && <div className="stop-notes">📝 <em>"{stop.notes}"</em></div>}
                      
                      <div className="stop-navigation-link">
                        <Link to={`/spot/${stop.spotId}`} className="btn-spot-link">
                          View Spot
                        </Link>
                      </div>
                    </div>
                  </div>

                  {idx < itinerary.stops.length - 1 && travelLegs[idx] && (
                    <div className="timeline-travel-connector">
                      <div className="connector-line"></div>
                      <div className="travel-pill">
                        {travelLegs[idx].mode === 'walk' ? '🚶 Walk' : '🚗 Drive'}{' '}
                        <strong>{travelLegs[idx].durationMinutes} min</strong> ({travelLegs[idx].distanceKm} km)
                      </div>
                    </div>
                  )}
                </Fragment>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
