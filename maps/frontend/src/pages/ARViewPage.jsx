import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useDeviceSensors } from '../hooks/useDeviceSensors'
import { useARProjection } from '../hooks/useARProjection'
import { useARNavigation } from '../hooks/useARNavigation'
import { useToast } from '../components/ToastProvider'
import './ARViewPage.css'

// Modularized Sub-Components
import RadarMinimap from '../components/RadarMinimap'
import AROnboarding from '../components/AROnboarding'
import ARSettingsPanel from '../components/ARSettingsPanel'
import ARAnnotationModal from '../components/ARAnnotationModal'
import ARInfoSheet from '../components/ARInfoSheet'

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
  const [nearbyFriendPosts, setNearbyFriendPosts] = useState([])
  const [subscription, setSubscription] = useState({ tier: 'NONE' })
  const [followedExperts, setFollowedExperts] = useState([])
  const [selectedExpertId, setSelectedExpertId] = useState(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  const isAnnotationCancelledRef = useRef(false)
  const activePhotoUrlRef = useRef(null)

  const videoRef = useRef(null)
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
      isFriendPost: false,
      stopNumber: idx + 1,
      notes: s.notes,
      startTime: s.startTime,
    })),
    ...nearbySpots.filter(ns =>
      !excludeIds.includes(ns.id)
    ).map(s => ({ ...s, isItineraryStop: false, isAnnotation: false, isFriendPost: false })),
    ...nearbyAnnotations.map(ann => ({
      id: `ann-${ann.id}`,
      annotationId: ann.id,
      name: ann.title,
      latitude: ann.latitude,
      longitude: ann.longitude,
      type: 'annotation',
      isItineraryStop: false,
      isAnnotation: true,
      isFriendPost: false,
      annotationData: ann
    })),
    ...nearbyFriendPosts.map(post => ({
      id: `post-${post.id}`,
      postId: post.id,
      name: `${post.authorName}'s tip`,
      latitude: post.latitude,
      longitude: post.longitude,
      type: 'friendPost',
      isItineraryStop: false,
      isAnnotation: false,
      isFriendPost: true,
      postData: post
    }))
  ], [itineraryStops, nearbySpots, excludeIds, nearbyAnnotations, nearbyFriendPosts])

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

  // ─── Fetch followed experts and subscription info on mount ───
  useEffect(() => {
    async function initDiffFeatures() {
      try {
        const subRes = await apiFetch('/api/v1/stripe/my-subscription')
        if (subRes.ok) {
          setSubscription(await subRes.json())
        }

        const expRes = await apiFetch('/api/v1/follows/experts')
        if (expRes.ok) {
          setFollowedExperts(await expRes.json())
        }
      } catch (err) {
        console.error('Failed to initialize differentiation features:', err)
      }
    }
    initDiffFeatures()
  }, [apiFetch])

  // ─── Fetch nearby spots when position changes ───
  useEffect(() => {
    if (positionLatitude == null || positionLongitude == null) return

    const controller = new AbortController()
    const excludedSpotIds = excludeIds.join(',')

    async function fetchNearby() {
      try {
        const expertQueryParam = selectedExpertId ? `&expertId=${selectedExpertId}` : ''
        const res = await apiFetch(
          `/api/v1/ar/nearby?lat=${positionLatitude}&lng=${positionLongitude}&radiusM=${maxRange}&excludeIds=${excludedSpotIds}${expertQueryParam}`,
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

    const timer = setTimeout(fetchNearby, 1500)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [positionLatitude, positionLongitude, maxRange, excludeIds, selectedExpertId, apiFetch])

  // ─── Fetch nearby friend posts when position changes ───
  useEffect(() => {
    if (positionLatitude == null || positionLongitude == null) return

    const controller = new AbortController()

    async function fetchFriendPosts() {
      try {
        const res = await apiFetch(
          `/api/v1/ar/feed/nearby?lat=${positionLatitude}&lng=${positionLongitude}&radiusM=${maxRange}`,
          { signal: controller.signal }
        )
        if (res.ok) {
          setNearbyFriendPosts(await res.json())
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Failed to fetch friend posts:', err)
        }
      }
    }

    const timer = setTimeout(fetchFriendPosts, 2000)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [positionLatitude, positionLongitude, maxRange, apiFetch])

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

    // If it's an annotation or a friend post, don't fetch spot explanation
    if (poi.isAnnotation || poi.isFriendPost) return

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

  // ─── Submit annotation ───
  const handleSubmitAnnotation = useCallback(async () => {
    const activeLoc = pinnedLocation || {
      latitude: position?.latitude,
      longitude: position?.longitude,
      heading: heading || 0,
      pitch: tilt || 90
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

      const res = await apiFetch('/api/v1/ar/annotations', {
        method: 'POST',
        body: JSON.stringify({
          latitude: targetLat,
          longitude: targetLng,
          bearing: Math.round(currentHeading),
          pitch: Math.round(activeLoc.pitch || 90),
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

  // ─── Ground path dots for navigation ───
  const groundDots = useMemo(() => {
    if (!showNavigation || !arNav.nextStop || !arNav.enabled || arNav.isOnScreen === false) return []
    const dots = []
    const count = 6
    for (let i = 0; i < count; i++) {
      const t = (i + 1) / (count + 1)
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
        <AROnboarding
          showOnboarding={showOnboarding}
          onboardingExit={onboardingExit}
          onClick={() => {
            setOnboardingExit(true)
            setTimeout(() => {
              setShowOnboarding(false)
              setOnboardingExit(false)
              localStorage.setItem('ar_onboarding_seen', '1')
            }, 300)
          }}
        />

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
        <ARSettingsPanel
          showSettings={showSettings}
          maxRange={maxRange}
          setMaxRange={setMaxRange}
          position={position}
          itineraryId={itineraryId}
          showNavigation={showNavigation}
          setShowNavigation={setShowNavigation}
          subscription={subscription}
          followedExperts={followedExperts}
          selectedExpertId={selectedExpertId}
          setSelectedExpertId={setSelectedExpertId}
          setShowUpgradeModal={setShowUpgradeModal}
        />

        {/* ─── Navigation Arrow (Area 3) ─── */}
        {showNavigation && arNav.nextStop && arNav.distanceToNext != null && !arNav.isArrived && (
          <>
            {/* Direction arrow ─── */}
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
              : poi.isFriendPost
                ? 'ar-marker--friend-post'
                : poi.isItineraryStop
                  ? 'ar-marker--current'
                  : 'ar-marker--nearby'

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
                    ) : poi.isFriendPost ? (
                      poi.postData.authorProfilePicture ? (
                        <img
                          src={poi.postData.authorProfilePicture}
                          alt={poi.postData.authorName}
                          className="ar-marker-photo"
                          style={{ borderRadius: '50%' }}
                        />
                      ) : (
                        <div className="ar-marker-icon" style={{ filter: 'none' }}>💬</div>
                      )
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
                        {poi.isFriendPost && <span style={{ color: '#60a5fa' }}> · 💬 tip</span>}
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

            isAnnotationCancelledRef.current = false
            const frozenHeading = heading || 0
            const frozenTilt = tilt || 90
            setPinnedLocation({
              latitude: position.latitude,
              longitude: position.longitude,
              heading: frozenHeading,
              pitch: frozenTilt
            })
            setAnnotationDistance(3)
            setCapturedPhotoUrl('')
            setCapturedPhotoPreview('')
            setUploadingPhoto(true)

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
        <RadarMinimap
          position={position}
          heading={heading}
          allPOIs={allPOIs}
          maxRange={maxRange}
        />

        {/* Annotation Submission Modal */}
        <ARAnnotationModal
          showAnnotationModal={showAnnotationModal}
          pinnedLocation={pinnedLocation}
          capturedPhotoPreview={capturedPhotoPreview}
          uploadingPhoto={uploadingPhoto}
          annotationDistance={annotationDistance}
          setAnnotationDistance={setAnnotationDistance}
          annotationForm={annotationForm}
          setAnnotationForm={setAnnotationForm}
          closestSpotPreset={closestSpotPreset}
          annotationSubmitting={annotationSubmitting}
          handleCancelAnnotation={handleCancelAnnotation}
          handleSubmitAnnotation={handleSubmitAnnotation}
          getCompassLabel={getCompassLabel}
        />

        {/* Info Sheet */}
        <ARInfoSheet
          showInfoSheet={showInfoSheet}
          selectedPOI={selectedPOI}
          handleCloseSheet={handleCloseSheet}
          explanation={explanation}
          explanationError={explanationError}
          alternatives={alternatives}
          handleSelectPOI={handleSelectPOI}
          stopCamera={stopCamera}
          getIconUrl={getIconUrl}
          formatDistance={formatDistance}
        />

        {/* Upgrade Promotion Modal */}
        {showUpgradeModal && (
          <div className="ar-upgrade-modal-overlay">
            <div className="ar-upgrade-modal-content glass">
              <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>👑</div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', color: '#fff', fontWeight: 700 }}>Unlock Expert Spotlight Walks</h3>
              <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.5 }}>
                Filter your AR view to show only spots hand-picked and reviewed by VIP food writers and local guides you follow.
              </p>
              <div className="ar-upgrade-bullets" style={{ textAlign: 'left', margin: '16px 0', fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.9)' }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ color: '#a78bfa', fontWeight: 'bold' }}>✓</span> <span>Spotlight specific guides & critics in real-time</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ color: '#a78bfa', fontWeight: 'bold' }}>✓</span> <span>Spatial audio commentary paths</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span style={{ color: '#a78bfa', fontWeight: 'bold' }}>✓</span> <span>Unlock exclusive offline discount keys</span>
                </div>
              </div>
              <div className="ar-upgrade-actions" style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button className="ar-back-btn" onClick={() => setShowUpgradeModal(false)} style={{ flex: 1, justifyContent: 'center' }}>
                  Maybe Later
                </button>
                <button
                  className="ar-action-btn ar-action-btn--primary"
                  style={{ flex: 1, background: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)', border: 'none', color: '#fff', fontWeight: 700, borderRadius: '20px' }}
                  onClick={async () => {
                    try {
                      const res = await apiFetch('/api/v1/stripe/subscribe', {
                        method: 'POST',
                        body: JSON.stringify({
                          tier: 'PRO',
                          cancelUrl: window.location.href
                        })
                      })
                      if (res.ok) {
                        const data = await res.json()
                        if (data.checkoutUrl) {
                          stopCamera(true)
                          window.location.href = data.checkoutUrl
                        }
                      }
                    } catch (err) {
                      console.error('Failed to start subscription checkout:', err)
                    }
                  }}
                >
                  Upgrade to Pro
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
