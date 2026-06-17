import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { calculateBearing, haversineMeters } from './useARProjection'

/**
 * Hook for itinerary navigation in AR — tracks user progress through stops,
 * calculates bearing/distance to next stop, and provides direction hints.
 *
 * @param {Object} params
 * @param {Array} params.itineraryStops - Ordered itinerary stops [{spot: {latitude, longitude, name, ...}, ...}]
 * @param {Object|null} params.position - User GPS {latitude, longitude}
 * @param {number} params.heading - Compass heading 0-360°
 * @param {boolean} params.enabled - Whether navigation is active
 * @param {number} [params.arrivalRadius=25] - Meters within which user is considered "arrived"
 * @param {number} [params.cameraFOV=60] - Camera field of view in degrees
 */
export function useARNavigation({
  itineraryStops = [],
  position,
  heading = 0,
  enabled = true,
  arrivalRadius = 25,
  cameraFOV = 60
}) {
  const [currentStopIndex, setCurrentStopIndex] = useState(0)
  const [justArrived, setJustArrived] = useState(false)
  const arrivalTimerRef = useRef(null)
  const prevArrivedRef = useRef(false)

  // The next stop to navigate toward
  const nextStopIndex = currentStopIndex
  const nextStop = useMemo(() => {
    if (!itineraryStops.length || nextStopIndex >= itineraryStops.length) return null
    const stop = itineraryStops[nextStopIndex]
    return stop?.spot || stop
  }, [itineraryStops, nextStopIndex])

  // Calculate bearing and distance to next stop
  const navigation = useMemo(() => {
    if (!enabled || !position || !nextStop) {
      return {
        bearingToNext: 0,
        distanceToNext: null,
        angleDiffToNext: 0,
        isOnScreen: false,
        directionHint: '',
        isArrived: false
      }
    }

    const lat = nextStop.latitude ?? nextStop.lat
    const lng = nextStop.longitude ?? nextStop.lng
    if (lat == null || lng == null) {
      return {
        bearingToNext: 0,
        distanceToNext: null,
        angleDiffToNext: 0,
        isOnScreen: false,
        directionHint: '',
        isArrived: false
      }
    }

    const bearing = calculateBearing(position.latitude, position.longitude, lat, lng)
    const distance = Math.round(haversineMeters(position.latitude, position.longitude, lat, lng))

    let angleDiff = bearing - heading
    if (angleDiff > 180) angleDiff -= 360
    if (angleDiff < -180) angleDiff += 360

    const halfFOV = cameraFOV / 2
    const isOnScreen = Math.abs(angleDiff) <= halfFOV + 5

    // Direction hint
    const absAngle = Math.abs(angleDiff)
    let directionHint
    if (absAngle <= 15) {
      directionHint = 'Straight ahead'
    } else if (absAngle <= 90) {
      directionHint = angleDiff > 0 ? 'Turn right' : 'Turn left'
    } else if (absAngle <= 150) {
      directionHint = angleDiff > 0 ? 'Sharp right' : 'Sharp left'
    } else {
      directionHint = 'Behind you'
    }

    const isArrived = distance <= arrivalRadius

    return {
      bearingToNext: Math.round(bearing),
      distanceToNext: distance,
      angleDiffToNext: angleDiff,
      isOnScreen,
      directionHint,
      isArrived
    }
  }, [enabled, position, nextStop, heading, cameraFOV, arrivalRadius])

  // Auto-advance when arrived (with debounce to avoid flicker)
  useEffect(() => {
    if (!enabled) return

    if (navigation.isArrived && !prevArrivedRef.current) {
      // Just arrived — show celebration, then advance after 2s
      setJustArrived(true)
      arrivalTimerRef.current = setTimeout(() => {
        setCurrentStopIndex(prev => {
          const next = prev + 1
          return next < itineraryStops.length ? next : prev
        })
        setJustArrived(false)
      }, 2500)
    }

    prevArrivedRef.current = navigation.isArrived

    return () => {
      if (arrivalTimerRef.current) {
        clearTimeout(arrivalTimerRef.current)
      }
    }
  }, [navigation.isArrived, enabled, itineraryStops.length])

  // Manually advance to next stop
  const advanceToNext = useCallback(() => {
    setJustArrived(false)
    setCurrentStopIndex(prev => {
      const next = prev + 1
      return next < itineraryStops.length ? next : prev
    })
  }, [itineraryStops.length])

  // Whether there are more stops after the current one
  const hasMoreStops = currentStopIndex < itineraryStops.length - 1

  // Color interpolation: brand colors based on distance
  const arrowColor = useMemo(() => {
    if (navigation.distanceToNext == null) return '#121826'
    if (navigation.distanceToNext <= 50) return '#16a34a' // var(--success)
    if (navigation.distanceToNext <= 150) return '#d97706' // var(--warning)
    return '#121826' // var(--text-primary)
  }, [navigation.distanceToNext])

  // Off-screen edge position (which screen edge should show the indicator)
  const offScreenEdge = useMemo(() => {
    if (!enabled || navigation.isOnScreen || !nextStop) return null
    const angle = navigation.angleDiffToNext
    if (Math.abs(angle) > 120) return 'bottom'
    return angle > 0 ? 'right' : 'left'
  }, [enabled, navigation.isOnScreen, navigation.angleDiffToNext, nextStop])

  return {
    nextStop,
    nextStopIndex,
    currentStopIndex,
    ...navigation,
    justArrived,
    advanceToNext,
    hasMoreStops,
    arrowColor,
    offScreenEdge
  }
}
