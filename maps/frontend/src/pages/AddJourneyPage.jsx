import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useApi } from '../hooks/useApi'
import './AddJourneyPage.css'

// Fix default marker icon
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const createWaypointIcon = (index, total) => {
  const isFirst = index === 0
  const isLast = index === total - 1 && total > 1
  const color = isFirst ? '#22c55e' : isLast ? '#ef4444' : '#3b82f6'
  return new L.DivIcon({
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
    className: 'waypoint-icon',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

// Calculate distance between two lat/lng pairs in meters (Haversine)
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function calculateTotalDistance(points) {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += haversineDistance(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1])
  }
  return total
}

function pointsToGeoJson(points) {
  return JSON.stringify({
    type: 'LineString',
    coordinates: points.map(([lat, lng]) => [lng, lat]) // GeoJSON is [lng, lat]
  })
}

// Helper to calculate suggested duration based on distance and difficulty
function getSuggestedDuration(distanceMeters, diff) {
  if (!distanceMeters || distanceMeters <= 0) return 0
  let speed = 70 // default MODERATE (meters per minute, approx 4.2 km/h)
  if (diff === 'EASY') speed = 85 // approx 5.1 km/h
  else if (diff === 'MODERATE') speed = 70
  else if (diff === 'HARD') speed = 55 // approx 3.3 km/h
  else if (diff === 'EXPERT') speed = 40 // approx 2.4 km/h
  return Math.round(distanceMeters / speed)
}

// Decode Valhalla 6-digit precision polyline
function decodeValhallaPolyline(str) {
  let index = 0, lat = 0, lng = 0, coordinates = [];
  const factor = 1e6;
  while (index < str.length) {
    let b, shift = 0, result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;
    shift = 0;
    result = 0;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;
    coordinates.push([lat / factor, lng / factor]);
  }
  return coordinates;
}

// Map click handler for draw mode
function DrawClickHandler({ onMapClick, isDrawMode }) {
  useMapEvents({
    click(e) {
      if (isDrawMode) {
        onMapClick([e.latlng.lat, e.latlng.lng])
      }
    }
  })
  return null
}

// Zoom controls
function ZoomControls() {
  const map = useMap()
  return (
    <div className="leaflet-control-zoom" style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <button type="button" className="leaflet-control-zoom-in" title="Zoom in" onClick={(e) => { e.preventDefault(); map.zoomIn() }}>+</button>
      <button type="button" className="leaflet-control-zoom-out" title="Zoom out" onClick={(e) => { e.preventDefault(); map.zoomOut() }}>–</button>
    </div>
  )
}

// Helper to expose Leaflet map instance to parent
function MapInstanceGetter({ setMap }) {
  const map = useMap()
  useEffect(() => {
    setMap(map)
  }, [map, setMap])
  return null
}

// Fit map to waypoints
function FitToPoints({ points, spotCenter }) {
  const map = useMap()
  const initialFitDone = useRef(false)
  
  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(points, { padding: [40, 40], maxZoom: 17 })
    } else if (points.length === 1) {
      map.setView(points[0], 16)
    } else if (spotCenter && !initialFitDone.current) {
      map.setView(spotCenter, 15)
      initialFitDone.current = true
    }
  }, [points, spotCenter, map])
  return null
}

