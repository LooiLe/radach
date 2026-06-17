import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useDeviceSensors } from '../hooks/useDeviceSensors'
import { useARProjection } from '../hooks/useARProjection'
import { useARNavigation } from '../hooks/useARNavigation'
import { useToast } from '../components/ToastProvider'
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

// SVG Compass Needle component
function CompassNeedle({ rotation }) {
  return (
    <svg
      className="ar-compass-svg"
      viewBox="0 0 24 24"
      style={{ transform: `rotate(${-rotation}deg)` }}
    >
      <polygon points="12,2 15,10 12,8 9,10" fill="#e11d48" />
      <polygon points="12,22 9,14 12,16 15,14" fill="rgba(18, 24, 38, 0.3)" />
      <circle cx="12" cy="12" r="2" fill="rgba(18, 24, 38, 0.5)" />
    </svg>
  )
}

// Navigation arrow SVG
function NavArrowSVG({ color }) {
  return (
    <svg viewBox="0 0 64 64" fill="none">
      <path
        d="M32 8 L50 40 L40 36 L40 56 L24 56 L24 36 L14 40 Z"
        fill={color}
        fillOpacity="0.6"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function ARViewPage() {
  const { itineraryId, spotId } = useParams()
  const navigate = useNavigate()
  const { apiFetch } = useApi()
  const { toast } = useToast()

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

  // ─── AR v2 state ───
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onboardingExit, setOnboardingExit] = useState(false)
  const [showNavigation, setShowNavigation] = useState(!!itineraryId)
  const [nearbyAnnotations, setNearbyAnnotations] = useState([])
  const [showAnnotationModal, setShowAnnotationModal] = useState(false)
  const [annotationForm, setAnnotationForm] = useState({ title: '', description: '' })
  const [annotationSubmitting, setAnnotationSubmitting] = useState(false)
  const [annotationDistance, setAnnotationDistance] = useState(3)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState('')
  const [capturedPhotoPreview, setCapturedPhotoPreview] = useState('')
  const [pinnedLocation, setPinnedLocation] = useState(null)

  const isAnnotationCancelledRef = useRef(false)
  const activePhotoUrlRef = useRef(null)

  const videoRef = useRef(null)
  const radarRef = useRef(null)
  const cameraStreamRef = useRef(null)
  const activeCameraStreamsRef = useRef(new Set())
  const cameraStoppedRef = useRef(true)

  // ─── Navigation hook ───
  const arNav = useARNavigation({
    itineraryStops,
    position,
    heading,
    enabled: showNavigation && !!itineraryId
  })

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

  const handleCancelAnnotation = useCallback(async () => {
    isAnnotationCancelledRef.current = true
    const urlToDelete = activePhotoUrlRef.current

    // Clear state immediately for responsive UI
    setShowAnnotationModal(false)
    setCapturedPhotoUrl('')
    setCapturedPhotoPreview('')
    setPinnedLocation(null)

    if (urlToDelete) {
      try {
        const res = await apiFetch(`/api/v1/upload?url=${encodeURIComponent(urlToDelete)}`, {
          method: 'DELETE'
        })
        if (!res.ok) {
          console.error('Failed to delete photo on cancel')
        }
      } catch (err) {
        console.error('Error deleting photo on cancel:', err)
      }
    }
  }, [apiFetch])

  // Keep activePhotoUrlRef in sync with capturedPhotoUrl state
  useEffect(() => {
    activePhotoUrlRef.current = capturedPhotoUrl
  }, [capturedPhotoUrl])

  // Clean up any unsubmitted uploaded photo when component unmounts
  useEffect(() => {
    return () => {
      if (activePhotoUrlRef.current) {
        const urlToDelete = activePhotoUrlRef.current
        apiFetch(`/api/v1/upload?url=${encodeURIComponent(urlToDelete)}`, {
          method: 'DELETE'
        }).catch(err => {
          console.error('Failed to cleanup unsubmitted photo on unmount:', err)
        })
      }
    }
  }, [apiFetch])

  // Track window resizes
  useEffect(() => {
    const handler = () => setScreenDimensions({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // ─── Onboarding (show once) ───
  useEffect(() => {
    if (hasPermission && !localStorage.getItem('ar_onboarding_seen')) {
      setShowOnboarding(true)
      const timer = setTimeout(() => {
        setOnboardingExit(true)
        setTimeout(() => {
          setShowOnboarding(false)
          setOnboardingExit(false)
          localStorage.setItem('ar_onboarding_seen', '1')
        }, 400)
      }, 3500)
      return () => clearTimeout(timer)
    }
  }, [hasPermission])

  // Combine itinerary stops + nearby spots into one POI list
  const excludeIds = useMemo(
    () => itineraryStops.map(s => s.spot?.id).filter(Boolean),
    [itineraryStops]
  )

  const allPOIs = useMemo(() => [
    ...itineraryStops.map((s, idx) => ({
      ...s.spot,
      isItineraryStop: true,
      isAnnotation: false,
      stopNumber: idx + 1,
      notes: s.notes,
      startTime: s.startTime,
    })),
    ...nearbySpots.filter(ns =>
      !excludeIds.includes(ns.id)
    ).map(s => ({ ...s, isItineraryStop: false, isAnnotation: false })),
    ...nearbyAnnotations.map(ann => ({
      id: `ann-${ann.id}`,
      annotationId: ann.id,
      name: ann.title,
      latitude: ann.latitude,
      longitude: ann.longitude,
      type: 'annotation',
      isItineraryStop: false,
      isAnnotation: true,
      annotationData: ann
    }))
  ], [itineraryStops, nearbySpots, excludeIds, nearbyAnnotations])

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

  // Suggest snapping to closest spot (front/nearby) based on pinned location (or live position if not pinned yet)
  const closestSpotPreset = useMemo(() => {
    const baseLat = pinnedLocation ? pinnedLocation.latitude : positionLatitude
    const baseLng = pinnedLocation ? pinnedLocation.longitude : positionLongitude
    const baseHeading = pinnedLocation ? pinnedLocation.heading : heading

    if (baseLat == null || baseLng == null) return null

    const spots = allPOIs.filter(poi => !poi.isAnnotation)
    if (!spots.length) return null

    const projected = spots.map(poi => {
      const lat = poi.latitude ?? poi.lat
      const lng = poi.longitude ?? poi.lng
      
      const R = 6371000
      const toRad = deg => deg * Math.PI / 180
      const toDeg = rad => rad * 180 / Math.PI

      const φ1 = toRad(baseLat)
      const φ2 = toRad(lat)
      const Δφ = toRad(lat - baseLat)
      const Δλ = toRad(lng - baseLng)

      const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      const distance = R * c

      const y = Math.sin(Δλ) * Math.cos(φ2)
      const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
      const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360

      let angleDiff = bearing - baseHeading
      if (angleDiff > 180) angleDiff -= 360
      if (angleDiff < -180) angleDiff += 360

      return { ...poi, distance, angleDiff }
    }).filter(poi => poi.distance <= 100)

    const spotsInFront = projected.filter(poi => Math.abs(poi.angleDiff) <= 20)
    if (spotsInFront.length > 0) {
      const sorted = [...spotsInFront].sort((a, b) => a.distance - b.distance)
      const spot = sorted[0]
      return {
        name: spot.name,
        distance: Math.max(1, Math.min(50, Math.round(spot.distance)))
      }
    } else {
      const closeSpots = projected.filter(poi => poi.distance <= 25)
      if (closeSpots.length > 0) {
        const sorted = [...closeSpots].sort((a, b) => a.distance - b.distance)
        const spot = sorted[0]
        return {
          name: spot.name,
          distance: Math.max(1, Math.min(50, Math.round(spot.distance)))
        }
      }
    }
    return null
  }, [pinnedLocation, positionLatitude, positionLongitude, heading, allPOIs])



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

  // ─── Fetch nearby annotations ───
  useEffect(() => {
    if (positionLatitude == null || positionLongitude == null) return

    const controller = new AbortController()

    async function fetchAnnotations() {
      try {
        const res = await apiFetch(
          `/api/v1/ar/annotations?lat=${positionLatitude}&lng=${positionLongitude}&radiusM=${maxRange}`,
          { signal: controller.signal }
        )
        if (res.ok) {
          setNearbyAnnotations(await res.json())
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Failed to fetch annotations:', err)
        }
      }
    }

    const timer = setTimeout(fetchAnnotations, 2000)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [positionLatitude, positionLongitude, maxRange, apiFetch])

  // ─── Select a POI (open info sheet) ───
  const handleSelectPOI = useCallback(async (poi) => {
    // Haptic feedback
    navigator.vibrate?.(10)

    // Dismiss onboarding
    if (showOnboarding) {
      setOnboardingExit(true)
      setTimeout(() => {
        setShowOnboarding(false)
        setOnboardingExit(false)
        localStorage.setItem('ar_onboarding_seen', '1')
      }, 300)
    }

    setSelectedPOI(poi)
    setShowInfoSheet(true)
    setExplanation(null)
    setExplanationError(null)
    setAlternatives([])

    // If it's an annotation, don't fetch spot explanation
    if (poi.isAnnotation) return

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
  }, [apiFetch, position, maxRange, itineraryId, showOnboarding])

  const handleCloseSheet = useCallback(() => {
    setShowInfoSheet(false)
    setTimeout(() => {
      setSelectedPOI(null)
      setExplanation(null)
      setExplanationError(null)
      setAlternatives([])
    }, 350)
  }, [])

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await apiFetch('/api/v1/upload', { method: 'POST', body: formData })
      if (res.ok) {
        const data = await res.json()
        setAnnotationForm(prev => ({ ...prev, photoUrl: data.url }))
        toast.success('Photo uploaded successfully!')
      } else {
        toast.error('Failed to upload photo.')
      }
    } catch {
      toast.error('Error uploading photo.')
    } finally {
      setUploadingPhoto(false)
    }
  }

  // ─── Submit annotation ───
  const handleSubmitAnnotation = useCallback(async () => {
    const activeLoc = pinnedLocation || {
      latitude: position?.latitude,
      longitude: position?.longitude,
      heading: heading || 0
    }
    if (!activeLoc.latitude || !activeLoc.longitude) {
      toast.error('GPS position not available yet.')
      return
    }
    if (!annotationForm.title.trim() || !annotationForm.description.trim()) {
      toast.error('Please fill in both the title and explanation.')
      return
    }
    setAnnotationSubmitting(true)
    try {
      const currentHeading = activeLoc.heading
      const targetDistance = annotationDistance // Use the custom or auto-calculated distance
      const R_lat = 111320
      const R_lng = (40075000 * Math.cos((activeLoc.latitude * Math.PI) / 180)) / 360

      const headingRad = (currentHeading * Math.PI) / 180
      const dLat = (targetDistance * Math.cos(headingRad)) / R_lat
      const dLng = (targetDistance * Math.sin(headingRad)) / R_lng

      const targetLat = activeLoc.latitude + dLat
      const targetLng = activeLoc.longitude + dLng

      console.log('Submitting annotation at pinned location:', {
        userLat: activeLoc.latitude,
        userLng: activeLoc.longitude,
        heading: currentHeading,
        targetDistance,
        targetLat,
        targetLng
      });

      const res = await apiFetch('/api/v1/ar/annotations', {
        method: 'POST',
        body: JSON.stringify({
          latitude: targetLat,
          longitude: targetLng,
          bearing: Math.round(currentHeading),
          title: annotationForm.title.trim(),
          description: annotationForm.description.trim(),
          photoUrl: capturedPhotoUrl || null,
          radiusMeters: targetDistance
        })
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setShowAnnotationModal(false)
        setAnnotationForm({ title: '', description: '' })
        setCapturedPhotoUrl('')
        setCapturedPhotoPreview('')
        setPinnedLocation(null)
        toast.success(`✓ Explanation submitted! Pinned ${targetDistance}m in front of you. Pending admin approval.`)
      } else {
        toast.error(data.error || 'Failed to submit explanation.')
      }
    } catch (err) {
      console.error('Failed to submit annotation:', err)
      toast.error('Network error submitting explanation.')
    } finally {
      setAnnotationSubmitting(false)
    }
  }, [annotationForm, pinnedLocation, position, heading, apiFetch, toast, annotationDistance, capturedPhotoUrl])

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

    // Background circle (since the CSS provides backdrop filter, let's keep it clean and semi-transparent white)
    ctx.beginPath()
    ctx.arc(center, center, radius, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(18, 24, 38, 0.08)'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Distance rings
    const rings = [0.33, 0.66, 1.0]
    rings.forEach(r => {
      ctx.beginPath()
      ctx.arc(center, center, radius * r, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(18, 24, 38, 0.05)'
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
    ctx.fillStyle = 'rgba(18, 24, 38, 0.06)'
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
      ctx.arc(dotX, dotY, poi.isItineraryStop ? 4 : poi.isAnnotation ? 3 : 2.5, 0, Math.PI * 2)
      ctx.fillStyle = poi.isItineraryStop ? '#121826' : poi.isAnnotation ? '#d97706' : '#6b7280'
      ctx.fill()
    })

    // User dot (center)
    ctx.beginPath()
    ctx.arc(center, center, 4, 0, Math.PI * 2)
    ctx.fillStyle = '#121826'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(center, center, 7, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(18, 24, 38, 0.2)'
    ctx.lineWidth = 2
    ctx.stroke()

  }, [position, heading, allPOIs, maxRange])

  // ─── Ground path dots for navigation ───
  const groundDots = useMemo(() => {
    if (!showNavigation || !arNav.nextStop || !arNav.enabled || arNav.isOnScreen === false) return []
    const dots = []
    const count = 6
    for (let i = 0; i < count; i++) {
      const t = (i + 1) / (count + 1)
      // Project dots from bottom-center toward the next stop's screen angle
      const angle = (arNav.angleDiffToNext * Math.PI / 180)
      const startX = screenDimensions.width / 2
      const startY = screenDimensions.height - 60
      const endX = startX + Math.sin(angle) * screenDimensions.width * 0.3
      const endY = startY - t * screenDimensions.height * 0.35
      dots.push({
        x: startX + (endX - startX) * t,
        y: startY + (endY - startY) * t,
        delay: i * 0.25
      })
    }
    return dots
  }, [showNavigation, arNav, screenDimensions])

  // ─── Render: Desktop fallback ───
  if (!isSupported) {
    const fallbackTitle = requiresSecureContext ? 'Secure Connection Required' : 'AR Explorer'
    const fallbackDescription = requiresSecureContext
      ? 'Your phone browser blocks camera, GPS, and motion sensors on plain HTTP. Open the app through HTTPS, or use a secure tunnel to this dev server.'
      : 'Open this page on your phone to explore spots in augmented reality.'

    return (
      <div className="ar-page ar-page--fallback">
        <div className="ar-fallback">
          <div className="ar-fallback-card">
            <div className="ar-fallback-icon-wrap">
              <div className="ar-fallback-icon">{requiresSecureContext ? '🔒' : '🔮'}</div>
              <div className="ar-fallback-icon-ring" />
            </div>
            <h2>{fallbackTitle}</h2>
            <p>{fallbackDescription}</p>
            {sensorError && <div className="ar-error-msg ar-error-msg--block">{sensorError}</div>}

            {!requiresSecureContext && (
              <div className="ar-fallback-features">
                <div className="ar-fallback-feature">
                  <span className="ar-fallback-feature-icon">📍</span>
                  <span>See nearby spots in real-time</span>
                </div>
                <div className="ar-fallback-feature">
                  <span className="ar-fallback-feature-icon">💡</span>
                  <span>Get smart local insights</span>
                </div>
                <div className="ar-fallback-feature">
                  <span className="ar-fallback-feature-icon">🧭</span>
                  <span>Navigate your itinerary in AR</span>
                </div>
              </div>
            )}

            {requiresSecureContext && (
              <div className="ar-fallback-help">
                <div>For local phone testing, use an HTTPS tunnel URL such as ngrok or Cloudflare Tunnel.</div>
              </div>
            )}
            <div className="ar-fallback-url-section">
              <div className="ar-fallback-url-label">Scan or copy this URL on your phone</div>
              <div className="ar-fallback-url">{window.location.href}</div>
            </div>
            <button
              className="ar-fallback-copy-btn"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href)
                  .then(() => toast.success('Link copied!'))
                  .catch(() => {})
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
      <div className="ar-page ar-page--permission">
        <div className="ar-permission-gate">
          <div className="ar-permission-icon-wrap">
            <div className="ar-permission-icon">🔮</div>
            <div className="ar-permission-icon-pulse" />
          </div>
          <div className="ar-permission-title">AR Explorer</div>
          <div className="ar-permission-desc">
            Point your camera to discover spots, get local insights,
            and navigate your itinerary in augmented reality.
          </div>
          <div className="ar-permission-features">
            <div className="ar-permission-feature">
              <span className="ar-permission-feature-num">1</span>
              <span>Camera sees the real world</span>
            </div>
            <div className="ar-permission-feature">
              <span className="ar-permission-feature-num">2</span>
              <span>GPS locates spots around you</span>
            </div>
            <div className="ar-permission-feature">
              <span className="ar-permission-feature-num">3</span>
              <span>Compass tracks your direction</span>
            </div>
          </div>
          <button className="ar-permission-btn" onClick={requestPermission}>
            <span className="ar-permission-btn-shimmer" />
            ✨ Enable AR Experience
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

        {/* Onboarding overlay — 3-step tutorial */}
        {showOnboarding && (
          <div
            className={`ar-onboarding ${onboardingExit ? 'ar-onboarding--exit' : ''}`}
            onClick={() => {
              setOnboardingExit(true)
              setTimeout(() => {
                setShowOnboarding(false)
                setOnboardingExit(false)
                localStorage.setItem('ar_onboarding_seen', '1')
              }, 300)
            }}
          >
            <div className="ar-onboarding-steps">
              <div className="ar-onboarding-step" style={{ animationDelay: '0s' }}>
                <div className="ar-onboarding-step-icon">📷</div>
                <div className="ar-onboarding-step-text">Point your phone to see spots</div>
              </div>
              <div className="ar-onboarding-step" style={{ animationDelay: '0.15s' }}>
                <div className="ar-onboarding-step-icon">👆</div>
                <div className="ar-onboarding-step-text">Tap a marker for details</div>
              </div>
              <div className="ar-onboarding-step" style={{ animationDelay: '0.3s' }}>
                <div className="ar-onboarding-step-icon">📖</div>
                <div className="ar-onboarding-step-text">Add your own insights</div>
              </div>
            </div>
            <div className="ar-onboarding-hint">Tap anywhere to start</div>
          </div>
        )}

        {/* Top Bar */}
        <div className="ar-top-bar">
          <button className="ar-back-btn" onClick={handleExitAR}>
            ← Back
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Itinerary progress indicator */}
            {itineraryId && itineraryStops.length > 0 && showNavigation && (
              <div className="ar-progress-indicator">
                <div className="ar-progress-dots">
                  {itineraryStops.map((_, idx) => (
                    <div
                      key={`progress-${idx}`}
                      className={`ar-progress-dot ${idx < arNav.currentStopIndex ? 'ar-progress-dot--done' : idx === arNav.currentStopIndex ? 'ar-progress-dot--active' : ''}`}
                    />
                  ))}
                </div>
                <span className="ar-progress-label">
                  {arNav.currentStopIndex + 1} / {itineraryStops.length}
                </span>
              </div>
            )}
            <div className="ar-compass">
              <CompassNeedle rotation={heading} />
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
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              <span>100m</span>
              <span>1km</span>
            </div>

            {position && (
              <div style={{ marginTop: '12px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                GPS: {position.latitude.toFixed(5)}, {position.longitude.toFixed(5)}
                <br />Accuracy: ±{Math.round(position.accuracy)}m
              </div>
            )}

            {/* Navigation toggle — only show in itinerary mode */}
            {itineraryId && (
              <div className="ar-settings-toggle">
                <span className="ar-settings-toggle-label">🧭 Navigation arrows</span>
                <button
                  className={`ar-toggle-switch ${showNavigation ? 'ar-toggle-switch--on' : ''}`}
                  onClick={() => setShowNavigation(prev => !prev)}
                />
              </div>
            )}
          </div>
        )}

        {/* ─── Navigation Arrow (Area 3) ─── */}
        {showNavigation && arNav.nextStop && arNav.distanceToNext != null && !arNav.isArrived && (
          <>
            {/* Direction arrow — fades when next stop is in view */}
            <div
              className={`ar-nav-arrow ${arNav.isOnScreen ? 'ar-nav-arrow--hidden' : ''}`}
              style={{ transform: `translate(-50%, -50%) rotate(${arNav.angleDiffToNext}deg)` }}
            >
              <NavArrowSVG color={arNav.arrowColor} />
            </div>

            {/* Ground path dots */}
            <div className="ar-nav-ground">
              {groundDots.map((dot, i) => (
                <div
                  key={`ground-${i}`}
                  className="ar-nav-ground-dot"
                  style={{
                    left: `${dot.x}px`,
                    top: `${dot.y}px`,
                    color: arNav.arrowColor,
                    backgroundColor: arNav.arrowColor,
                    animationDelay: `${dot.delay}s`
                  }}
                />
              ))}
            </div>

            {/* Off-screen indicator */}
            {arNav.offScreenEdge && (
              <div className={`ar-nav-offscreen ar-nav-offscreen--${arNav.offScreenEdge}`}>
                {arNav.offScreenEdge === 'left' && '← '}
                {arNav.offScreenEdge === 'right' && '→ '}
                {arNav.offScreenEdge === 'bottom' && '↩ '}
                {formatDistance(arNav.distanceToNext)}
                {arNav.offScreenEdge === 'bottom' && ' — Turn around'}
              </div>
            )}
          </>
        )}

        {/* Arrival celebration */}
        {arNav.justArrived && (
          <div className="ar-nav-arrived">
            <div className="ar-nav-arrived-icon">🎉</div>
            <div className="ar-nav-arrived-text">
              Arrived at Stop #{arNav.currentStopIndex + 1}!
            </div>
            <div className="ar-nav-arrived-sub">
              {arNav.nextStop?.name || ''}
            </div>
          </div>
        )}

        {/* Empty state when no POIs visible */}
        {projectedPOIs.filter(poi => poi.isVisible).length === 0 && allPOIs.length > 0 && !showInfoSheet && !showAnnotationModal && !showOnboarding && (
          <div className="ar-empty-state">
            <div className="ar-empty-state-icon">🔭</div>
            <div className="ar-empty-state-text">No spots in this direction</div>
            <div className="ar-empty-state-hint">Try looking around</div>
          </div>
        )}

        {/* POI Markers */}
        <div className="ar-markers-container">
          {projectedPOIs
            .filter(poi => poi.isVisible)
            .map((poi) => {
            const isFar = poi.distance > 300
            const markerClass = poi.isAnnotation
              ? 'ar-marker--annotation'
              : poi.isItineraryStop
                ? 'ar-marker--current'
                : 'ar-marker--nearby'

            // Check if this stop has a photo
            const spotPhoto = poi.isItineraryStop && poi.photos?.length > 0 ? poi.photos[0] : null

            return (
              <div
                key={`ar-marker-${poi.id}`}
                className={`ar-marker ${markerClass} ${isFar ? 'ar-marker--far' : ''}`}
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
                    {spotPhoto && !isFar ? (
                      <img
                        src={spotPhoto}
                        alt={poi.name}
                        className="ar-marker-photo"
                      />
                    ) : poi.isAnnotation ? (
                      <div className="ar-marker-icon" style={{ filter: 'none' }}>📖</div>
                    ) : (
                      <img
                        src={getIconUrl(poi.type)}
                        alt={poi.type || 'Spot'}
                        className="ar-marker-icon"
                      />
                    )}
                    <div className="ar-marker-info">
                      <div className="ar-marker-name">{poi.name}</div>
                      <div className="ar-marker-distance">
                        {formatDistance(poi.distance)}
                        {poi.averageRating > 0 && <span className="ar-marker-rating"> · ⭐{poi.averageRating?.toFixed?.(1)}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="ar-marker-stem" />
                </div>
              </div>
            )
          })}
        </div>

        {/* Navigation Bar */}
        {showNavigation && arNav.nextStop && arNav.distanceToNext != null && !arNav.isArrived && (
          <div className="ar-nav-bar">
            <div className="ar-nav-bar-icon">🧭</div>
            <div className="ar-nav-bar-info">
              <div className="ar-nav-bar-name">
                Stop #{arNav.nextStopIndex + 1} — {arNav.nextStop.name || 'Next stop'}
              </div>
              <div className="ar-nav-bar-hint">{arNav.directionHint}</div>
            </div>
            <div className="ar-nav-bar-distance" style={{ color: arNav.arrowColor }}>
              {formatDistance(arNav.distanceToNext)}
            </div>
          </div>
        )}

        {/* Explain FAB */}
        <button
          className="ar-explain-fab"
          onClick={async () => {
            if (!position) {
              toast.error('GPS position not available yet.')
              return
            }

            // Lock in current coordinates & heading immediately so user can relax
            isAnnotationCancelledRef.current = false
            const frozenHeading = heading || 0
            setPinnedLocation({
              latitude: position.latitude,
              longitude: position.longitude,
              heading: frozenHeading
            })
            setAnnotationDistance(3)
            setCapturedPhotoUrl('')
            setCapturedPhotoPreview('')
            setUploadingPhoto(true)

            // Instantly snap current camera view
            if (videoRef.current) {
              try {
                const canvas = document.createElement('canvas')
                canvas.width = videoRef.current.videoWidth || 640
                canvas.height = videoRef.current.videoHeight || 480
                const ctx = canvas.getContext('2d')
                ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
                
                canvas.toBlob(async (blob) => {
                  if (!blob) {
                    setUploadingPhoto(false)
                    return
                  }
                  
                  const localPreview = URL.createObjectURL(blob)
                  if (isAnnotationCancelledRef.current) {
                    URL.revokeObjectURL(localPreview)
                    return
                  }
                  setCapturedPhotoPreview(localPreview)

                  try {
                    const file = new File([blob], `ar_snap_${Date.now()}.jpg`, { type: 'image/jpeg' })
                    const formData = new FormData()
                    formData.append('file', file)
                    const res = await apiFetch('/api/v1/upload', { method: 'POST', body: formData })
                    if (res.ok) {
                      const data = await res.json()
                      if (isAnnotationCancelledRef.current) {
                        apiFetch(`/api/v1/upload?url=${encodeURIComponent(data.url)}`, {
                          method: 'DELETE'
                        }).catch(err => console.error('Error deleting orphaned photo:', err))
                      } else {
                        setCapturedPhotoUrl(data.url)
                      }
                    }
                  } catch (err) {
                    console.error('Error uploading snapshot:', err)
                  } finally {
                    setUploadingPhoto(false)
                  }
                }, 'image/jpeg', 0.85)
              } catch (e) {
                console.error('Snapshot capture failed:', e)
                setUploadingPhoto(false)
              }
            } else {
              setUploadingPhoto(false)
            }

            setShowAnnotationModal(true)
          }}
        >
          <span className="ar-explain-fab-icon">+</span>
          {nearbyAnnotations.length > 0 && (
            <span className="ar-explain-fab-badge">{nearbyAnnotations.length}</span>
          )}
        </button>

        {/* Radar Minimap */}
        <div className="ar-radar">
          <canvas ref={radarRef} className="ar-radar-canvas" />
        </div>

        {/* ─── Annotation Submission Modal ─── */}
        <div className={`ar-annotation-modal ${showAnnotationModal ? 'ar-annotation-modal--open' : ''}`}>
          <div className="ar-annotation-modal-content">
            <div className="ar-info-drag-handle" />
            <div className="ar-annotation-modal-title">
              📖 Submit an Explanation
            </div>

            {pinnedLocation && (
              <div className="ar-annotation-gps-info">
                📍 Locked Location: {pinnedLocation.latitude.toFixed(5)}, {pinnedLocation.longitude.toFixed(5)} · Facing {Math.round(pinnedLocation.heading)}° {getCompassLabel(pinnedLocation.heading)}
              </div>
            )}

            {capturedPhotoPreview && (
              <div className="ar-annotation-field" style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px' }}>Captured Reference Photo</label>
                <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                  <img
                    src={capturedPhotoPreview}
                    alt="Captured View"
                    style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', borderRadius: '10px', border: '1px solid var(--border)' }}
                  />
                  {uploadingPhoto && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'rgba(0,0,0,0.6)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '10px',
                      fontSize: '0.8rem',
                      color: '#fff',
                      fontWeight: 600
                    }}>
                      Uploading camera snapshot...
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="ar-annotation-field" style={{ marginBottom: '16px' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <span>Distance to Object:</span>
                <strong style={{ color: 'var(--warning)' }}>{annotationDistance} meters</strong>
              </label>
              <input
                type="range"
                min="1"
                max="50"
                step="1"
                value={annotationDistance}
                onChange={(e) => setAnnotationDistance(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--text-primary)', marginTop: '8px' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', opacity: 0.5, marginTop: '2px' }}>
                <span>1m (Right in front)</span>
                <span>50m (Far away)</span>
              </div>

              <div className="ar-annotation-presets">
                <button
                  type="button"
                  className={`ar-preset-btn ${annotationDistance === 3 ? 'active' : ''}`}
                  onClick={() => setAnnotationDistance(3)}
                >
                  Wall (3m)
                </button>
                <button
                  type="button"
                  className={`ar-preset-btn ${annotationDistance === 5 ? 'active' : ''}`}
                  onClick={() => setAnnotationDistance(5)}
                >
                  Close (5m)
                </button>
                <button
                  type="button"
                  className={`ar-preset-btn ${annotationDistance === 15 ? 'active' : ''}`}
                  onClick={() => setAnnotationDistance(15)}
                >
                  Medium (15m)
                </button>
                <button
                  type="button"
                  className={`ar-preset-btn ${annotationDistance === 30 ? 'active' : ''}`}
                  onClick={() => setAnnotationDistance(30)}
                >
                  Far (30m)
                </button>
                {closestSpotPreset && (
                  <button
                    type="button"
                    className={`ar-preset-btn ${annotationDistance === closestSpotPreset.distance ? 'active' : ''}`}
                    onClick={() => setAnnotationDistance(closestSpotPreset.distance)}
                  >
                    📍 Snap to {closestSpotPreset.name.length > 18 ? closestSpotPreset.name.substring(0, 16) + '..' : closestSpotPreset.name} ({closestSpotPreset.distance}m)
                  </button>
                )}
              </div>
            </div>

            <div className="ar-annotation-field">
              <label>What is it?</label>
              <input
                type="text"
                placeholder="e.g. Temple mural on the east wall"
                value={annotationForm.title}
                onChange={(e) => setAnnotationForm(prev => ({ ...prev, title: e.target.value }))}
                maxLength={150}
              />
            </div>

            <div className="ar-annotation-field">
              <label>Explanation</label>
              <textarea
                placeholder="Describe what this is and why it's interesting..."
                value={annotationForm.description}
                onChange={(e) => setAnnotationForm(prev => ({ ...prev, description: e.target.value }))}
                maxLength={2000}
              />
            </div>

            <div className="ar-annotation-actions">
              <button
                className="ar-annotation-cancel-btn"
                onClick={handleCancelAnnotation}
              >
                Cancel
              </button>
              <button
                className="ar-annotation-submit-btn"
                disabled={!annotationForm.title.trim() || !annotationForm.description.trim() || !pinnedLocation || annotationSubmitting || uploadingPhoto}
                onClick={handleSubmitAnnotation}
              >
                {uploadingPhoto ? 'Uploading snapshot...' : annotationSubmitting ? 'Submitting...' : 'Submit for Review'}
              </button>
            </div>
          </div>
        </div>

        {/* Info Sheet */}
        <div className={`ar-info-sheet ${showInfoSheet ? 'ar-info-sheet--open' : ''}`}>
          <div className="ar-info-sheet-content">
            <div className="ar-info-drag-handle" />

            {selectedPOI && (
              <>
                {/* Photo strip */}
                {!selectedPOI.isAnnotation && selectedPOI.photos?.length > 0 && (
                  <div className="ar-info-photos">
                    {selectedPOI.photos.slice(0, 5).map((url, idx) => (
                      <img
                        key={`info-photo-${idx}`}
                        src={url}
                        alt={`${selectedPOI.name} photo ${idx + 1}`}
                        className="ar-info-photo"
                      />
                    ))}
                  </div>
                )}

                <div className="ar-info-header">
                  <div>
                    <div className="ar-info-spot-name">
                      {selectedPOI.isItineraryStop && (
                        <span style={{ color: 'var(--text-primary)', marginRight: '6px' }}>
                          #{selectedPOI.stopNumber}
                        </span>
                      )}
                      {selectedPOI.name}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {!selectedPOI.isAnnotation && (
                      <span className="ar-info-spot-type">
                        <img src={getIconUrl(selectedPOI.type)} alt="" style={{ width: '14px', height: '14px', opacity: 0.7 }} />
                        {selectedPOI.type}
                      </span>
                    )}
                    {selectedPOI.isAnnotation && (
                      <span className="ar-info-spot-type" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
                        📖 Annotation
                      </span>
                    )}
                    <button className="ar-info-close-btn" onClick={handleCloseSheet}>✕</button>
                  </div>
                </div>

                <div className="ar-info-meta">
                  <span>📍 {formatDistance(selectedPOI.distance)}</span>
                  {!selectedPOI.isAnnotation && selectedPOI.averageRating > 0 && (
                    <span>
                      ⭐ <span className="ar-info-rating">{selectedPOI.averageRating?.toFixed?.(1) || selectedPOI.averageRating}</span>
                    </span>
                  )}
                  {!selectedPOI.isAnnotation && selectedPOI.address && (
                    <span style={{ fontSize: '0.75rem', opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                      {selectedPOI.address}
                    </span>
                  )}
                </div>

                {/* ─── Annotation detail ─── */}
                {selectedPOI.isAnnotation && selectedPOI.annotationData && (
                  <div className="ar-annotation-detail">
                    <div className="ar-annotation-detail-author">
                      👤 {selectedPOI.annotationData.authorName}
                      {selectedPOI.annotationData.authorIsExpert && (
                        <span className="badge-expert">Expert</span>
                      )}
                    </div>
                    <div className="ar-annotation-detail-text">
                      {selectedPOI.annotationData.description}
                    </div>
                    {selectedPOI.annotationData.photoUrl && (
                      <img
                        src={selectedPOI.annotationData.photoUrl}
                        alt={selectedPOI.annotationData.title}
                        className="ar-annotation-detail-photo"
                      />
                    )}
                  </div>
                )}

                {/* ─── Spot Explanation ─── */}
                {!selectedPOI.isAnnotation && (
                  <>
                    {explanation ? (
                      <div className="ar-explanation ar-explanation--animated">
                        <div className="ar-explanation-heading">
                          <div className="ar-explanation-label">About this spot</div>
                          <div className={`ar-explanation-source ${explanation.aiEnhanced ? 'ar-explanation-source--ai' : ''}`}>
                            {explanation.aiEnhanced ? 'AI enhanced' : 'Local guide'}
                          </div>
                        </div>
                        <div className="ar-explanation-text">
                          {explanation.whatIsThis && (
                            <div className="ar-explanation-desc ar-stagger-1">
                              {explanation.whatIsThis}
                            </div>
                          )}

                          {explanation.highlights?.length > 0 && (
                            <div className="ar-explanation-highlights ar-stagger-2">
                              {explanation.highlights.slice(0, 5).map((highlight, idx) => (
                                <div key={`ar-highlight-${idx}`} className="ar-explanation-highlight" style={{ animationDelay: `${0.1 + idx * 0.06}s` }}>
                                  {highlight}
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {explanation.whoIsThisFor && (
                            <div className="ar-explanation-audience ar-stagger-3">
                              <span>👥</span> <span>{explanation.whoIsThisFor}</span>
                            </div>
                          )}

                          {explanation.quickFact && (
                            <div className="ar-explanation-fact ar-stagger-4">
                              💡 {explanation.quickFact}
                            </div>
                          )}
                          {explanation.visitTip && (
                            <div className="ar-explanation-tip ar-stagger-5">
                              <span className="ar-explanation-kicker">AR tip</span>
                              <span>{explanation.visitTip}</span>
                            </div>
                          )}
                        </div>

                        {explanation.shouldYouSwitch && (
                          <div className="ar-explanation-switch ar-stagger-5">
                            <div className="ar-explanation-switch-title">
                              <span>🔄</span> Should you switch?
                            </div>
                            <div className="ar-explanation-switch-content">
                              {explanation.shouldYouSwitch}
                            </div>
                          </div>
                        )}

                        {explanation.friendSays && (
                          <div className="ar-explanation-friend ar-stagger-6">
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
                      <div className="ar-skeleton">
                        <div className="ar-skeleton-line ar-skeleton-line--title" />
                        <div className="ar-skeleton-line ar-skeleton-line--long" />
                        <div className="ar-skeleton-line ar-skeleton-line--medium" />
                        <div className="ar-skeleton-line ar-skeleton-line--short" />
                        <div className="ar-skeleton-line ar-skeleton-line--medium" />
                      </div>
                    )}
                  </>
                )}

                {/* Actions */}
                {!selectedPOI.isAnnotation && (
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
                )}

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
                            isAnnotation: false,
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
