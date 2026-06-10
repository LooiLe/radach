import { useState, useEffect, useRef, useCallback, Fragment } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useApi } from '../hooks/useApi'
import { useToast } from '../components/ToastProvider'
import 'leaflet/dist/leaflet.css'
import './ItineraryDetailPage.css'

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
    route.setAttribute('stroke', '#6b7280')
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
    .filter(stop => stop.spot?.latitude != null && stop.spot?.longitude != null)
    .map((stop, idx) => ({
      lat: stop.spot.latitude,
      lng: stop.spot.longitude,
      type: stop.spot.type,
      number: idx + 1
    }))
}

function normalizeStop(stop) {
  if (stop.spot) return stop
  return {
    ...stop,
    spot: {
      id: stop.spotId,
      name: stop.spotName || 'Unknown spot',
      type: stop.spotType || '',
      address: stop.spotAddress || '',
      latitude: stop.spotLatitude,
      longitude: stop.spotLongitude,
      photos: stop.spotPhotos || [],
      averageRating: stop.spotAverageRating || 0
    }
  }
}

export default function ItineraryDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { apiFetch } = useApi()
  const { toast } = useToast()

  const [itinerary, setItinerary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const mapInstanceRef = useRef(null)
  const setMapRef = useCallback((mapInstance) => { mapInstanceRef.current = mapInstance }, [])

  // Edit fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [currentDayTab, setCurrentDayTab] = useState(1)
  const [stops, setStops] = useState([]) // array of: { spot, startTime, durationMinutes, notes, dayNumber, estimatedCost }

  // Helper to calculate total days
  const getDaysCount = () => {
    if (!itinerary || !itinerary.date) return 1
    const end = itinerary.endDate || endDate || date || itinerary.date
    const start = date || itinerary.date
    const startD = new Date(start)
    const endD = new Date(end)
    if (isNaN(startD) || isNaN(endD) || endD < startD) return 1
    const diffTime = Math.abs(endD - startD)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
    return Math.min(diffDays, 7) // capped at 7 days
  }
  const totalDays = getDaysCount()
  const maxStopDay = stops.reduce((max, stop) => {
    const dayNumber = Number(stop.dayNumber)
    return Number.isFinite(dayNumber) && dayNumber > 0 ? Math.max(max, dayNumber) : max
  }, 1)
  const visibleDayCount = Math.max(totalDays, maxStopDay)
  const dayTabCount = Number.isFinite(visibleDayCount) && visibleDayCount > 0 ? visibleDayCount : 1

  // Clamp currentDayTab when the visible day range shrinks
  useEffect(() => {
    if (currentDayTab > dayTabCount) {
      setCurrentDayTab(dayTabCount)
    }
  }, [dayTabCount, currentDayTab])

  // Spot selector for additions
  const [showAddForm, setShowAddForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [savedSpots, setSavedSpots] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showSavedOnly, setShowSavedOnly] = useState(true)

  const [updating, setUpdating] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [travelLegs, setTravelLegs] = useState([])
  const [cloning, setCloning] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [swappingStopId, setSwappingStopId] = useState(null)

  // Fetch OSRM travel durations & distances between consecutive stops of the current day
  useEffect(() => {
    const currentDayStops = stops.filter(s => (s.dayNumber || 1) === currentDayTab)
    if (currentDayStops.length <= 1) {
      setTravelLegs([])
      return
    }

    async function fetchAllLegs() {
      const legs = []
      for (let i = 0; i < currentDayStops.length - 1; i++) {
        const curSpot = currentDayStops[i].spot
        const nextSpot = currentDayStops[i + 1].spot
        if (!curSpot || !nextSpot || curSpot.latitude == null || curSpot.longitude == null || nextSpot.latitude == null || nextSpot.longitude == null) {
          legs.push(null)
          continue
        }

        const lat1 = curSpot.latitude
        const lng1 = curSpot.longitude
        const lat2 = nextSpot.latitude
        const lng2 = nextSpot.longitude

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
  }, [stops, currentDayTab])

  useEffect(() => {
    loadItinerary()
    loadSavedSpots()
  }, [id])

  // Auto-schedule scheduler helper
  useEffect(() => {
    if (!isEditing || stops.length === 0) return
    const updated = [...stops]
    
    // Group stops by day, run scheduling for each day's stops
    const days = [...new Set(stops.map(s => s.dayNumber || 1))].sort((a, b) => a - b)
    
    for (const day of days) {
      const dayStopsIndices = []
      for (let i = 0; i < updated.length; i++) {
        if ((updated[i].dayNumber || 1) === day) {
          dayStopsIndices.push(i)
        }
      }
      
      if (dayStopsIndices.length === 0) continue
      
      let currentHour = 9
      let currentMin = 0
      
      // If first stop of this day has a start time, use it
      const firstStopIdx = dayStopsIndices[0]
      if (updated[firstStopIdx].startTime) {
        const match = updated[firstStopIdx].startTime.split(':')
        if (match.length >= 2) {
          const h = parseInt(match[0])
          const m = parseInt(match[1])
          if (!isNaN(h) && !isNaN(m)) {
            currentHour = h
            currentMin = m
          }
        }
      }
      
      for (let idx = 0; idx < dayStopsIndices.length; idx++) {
        const i = dayStopsIndices[idx]
        const startStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`
        updated[i].startTime = startStr

        const duration = updated[i].durationMinutes || 60
        let endMinTotal = currentHour * 60 + currentMin + duration
        const endHour = Math.floor(endMinTotal / 60) % 24
        const endMin = endMinTotal % 60
        updated[i].endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`

        // Add dynamic travel buffer for the next start time
        let buffer = 15
        if (idx < dayStopsIndices.length - 1) {
          const curSpot = updated[i].spot
          const nextSpot = updated[dayStopsIndices[idx + 1]].spot
          if (curSpot && nextSpot && curSpot.latitude != null && curSpot.longitude != null && nextSpot.latitude != null && nextSpot.longitude != null) {
            buffer = estimateTravelTimeMinutes(curSpot.latitude, curSpot.longitude, nextSpot.latitude, nextSpot.longitude)
          }
        }

        let nextMinTotal = endHour * 60 + endMin + buffer
        currentHour = Math.floor(nextMinTotal / 60) % 24
        currentMin = nextMinTotal % 60
      }
    }

    let changed = false
    for (let i = 0; i < stops.length; i++) {
      if (stops[i].startTime !== updated[i].startTime || stops[i].endTime !== updated[i].endTime) {
        changed = true
        break
      }
    }
    if (changed) {
      setStops(updated)
    }
  }, [stops, isEditing])

  async function loadItinerary() {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/v1/itineraries/${id}`)
      if (res.ok) {
        const data = await res.json()
        setItinerary(data)
        setTitle(data.title)
        setDescription(data.description || '')
        setDate(data.date || '')
        setEndDate(data.endDate || data.date || '')
        setCurrency(data.currency || 'USD')
        setStops((data.stops || []).map(normalizeStop).map(s => ({
          ...s,
          estimatedCost: s.estimatedCostCents != null ? (s.estimatedCostCents / 100).toString() : ''
        })))
      } else {
        toast.error('Itinerary not found or access denied')
        navigate('/itineraries')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  async function loadSavedSpots() {
    try {
      const res = await apiFetch('/api/v1/spots/saved')
      if (res.ok) {
        setSavedSpots(await res.json())
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Spot autocomplete search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    const timeout = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await apiFetch(`/api/v1/spots/search?q=${encodeURIComponent(searchQuery)}&limit=6`)
        if (res.ok) {
          setSearchResults(await res.json())
        }
      } catch (err) {
        console.error(err)
      } finally {
        setSearchLoading(false)
      }
    }, 400)
    return () => clearTimeout(timeout)
  }, [searchQuery, apiFetch])

  const handleAddStop = (spot) => {
    if (stops.some(s => s.spot.id === spot.id)) {
      toast.warning('This spot is already in the itinerary')
      return
    }
    const dayStops = stops.filter(s => (s.dayNumber || 1) === currentDayTab)
    setStops(prev => [
      ...prev,
      {
        spot,
        startTime: dayStops.length === 0 ? '09:00' : '',
        durationMinutes: 60,
        notes: '',
        dayNumber: currentDayTab,
        estimatedCost: ''
      }
    ])
    setShowAddForm(false)
  }

  const handleRemoveStop = (spotId) => {
    setStops(prev => prev.filter(s => s.spot.id !== spotId))
  }

  const handleMoveStop = (indexInFiltered, direction) => {
    const currentDayStops = stops.filter(s => (s.dayNumber || 1) === currentDayTab)
    const targetIndexInFiltered = indexInFiltered + direction
    if (targetIndexInFiltered < 0 || targetIndexInFiltered >= currentDayStops.length) return
    
    const updatedDayStops = [...currentDayStops]
    const temp = updatedDayStops[indexInFiltered]
    updatedDayStops[indexInFiltered] = updatedDayStops[targetIndexInFiltered]
    updatedDayStops[targetIndexInFiltered] = temp
    
    const otherDaysStops = stops.filter(s => (s.dayNumber || 1) !== currentDayTab)
    setStops([...otherDaysStops, ...updatedDayStops])
  }

  const handleStopChange = (spotId, key, val) => {
    setStops(prev => prev.map(s => s.spot.id === spotId ? { ...s, [key]: val } : s))
  }

  async function handleSaveChanges() {
    if (!title.trim()) {
      toast.warning('Please enter a title for this itinerary')
      return
    }
    setUpdating(true)
    try {
      const payload = {
        title: title.trim(),
        description,
        date: date || null,
        endDate: endDate || date || null,
        currency: currency || 'USD',
        stops: stops.map((s, idx) => ({
          spotId: s.spot.id,
          stopOrder: idx + 1,
          startTime: s.startTime,
          endTime: s.endTime,
          durationMinutes: parseInt(s.durationMinutes) || 60,
          notes: s.notes,
          dayNumber: s.dayNumber || 1,
          estimatedCostCents: s.estimatedCost ? Math.round(parseFloat(s.estimatedCost) * 100) : null
        }))
      }

      const res = await apiFetch(`/api/v1/itineraries/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        const updatedData = await res.json()
        setItinerary(updatedData)
        setStops((updatedData.stops || []).map(normalizeStop).map(s => ({
          ...s,
          estimatedCost: s.estimatedCostCents != null ? (s.estimatedCostCents / 100).toString() : ''
        })))
        setIsEditing(false)
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Failed to update itinerary')
      }
    } catch (e) {
      console.error(e)
      toast.error('Failed to connect to backend')
    } finally {
      setUpdating(false)
    }
  }

  const handleCopyShareLink = () => {
    if (!itinerary || !itinerary.shareToken) return;
    const url = `${window.location.origin}/itineraries/share/${itinerary.shareToken}`;
    navigator.clipboard.writeText(url)
      .then(() => {
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
        toast.info('Could not copy share link. Here is the link: ' + url, 8000);
      });
  }

  async function handleDeleteItinerary() {
    try {
      const res = await apiFetch(`/api/v1/itineraries/${id}`, { method: 'DELETE' })
      if (res.ok) {
        navigate('/itineraries')
      } else {
        toast.error('Failed to delete itinerary')
      }
    } catch (e) {
      console.error(e)
      toast.error('Failed to delete itinerary')
    }
  }

  async function handleCloneItinerary() {
    setCloning(true)
    try {
      const res = await apiFetch(`/api/v1/itineraries/${id}/clone`, { method: 'POST' })
      if (res.ok) {
        const cloned = await res.json()
        navigate(`/itineraries/${cloned.id}`)
      } else {
        toast.error('Failed to duplicate itinerary')
      }
    } catch (e) {
      console.error(e)
      toast.error('Failed to duplicate itinerary')
    } finally {
      setCloning(false)
    }
  }

  async function handleRegenerate() {
    setRegenerating(true)
    try {
      const res = await apiFetch(`/api/v1/itineraries/${id}/regenerate`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setItinerary(data)
        setTitle(data.title)
        setDescription(data.description || '')
        setDate(data.date || '')
        setStops((data.stops || []).map(normalizeStop))
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || err.message || 'Failed to regenerate itinerary')
      }
    } catch (e) {
      console.error(e)
      toast.error('Failed to regenerate itinerary')
    } finally {
      setRegenerating(false)
    }
  }

  async function handleSwapStop(stopId) {
    setSwappingStopId(stopId)
    try {
      const res = await apiFetch(`/api/v1/itineraries/${id}/stops/${stopId}/swap`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setItinerary(data)
        setStops((data.stops || []).map(normalizeStop))
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.message || 'No alternative spots available')
      }
    } catch (e) {
      console.error(e)
      toast.error('Failed to swap stop')
    } finally {
      setSwappingStopId(null)
    }
  }

  function handlePrint() {
    const pageEl = document.querySelector('.itinerary-detail-page')
    const map = mapInstanceRef.current
    if (!pageEl) { window.print(); return }

    const printPoints = buildPrintPoints(stops)
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

    // 1. Apply print layout class
    pageEl.classList.add('print-layout-active')

    // 2. Wait for the browser to compute the new layout, then resize the map
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (map) {
          map.invalidateSize({ animate: false })
          if (mapBounds.length > 0) {
            map.fitBounds(mapBounds, { padding: [40, 40], maxZoom: 15 })
          }
        }
        // 3. Wait one more frame for Leaflet to flush SVG/tile updates to the DOM
        requestAnimationFrame(() => {
          setTimeout(() => {
            // 4. Convert all translate3d to translate (2D) inside the map container.
            //    Chrome's print renderer skips GPU-composited layers created by translate3d.
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

              // 5. Restore original 3D transforms and screen layout
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

  if (loading) {
    return (
      <div className="itinerary-detail-page">
        <div style={{ textAlign: 'center', padding: '5rem', color: '#999' }}>
          <div className="loading-spinner" />
          Loading itinerary details...
        </div>
      </div>
    )
  }

  const canManage = !!itinerary
  const mapBounds = stops
    .filter(s => s.spot?.latitude != null && s.spot?.longitude != null)
    .map(s => [s.spot.latitude, s.spot.longitude])

  return (
    <div className="itinerary-detail-page">
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
          {stops.map((stop, idx) => (
            stop.spot?.latitude != null && stop.spot?.longitude != null && (
            <Marker
              key={`marker-${stop.spot.id}-${idx}`}
              position={[stop.spot.latitude, stop.spot.longitude]}
              icon={createNumberMarkerIcon(idx + 1, stop.spot.type)}
            >
              <Popup>
                <strong>#{idx + 1} {stop.spot.name}</strong><br />
                {stop.startTime} - {stop.endTime}<br />
                {stop.notes && <em>"{stop.notes}"</em>}
              </Popup>
            </Marker>
            )
          ))}
          {mapBounds.length > 1 && (
            <Polyline
              positions={mapBounds}
              color="#6b7280"
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
            <Link to="/itineraries" className="back-link">
              All Itineraries
            </Link>
            {itinerary.source === 'GENERATED' && <span className="source-badge generated">Generated</span>}
            {itinerary.source === 'MANUAL' && <span className="source-badge manual">Manual Plan</span>}
          </div>

          {isEditing ? (
            <div className="editing-fields">
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Itinerary Title"
                className="edit-title-input"
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#64748b' }}>Start Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => {
                      const val = e.target.value
                      setDate(val)
                      if (new Date(endDate) < new Date(val)) {
                        setEndDate(val)
                      }
                    }}
                    className="edit-date-input"
                    style={{ margin: 0, width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: '#64748b' }}>End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    min={date}
                    onChange={e => setEndDate(e.target.value)}
                    className="edit-date-input"
                    style={{ margin: 0, width: '100%' }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: '0.5rem' }}>
                <label style={{ fontSize: '0.75rem', color: '#64748b' }}>Currency</label>
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  className="edit-date-input"
                  style={{ width: '100%', padding: '0.25rem', height: '36px' }}
                >
                  <option value="USD">USD ($)</option>
                  <option value="SGD">SGD (S$)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="AUD">AUD (A$)</option>
                  <option value="JPY">JPY (¥)</option>
                </select>
              </div>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Description"
                className="edit-desc-input"
              />
            </div>
          ) : (
            <div className="display-fields">
              <h2>{itinerary.title}</h2>
              {itinerary.date && (
                <div className="detail-date">
                  {itinerary.date} {itinerary.endDate && itinerary.endDate !== itinerary.date ? ` to ${itinerary.endDate}` : ''}
                </div>
              )}
              {itinerary.description && <p className="detail-desc">{itinerary.description}</p>}
            </div>
          )}

          {canManage && (
            <div className="owner-actions">
              {isEditing ? (
                <>
                  <button onClick={handleSaveChanges} disabled={updating} className="btn-save">
                    {updating ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button onClick={() => { setIsEditing(false); loadItinerary(); }} className="btn-cancel">
                    Cancel
                  </button>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => setIsEditing(true)} className="btn-edit" style={{ flex: 1 }}>
                      Edit Route
                    </button>
                    <button onClick={() => setShowDeleteConfirm(true)} className="btn-delete" style={{ flex: 1 }}>
                      Delete
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={handleCopyShareLink} className="btn-edit" style={{ flex: 1 }}>
                      {shareCopied ? 'Link Copied!' : 'Copy Share Link'}
                    </button>
                    <button onClick={handlePrint} className="btn-edit" style={{ flex: 1 }}>
                      Export PDF / Print
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={handleCloneItinerary} disabled={cloning} className="btn-edit" style={{ flex: 1 }}>
                      {cloning ? 'Duplicating...' : 'Duplicate Itinerary'}
                    </button>
                  </div>
                  {itinerary.source === 'GENERATED' && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={handleRegenerate} disabled={regenerating} className="btn-edit" style={{ flex: 1 }}>
                        {regenerating ? 'Regenerating...' : 'Regenerate Route'}
                      </button>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Link to={`/ar/${id}`} className="btn-edit" style={{ flex: 1, background: 'rgba(139, 92, 246, 0.12)', borderColor: 'rgba(139, 92, 246, 0.25)', color: '#7c3aed', textDecoration: 'none', textAlign: 'center' }}>
                      🔮 AR Explorer
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* TIMELINE LIST */}
        <div className="detail-timeline-section">
          <h3>Route Timeline</h3>

          <div className="day-tabs-container" aria-label="Itinerary days">
            {Array.from({ length: dayTabCount }, (_, i) => i + 1).map(day => (
              <button
                key={`day-tab-${day}`}
                type="button"
                className={`day-tab-btn ${currentDayTab === day ? 'active' : ''}`}
                aria-current={currentDayTab === day ? 'page' : undefined}
                onClick={() => setCurrentDayTab(day)}
              >
                Day {day}
              </button>
            ))}
          </div>

          {stops.length > 0 && (
            <div className="budget-summary">
              <div>Day {currentDayTab} Budget: <strong>{currency} {stops.filter(s => (s.dayNumber || 1) === currentDayTab).reduce((sum, s) => sum + (parseFloat(s.estimatedCost) || 0), 0).toFixed(2)}</strong></div>
              <div>Total Budget: <strong>{currency} {stops.reduce((sum, s) => sum + (parseFloat(s.estimatedCost) || 0), 0).toFixed(2)}</strong></div>
            </div>
          )}

          {stops.filter(s => (s.dayNumber || 1) === currentDayTab).length === 0 ? (
            <div className="empty-timeline-message">
              No stops for Day {currentDayTab} yet.
            </div>
          ) : (
            <div className="detail-timeline-list">
              {stops.filter(s => (s.dayNumber || 1) === currentDayTab).map((stop, idx) => (
                <Fragment key={`stop-group-${stop.spot.id}`}>
                  <div className="detail-stop-card glass">
                    <div className="stop-badge">#{idx + 1}</div>

                    <div className="stop-details">
                      <div className="stop-header">
                        <h4 className="stop-name">{stop.spot.name}</h4>
                        <span className="stop-type">{stop.spot.type}</span>
                      </div>

                      <div className="stop-time">
                        {stop.startTime} - {stop.endTime} ({stop.durationMinutes} mins)
                      </div>

                      {isEditing ? (
                        <div className="stop-edit-inputs">
                          <div className="edit-row">
                            <label>Start Time</label>
                            <input
                              type="time"
                              value={stop.startTime}
                              onChange={e => handleStopChange(stop.spot.id, 'startTime', e.target.value)}
                              disabled={idx > 0} // automatic scheduling handles subsequent stops of the day
                              className="mini-input"
                            />
                          </div>
                          <div className="edit-row">
                            <label>Duration</label>
                            <input
                              type="number"
                              min="10"
                              step="5"
                              value={stop.durationMinutes}
                              onChange={e => handleStopChange(stop.spot.id, 'durationMinutes', parseInt(e.target.value) || 0)}
                              className="mini-input"
                            />
                          </div>
                          <div className="edit-row">
                            <label>Cost ({currency})</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="0.00"
                              value={stop.estimatedCost || ''}
                              onChange={e => handleStopChange(stop.spot.id, 'estimatedCost', e.target.value)}
                              className="mini-input"
                              style={{ width: '80px' }}
                            />
                          </div>
                          <div className="edit-row notes-row">
                            <input
                              type="text"
                              placeholder="Add notes for this stop..."
                              value={stop.notes || ''}
                              onChange={e => handleStopChange(stop.spot.id, 'notes', e.target.value)}
                              className="mini-notes-input"
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          {stop.notes && <div className="stop-notes"><em>"{stop.notes}"</em></div>}
                          {stop.estimatedCost && (
                            <div className="stop-cost" style={{ fontSize: '0.825rem', color: '#475569', marginTop: '0.25rem' }}>
                              Est. Cost: <strong>{currency} {parseFloat(stop.estimatedCost).toFixed(2)}</strong>
                            </div>
                          )}
                          <div className="stop-navigation-link">
                            <Link to={`/spot/${stop.spot.id}`} className="btn-spot-link">
                              View Spot
                            </Link>
                            <Link to={`/directions/${stop.spot.id}`} className="btn-directions-link">
                              Get Directions
                            </Link>
                            {itinerary.source === 'GENERATED' && stop.id && (
                              <button
                                onClick={() => handleSwapStop(stop.id)}
                                disabled={swappingStopId === stop.id}
                                className="btn-swap-link"
                              >
                                {swappingStopId === stop.id ? 'Swapping...' : 'Swap'}
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {isEditing && (
                      <div className="stop-edit-controls">
                        <button onClick={() => handleMoveStop(idx, -1)} disabled={idx === 0} className="edit-arrow-btn">▲</button>
                        <button onClick={() => handleMoveStop(idx, 1)} disabled={idx === stops.filter(s => (s.dayNumber || 1) === currentDayTab).length - 1} className="edit-arrow-btn">▼</button>
                        <button onClick={() => handleRemoveStop(stop.spot.id)} className="edit-remove-btn">&#x2715;</button>
                      </div>
                    )}
                  </div>

                  {idx < stops.filter(s => (s.dayNumber || 1) === currentDayTab).length - 1 && travelLegs[idx] && (
                    <div className="timeline-travel-connector">
                      <div className="connector-line"></div>
                      <div className="travel-pill">
                        {travelLegs[idx].mode === 'walk' ? 'Walk' : 'Drive'}{' '}
                        <strong>{travelLegs[idx].durationMinutes} min</strong> ({travelLegs[idx].distanceKm} km)
                      </div>
                    </div>
                  )}
                </Fragment>
              ))}
            </div>
          )}

          {isEditing && !showAddForm && (
            <button className="btn-add-stop-trigger" onClick={() => setShowAddForm(true)}>
              + Add Another Spot
            </button>
          )}

          {isEditing && showAddForm && (
            <div className="add-stop-panel glass">
              <div className="panel-header">
                <h4>Select Spot to Add</h4>
                <button onClick={() => setShowAddForm(false)} className="close-panel-btn">&#x2715;</button>
              </div>

              <div className="selector-filters">
                <button 
                  className={`filter-btn ${showSavedOnly ? 'active' : ''}`}
                  onClick={() => setShowSavedOnly(true)}
                >
                  Saved Spots
                </button>
                <button 
                  className={`filter-btn ${!showSavedOnly ? 'active' : ''}`}
                  onClick={() => setShowSavedOnly(false)}
                >
                  Search All
                </button>
              </div>

              {showSavedOnly ? (
                <div className="saved-spots-mini-list">
                  {savedSpots.length === 0 ? (
                    <p className="no-spots-text">No saved spots found.</p>
                  ) : (
                    savedSpots.map(spot => (
                      <div key={`mini-saved-${spot.id}`} className="mini-spot-card">
                        <span>{spot.name}</span>
                        <button onClick={() => handleAddStop(spot)}>Add</button>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="search-spots-mini">
                  <input
                    type="text"
                    placeholder="Search name..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="styled-input mini-search"
                  />
                  {searchLoading && <div className="loading-spinner search-spin" />}
                  <div className="saved-spots-mini-list">
                    {searchResults.map(spot => (
                      <div key={`mini-search-${spot.id}`} className="mini-spot-card">
                        <span>{spot.name}</span>
                        <button onClick={() => handleAddStop(spot)}>Add</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="confirm-lightbox" role="dialog" aria-modal="true" aria-labelledby="delete-itinerary-title">
          <div className="confirm-dialog">
            <h3 id="delete-itinerary-title">Delete itinerary?</h3>
            <p>
              This will permanently remove "{itinerary.title}" and all saved stops in this itinerary.
            </p>
            <div className="confirm-actions">
              <button className="confirm-secondary" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
              <button className="confirm-danger" onClick={handleDeleteItinerary}>
                Delete itinerary
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