export default function SubmitJourneyPage() {
  const { id: paramId } = useParams()
  const navigate = useNavigate()
  const { apiFetch } = useApi()
  const isEdit = window.location.pathname.endsWith('/edit')
  const spotId = !isEdit ? paramId : null

  const [spot, setSpot] = useState(null)
  const [mode, setMode] = useState('draw') // 'draw' or 'gps'
  const [editingId, setEditingId] = useState(null)
  const [waypoints, setWaypoints] = useState([]) // [[lat, lng], ...]
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [difficulty, setDifficulty] = useState('MODERATE')
  const [estimatedDuration, setEstimatedDuration] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [photos, setPhotos] = useState([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState({ type: '', text: '' })

  // Categories
  const [categories, setCategories] = useState([])
  const [categoryId, setCategoryId] = useState('')

  // GPS recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordedPoints, setRecordedPoints] = useState([])
  const watchIdRef = useRef(null)

  // Routing state
  const [snappedPoints, setSnappedPoints] = useState([])
  const [isRouting, setIsRouting] = useState(false)

  // --- New UX/Wizard States ---
  const [step, setStep] = useState(1) // 1 = Map route, 2 = Form Details
  const [map, setMap] = useState(null)
  const [snapToTrails, setSnapToTrails] = useState(true)
  const [suggestedDuration, setSuggestedDuration] = useState(0)
  
  // Search & Suggestions
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')

  const geocodeTimer = useRef(null)
  const suggestionsAbort = useRef(null)
  const suggestionsRequestId = useRef(0)

  // Geolocation auto-locate on mount
  useEffect(() => {
    if (isEdit || spotId || !map) return
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          map.setView([pos.coords.latitude, pos.coords.longitude], 14)
        },
        (err) => {
          console.log('Auto-locate declined or failed:', err)
        }
      )
    }
  }, [isEdit, spotId, map])

  // Fetch Stadia routing when waypoints change
  useEffect(() => {
    if (mode !== 'draw') return
    
    if (!snapToTrails || waypoints.length < 2) {
      setSnappedPoints(waypoints)
      return
    }

    async function fetchSnappedRoute() {
      setIsRouting(true)
      try {
        const apiKey = import.meta.env.VITE_STADIA_API_KEY
        if (!apiKey) {
          setSnappedPoints(waypoints)
          setIsRouting(false)
          return
        }

        const url = `https://api.stadiamaps.com/route/v1?api_key=${apiKey}`
        const reqBody = {
          locations: waypoints.map(p => ({ lat: p[0], lon: p[1] })),
          costing: "pedestrian"
        }
        
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reqBody)
        })
        
        const data = await res.json()
        if (data.trip && data.trip.legs) {
          let allCoords = []
          data.trip.legs.forEach(leg => {
            if (leg.shape) {
              allCoords.push(...decodeValhallaPolyline(leg.shape))
            }
          })
          setSnappedPoints(allCoords.length > 0 ? allCoords : waypoints)
        } else {
          setSnappedPoints(waypoints)
        }
      } catch (err) {
        console.error('Routing error:', err)
        setSnappedPoints(waypoints)
      } finally {
        setIsRouting(false)
      }
    }
    
    const timeout = setTimeout(fetchSnappedRoute, 400)
    return () => clearTimeout(timeout)
  }, [waypoints, mode, snapToTrails])



  // Load existing journey for editing
  useEffect(() => {
    if (!isEdit || !paramId) return
    async function loadJourney() {
      try {
        const res = await apiFetch(`/api/v1/journeys/${paramId}`)
        const data = await res.json()
        if (res.ok) {
          setEditingId(data.id)
          setName(data.name || '')
          setDescription(data.description || '')
          setDifficulty(data.difficulty || 'MODERATE')
          setEstimatedDuration(data.estimatedDurationMin ? String(data.estimatedDurationMin) : '')
          setIsPrivate(data.isPrivate || false)
          setPhotos(data.photos || [])
          setCategoryId(String(data.journeyCategoryId || ''))
          
          // Parse geoJson back to waypoints [[lat, lng], ...]
          if (data.geoJson) {
            try {
              const geo = JSON.parse(data.geoJson)
              if (geo.coordinates && geo.coordinates.length > 0) {
                const points = geo.coordinates.map(([lng, lat]) => [lat, lng])
                setWaypoints(points)
              }
            } catch { /* ignore */ }
          }
        }
      } catch {
        setMsg({ type: 'error', text: 'Error loading journey for editing.' })
      }
    }
    loadJourney()
  }, [isEdit, paramId, apiFetch])

  // Load spot info (for add-journey to spot)
  useEffect(() => {
    if (!spotId) return
    async function loadSpot() {
      try {
        const res = await apiFetch(`/api/v1/spots/${spotId}`)
        const data = await res.json()
        if (res.ok) {
          setSpot(data)
        }
      } catch {
        setMsg({ type: 'error', text: 'Error loading spot.' })
      }
    }
    loadSpot()
  }, [spotId, apiFetch])

  // Load journey categories
  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await apiFetch('/api/v1/journey-categories')
        if (res.ok) {
          const data = await res.json()
          setCategories(data)
          if (data.length > 0) setCategoryId(String(data[0].id))
        }
      } catch {
        console.error('Error loading categories')
      }
    }
    loadCategories()
  }, [apiFetch])

  // Current points based on mode
  const currentPoints = mode === 'draw' ? (snappedPoints.length > 1 ? snappedPoints : waypoints) : recordedPoints
  const distance = calculateTotalDistance(currentPoints)

  // Dynamically calculate suggested duration
  useEffect(() => {
    if (distance > 0) {
      setSuggestedDuration(getSuggestedDuration(distance, difficulty))
    } else {
      setSuggestedDuration(0)
    }
  }, [distance, difficulty])

  // Draw mode handlers
  const handleMapClick = useCallback((point) => {
    setSuggestions([]) // Dismiss suggestions list
    setSearchError('')
    setWaypoints(prev => [...prev, point])
  }, [])

  const handleWaypointDrag = (idx, newLatLng) => {
    setWaypoints(prev => {
      const next = [...prev]
      next[idx] = [newLatLng.lat, newLatLng.lng]
      return next
    })
  }

  const handleWaypointDelete = (idx) => {
    setWaypoints(prev => prev.filter((_, i) => i !== idx))
  }

  const undoLastPoint = () => {
    setWaypoints(prev => prev.slice(0, -1))
  }

  const clearAllPoints = () => {
    if (waypoints.length === 0) return
    if (window.confirm('Are you sure you want to clear all waypoints from this journey? This cannot be undone.')) {
      setWaypoints([])
    }
  }

  // Safe mode switching
  const switchMode = (newMode) => {
    if (newMode === mode) return
    if (newMode === 'gps') {
      if (waypoints.length > 0 && !window.confirm('Switching to GPS mode will clear your drawn points. Continue?')) {
        return
      }
      setWaypoints([])
      setMode('gps')
    } else {
      if (recordedPoints.length > 0 && !window.confirm('Switching to Draw mode will clear your recorded GPS path. Continue?')) {
        return
      }
      setRecordedPoints([])
      setMode('draw')
    }
  }

  // Geocoding Search & Suggestions
  const handlePlaceInput = (q) => {
    setSearchQuery(q)
    setSearchError('')
    clearTimeout(geocodeTimer.current)
    suggestionsAbort.current?.abort()
    
    const requestId = ++suggestionsRequestId.current
    if (q.length < 2) {
      setSuggestions([])
      return
    }
    
    setSearchLoading(true)
    geocodeTimer.current = setTimeout(async () => {
      const controller = new AbortController()
      suggestionsAbort.current = controller
      try {
        let combinedSuggestions = []
        // 1. Backend spot search
        try {
          const res = await apiFetch(`/api/v1/spots/search?q=${encodeURIComponent(q)}&limit=3`, { signal: controller.signal })
          const data = await res.json()
          if (res.ok && data?.length > 0) {
            combinedSuggestions = data.map(s => ({
              ...s,
              type: s.type || 'Spot',
              isPlace: false
            }))
          }
        } catch (e) {
          if (e.name !== 'AbortError') console.error(e)
        }
        
        // 2. Nominatim city/place search
        try {
          const nomRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`, {
            headers: { 'Accept-Language': 'en' },
            signal: controller.signal
          })
          const nomData = await nomRes.json()
          if (nomData?.length > 0) {
            const formatted = nomData.map(item => ({
              name: item.display_name.split(',')[0],
              type: 'Place',
              address: item.display_name,
              latitude: parseFloat(item.lat),
              longitude: parseFloat(item.lon),
              isPlace: true,
            }))
            const existingNames = new Set(combinedSuggestions.map(s => s.name))
            combinedSuggestions.push(...formatted.filter(f => !existingNames.has(f.name)))
          }
        } catch (e) {
          if (e.name !== 'AbortError') console.error(e)
        }
        
        if (requestId === suggestionsRequestId.current && !controller.signal.aborted) {
          setSuggestions(combinedSuggestions)
          if (combinedSuggestions.length === 0) {
            setSearchError('No locations found.')
          }
        }
      } catch (error) {
        if (error.name !== 'AbortError' && requestId === suggestionsRequestId.current) {
          setSuggestions([])
        }
      } finally {
        if (requestId === suggestionsRequestId.current && !controller.signal.aborted) {
          setSearchLoading(false)
        }
      }
    }, 250)
  }

  const selectSuggestion = (spot) => {
    console.log('selectSuggestion clicked for spot:', spot, 'map:', !!map)
    if (map && spot.latitude !== undefined && spot.longitude !== undefined) {
      // Use flyTo for smooth panning just like in SpotsPage
      map.flyTo([spot.latitude, spot.longitude], 14, { duration: 1.5 })
      setSearchQuery(spot.name)
      setSuggestions([])
      setSearchError('')
    } else {
      console.warn('Unable to navigate to suggestion. map:', !!map, 'lat:', spot?.latitude, 'lng:', spot?.longitude)
    }
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    if (suggestions.length > 0) {
      selectSuggestion(suggestions[0])
    }
  }

  // GPS recording handlers
  const startRecording = () => {
    if (!navigator.geolocation) {
      setMsg({ type: 'error', text: 'Geolocation is not supported by your browser.' })
      return
    }
    setIsRecording(true)
    setRecordedPoints([])
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const point = [pos.coords.latitude, pos.coords.longitude]
        setRecordedPoints(prev => {
          // Only add if moved more than 5 meters from last point
          if (prev.length === 0) return [point]
          const last = prev[prev.length - 1]
          const dist = haversineDistance(last[0], last[1], point[0], point[1])
          if (dist >= 5) return [...prev, point]
          return prev
        })
      },
      (err) => {
        console.error('GPS error:', err)
        setMsg({ type: 'error', text: 'GPS error: ' + (err.message || 'Unknown error') })
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    )
    watchIdRef.current = id
  }

  const stopRecording = () => {
    setIsRecording(false)
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }

  // Cleanup GPS watch & geocode timer on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
      clearTimeout(geocodeTimer.current)
      suggestionsAbort.current?.abort()
    }
  }, [])

  // Photo upload
  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true)
    try {
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
          setMsg({ type: 'error', text: `File ${file.name} exceeds 5MB limit.` })
          continue
        }
        const formData = new FormData()
        formData.append('file', file)
        const res = await apiFetch('/api/v1/upload', { method: 'POST', body: formData })
        if (res.ok) {
          const data = await res.json()
          setPhotos(prev => [...prev, data.url])
        }
      }
    } catch {
      setMsg({ type: 'error', text: 'Error uploading photos.' })
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index))
  }

  // Submit
  const handleSubmit = async () => {
    if (!name.trim()) {
      setMsg({ type: 'error', text: 'Please enter a name for this path.' })
      return
    }
    if (currentPoints.length < 2) {
      setMsg({ type: 'error', text: 'Please draw or record at least 2 points for the path.' })
      return
    }

    setSubmitting(true)
    setMsg({ type: '', text: '' })

    try {
      const geoJson = pointsToGeoJson(currentPoints)
      const validSpotId = spotId && !isNaN(parseInt(spotId)) ? parseInt(spotId) : null
      
      const body = {
        journeyCategoryId: parseInt(categoryId),
        name: name.trim(),
        description: description.trim() || null,
        difficulty,
        estimatedDurationMin: estimatedDuration ? parseInt(estimatedDuration) : null,
        distanceMeters: Math.round(distance),
        geoJson,
        photos,
        isPrivate,
      }

      // Include spotId only if valid
      if (validSpotId) {
        body.spotId = validSpotId
      }

      let res
      if (isEdit && editingId) {
        // Update existing journey – PUT request, sets status to PENDING after admin approval
        res = await apiFetch(`/api/v1/journeys/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        // New journey – POST
        const endpoint = validSpotId 
          ? `/api/v1/spots/${validSpotId}/paths`
          : '/api/v1/journeys'
        res = await apiFetch(endpoint, {
          method: 'POST',
          body: JSON.stringify(body),
        })
      }

      if (res.ok) {
        setMsg({
          type: 'success',
          text: isEdit
            ? '✓ Journey updated! It will be visible after admin approval.'
            : '✓ Journey submitted! It will be visible after admin approval.',
        })
        const redirectPath = editingId ? `/journey/${editingId}` : (validSpotId ? `/spot/${validSpotId}` : '/feed')
        setTimeout(() => navigate(redirectPath), 2000)
      } else {
        const data = await res.json()
        setMsg({ type: 'error', text: data.error || data.message || 'Failed to submit.' })
      }
    } catch {
      setMsg({ type: 'error', text: 'Could not reach server.' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleNextStep = () => {
    if (currentPoints.length >= 2) {
      setStep(2)
    }
  }

  const spotCenter = useMemo(() => {
    return spot ? [spot.latitude, spot.longitude] : [13.7563, 100.5018]
  }, [spot])

  return (
    <div className="submit-path-page animate-fade-in">
      <div className="submit-path-header">
        <button type="button" className="btn btn-ghost" onClick={() => {
          if (step === 2) {
            setStep(1)
          } else {
            navigate(-1)
          }
        }} style={{ padding: '0.2rem', minWidth: 'auto' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>
        <h2>
          {isEdit ? 'Edit Experience' : 'Add Experience'}
          {spot && !isEdit ? ` — ${spot.name}` : ''}
          <span className="step-indicator"> (Step {step} of 2)</span>
        </h2>
      </div>

      {step === 1 ? (
        /* STEP 1: Drawing & Map recording view */
        <div className="submit-path-content step-1-wizard animate-fade-in">
          <div className="submit-path-map-container full-map">
            
            {/* Location Search Bar with Suggestions */}
            <div 
              className="map-search-card glass" 
              onClick={e => e.stopPropagation()} 
              onMouseDown={e => e.stopPropagation()} 
              onDoubleClick={e => e.stopPropagation()}
            >
              <form onSubmit={handleSearchSubmit} className="search-form">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => handlePlaceInput(e.target.value)}
                  placeholder="Search spots, cities or trails..."
                  className="search-input"
                  autoComplete="off"
                />
                <button type="submit" className="search-btn animate-fade-in" disabled={searchLoading}>
                  {searchLoading ? (
                    <span className="spinner-sm"></span>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  )}
                </button>
              </form>
              
              {searchError && <div className="search-error">{searchError}</div>}
              
              {suggestions.length > 0 && (
                <ul className="search-results-list">
                  {suggestions.map((s, idx) => (
                    <li 
                      key={idx} 
                      onClick={(e) => {
                        e.stopPropagation();
                        selectSuggestion(s);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <div className="suggestion-item-main">
                        <strong className="suggestion-item-name">{s.name}</strong>
                        <span className="suggestion-item-meta"> ({s.type})</span>
                      </div>
                      {s.address && <div className="suggestion-item-sub">{s.address}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Snapping Overlay Indicator */}
            {isRouting && (
              <div className="routing-status-badge animate-pulse">
                <span className="spinner-sm"></span>
                <span>Snapping route to paths...</span>
              </div>
            )}

            {mode === 'draw' && (
              <div className="map-instructions">
                Click map to draw. Drag markers to adjust, click them to delete.
              </div>
            )}

            <MapContainer center={spotCenter} zoom={15} style={{ width: '100%', height: '100%' }} zoomControl={false}>
              <TileLayer
                url={`https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key=${import.meta.env.VITE_STADIA_API_KEY}`}
                attribution='Map tiles by <a href="https://stadiamaps.com/">Stadia Maps</a>'
              />

              <MapInstanceGetter setMap={setMap} />
              <DrawClickHandler onMapClick={handleMapClick} isDrawMode={mode === 'draw'} />
              <FitToPoints points={currentPoints} spotCenter={spotCenter} />
              <ZoomControls />

              {/* Spot marker */}
              {spot && (
                <Marker position={spotCenter} />
              )}

              {/* Waypoint markers (draw mode) */}
              {mode === 'draw' && waypoints.map((point, idx) => (
                <Marker
                  key={idx}
                  position={point}
                  draggable={true}
                  eventHandlers={{
                    dragend: (e) => {
                      const marker = e.target
                      const position = marker.getLatLng()
                      handleWaypointDrag(idx, position)
                    }
                  }}
                  icon={createWaypointIcon(idx, waypoints.length)}
                >
                  <Popup>
                    <div className="waypoint-popup">
                      <strong>Waypoint #{idx + 1}</strong>
                      <button
                        type="button"
                        className="btn-danger-popup"
                        onClick={() => handleWaypointDelete(idx)}
                      >
                        Delete Point
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Path line */}
              {currentPoints.length >= 2 && (
                <Polyline positions={currentPoints} pathOptions={{ color: '#3b82f6', weight: 4, opacity: isRouting ? 0.4 : 0.85, lineCap: 'round', lineJoin: 'round' }} />
              )}
            </MapContainer>

            {/* Floating Control HUD */}
            <div className="map-hud-card glass animate-fade-in">
              <div className="mode-toggle">
                <button type="button" className={mode === 'draw' ? 'active' : ''} onClick={() => switchMode('draw')}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"></path><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"></path><path d="M2 2l7.586 7.586"></path><circle cx="11" cy="11" r="2"></circle></svg>
                  Draw on Map
                </button>
                <button type="button" className={mode === 'gps' ? 'active' : ''} onClick={() => switchMode('gps')}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line></svg>
                  GPS Recording
                </button>
              </div>

              {/* GPS Controls */}
              {mode === 'gps' && (
                <div style={{ width: '100%' }}>
                  {!isRecording ? (
                    <button type="button" className="btn btn-primary" onClick={startRecording} style={{ width: '100%' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="8"></circle></svg>
                      Start Recording
                    </button>
                  ) : (
                    <div className="recording-indicator">
                      <span className="recording-dot"></span>
                      Recording... ({recordedPoints.length} points)
                      <button type="button" className="btn btn-ghost" onClick={stopRecording} style={{ marginLeft: 'auto', color: '#ef4444', padding: '0.2rem 0.5rem', minHeight: 'auto', height: 'auto' }}>
                        Stop
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Snap to Trails Toggle */}
              {mode === 'draw' && (
                <div className="snap-toggle-container">
                  <label className="snap-toggle-label">
                    <input
                      type="checkbox"
                      checked={snapToTrails}
                      onChange={e => setSnapToTrails(e.target.checked)}
                      className="snap-toggle-checkbox"
                    />
                    Snap route to trails/roads
                  </label>
                </div>
              )}

              {/* Path Stats */}
              {currentPoints.length >= 2 && (
                <div className="path-stats">
                  <div className="path-stat">
                    <span className="path-stat-label">Distance</span>
                    <span className="path-stat-value text-glow">
                      {distance >= 1000 ? `${(distance / 1000).toFixed(2)} km` : `${Math.round(distance)} m`}
                    </span>
                  </div>
                  <div className="path-stat">
                    <span className="path-stat-label">Waypoints</span>
                    <span className="path-stat-value">{currentPoints.length}</span>
                  </div>
                </div>
              )}

              {/* Drawing Actions */}
              {mode === 'draw' && waypoints.length > 0 && (
                <div className="map-hud-actions">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={undoLastPoint} style={{ flex: 1 }}>
                    Undo
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={clearAllPoints} style={{ flex: 1, color: '#ef4444' }}>
                    Clear All
                  </button>
                </div>
              )}

              <button
                type="button"
                className="btn btn-primary next-step-btn"
                disabled={currentPoints.length < 2}
                onClick={handleNextStep}
                style={{ width: '100%', marginTop: '0.25rem' }}
              >
                Next: Enter Details →
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* STEP 2: Details details page with small map preview */
        <div className="submit-path-content step-2-wizard animate-fade-in">
          
          {/* Form details card */}
          <div className="submit-path-form glass">
            {/* Category */}
            <div className="field">
              <label className="label">Category *</label>
              <select className="select" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            {/* Name */}
            <div className="field">
              <label className="label">Journey Name *</label>
              <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Scenic Loop, Ridge Trail..." maxLength={255} />
            </div>

            {/* Description */}
            <div className="field">
              <label className="label">Description</label>
              <textarea className="textarea" value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the journey, notable landmarks, terrain..." maxLength={2000} rows={4} />
            </div>

            {/* Difficulty */}
            <div className="field">
              <label className="label">Difficulty</label>
              <div className="difficulty-selector">
                {['EASY', 'MODERATE', 'HARD', 'EXPERT'].map(d => (
                  <button key={d} type="button" className={`difficulty-option ${d.toLowerCase()} ${difficulty === d ? 'active' : ''}`} onClick={() => setDifficulty(d)}>
                    {d.charAt(0) + d.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div className="field">
              <label className="label">Estimated Duration (minutes)</label>
              <div className="duration-input-container">
                <input className="input" type="number" min="1" value={estimatedDuration} onChange={e => setEstimatedDuration(e.target.value)} placeholder="e.g. 45" />
                {suggestedDuration > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary suggest-btn btn-sm"
                    onClick={() => setEstimatedDuration(String(suggestedDuration))}
                  >
                    Suggest {suggestedDuration} min
                  </button>
                )}
              </div>
            </div>

            {/* Privacy */}
            <div className="privacy-toggle">
              <label>
                <input type="checkbox" checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)} />
                Private journey (only visible to you)
              </label>
            </div>

            {/* Photos */}
            <div className="field">
              <label className="label">Photos (optional)</label>
              <div>
                <label className="btn btn-secondary" style={{ cursor: uploading ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', margin: 0 }}>
                  {uploading ? 'Uploading...' : 'Upload Photos'}
                  <input type="file" multiple accept="image/*" onChange={handlePhotoUpload} disabled={uploading} style={{ display: 'none' }} />
                </label>
              </div>
              {uploading && <p style={{ fontSize: '0.8rem', color: 'var(--primary)', margin: '0.3rem 0 0' }}>Uploading...</p>}
              {photos.length > 0 && (
                <div className="photo-preview-grid">
                  {photos.map((url, idx) => (
                    <div key={idx} className="photo-preview-item">
                      <img src={url} alt={`Photo ${idx + 1}`} />
                      <button type="button" className="remove-btn" onClick={() => removePhoto(idx)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Message */}
            {msg.text && <div className={`submit-msg ${msg.type}`}>{msg.text}</div>}

            {/* Back & Submit buttons */}
            <div className="form-actions-row">
              <button type="button" className="btn btn-secondary" onClick={() => setStep(1)} style={{ flex: 1 }}>
                ← Edit Route
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={submitting} style={{ flex: 2 }}>
                {submitting ? 'Submitting...' : 'Submit Experience'}
              </button>
            </div>
          </div>

          {/* Map preview panel */}
          <div className="submit-path-map-container preview-map">
            <div className="map-preview-badge">Route Preview</div>
            <MapContainer center={currentPoints[0] || spotCenter} zoom={15} style={{ width: '100%', height: '100%' }} zoomControl={false}>
              <TileLayer
                url={`https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key=${import.meta.env.VITE_STADIA_API_KEY}`}
                attribution='Map tiles by <a href="https://stadiamaps.com/">Stadia Maps</a>'
              />
              <FitToPoints points={currentPoints} spotCenter={spotCenter} />
              
              {/* Only start and end waypoint markers on preview */}
              {currentPoints.length > 0 && (
                <Marker position={currentPoints[0]} icon={createWaypointIcon(0, currentPoints.length)} />
              )}
              {currentPoints.length > 1 && (
                <Marker position={currentPoints[currentPoints.length - 1]} icon={createWaypointIcon(currentPoints.length - 1, currentPoints.length)} />
              )}

              <Polyline positions={currentPoints} pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }} />
            </MapContainer>
          </div>

        </div>
      )}
    </div>
  )
}
