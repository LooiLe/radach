import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Custom hook for accessing device sensors: GPS, compass, and tilt.
 * Handles permission requests (iOS), smoothing, and error states.
 */
export function useDeviceSensors() {
  const [position, setPosition] = useState(null) // { latitude, longitude, accuracy }
  const [heading, setHeading] = useState(0) // compass heading 0-360°
  const [tilt, setTilt] = useState(90) // device pitch (beta), 90 = upright
  const [hasPermission, setHasPermission] = useState(false)
  const [isSupported, setIsSupported] = useState(true)
  const [error, setError] = useState(null)
  const [requiresSecureContext, setRequiresSecureContext] = useState(false)

  const headingRef = useRef(0)
  const watchIdRef = useRef(null)
  const smoothingAlpha = 0.25 // low-pass filter coefficient

  // Check basic support on mount
  useEffect(() => {
    const hostname = window.location.hostname
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
    const isSecureOrigin = window.isSecureContext || isLocalhost

    if (!isSecureOrigin) {
      setRequiresSecureContext(true)
      setIsSupported(false)
      setError('AR needs HTTPS on phones. Camera, GPS, and motion sensors are blocked on plain HTTP network URLs.')
      return
    }

    const userAgent = navigator.userAgent || ''
    const isIOSIPadOnDesktopUA = /Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1
    const isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) || isIOSIPadOnDesktopUA

    if (!isMobileDevice) {
      setIsSupported(false)
      setError('This experience is available on mobile devices with camera, location, and compass support.')
      return
    }

    const hasCamera = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    const hasGeo = !!navigator.geolocation

    if (!hasCamera || !hasGeo) {
      setIsSupported(false)
      setError('Your device does not support the required sensors (camera + GPS).')
    }
  }, [])

  // Smooth heading using circular low-pass filter
  const smoothHeading = useCallback((raw) => {
    const prev = headingRef.current
    // Handle wraparound (e.g., 359° → 1°)
    let diff = raw - prev
    if (diff > 180) diff -= 360
    if (diff < -180) diff += 360
    const smoothed = ((prev + smoothingAlpha * diff) + 360) % 360
    headingRef.current = smoothed
    return smoothed
  }, [])

  // Start GPS tracking
  const startGPS = useCallback(() => {
    if (!navigator.geolocation) return

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        })
        setError(null)
      },
      (err) => {
        if (err.code === 1) {
          setError('Location access denied. Please enable location in your browser settings.')
        } else if (err.code === 2) {
          setError('Unable to determine your location. Please check GPS settings.')
        } else {
          setError('Location request timed out. Retrying...')
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 2000
      }
    )
  }, [])

  // Start compass/orientation tracking
  const startOrientation = useCallback(() => {
    const handler = (event) => {
      // alpha = compass heading (0-360)
      // beta = tilt front-to-back (0 = flat, 90 = upright)
      // gamma = tilt left-to-right
      let compassHeading = null

      // iOS provides webkitCompassHeading (true north)
      if (event.webkitCompassHeading != null) {
        compassHeading = event.webkitCompassHeading
      } else if (event.alpha != null) {
        // Android/Others: alpha is absolute if using deviceorientationabsolute
        // Convert to compass heading (approximate)
        compassHeading = (360 - event.alpha) % 360
      }

      if (compassHeading != null) {
        setHeading(smoothHeading(compassHeading))
      }

      if (event.beta != null) {
        setTilt(event.beta)
      }
    }

    const useAbsolute = 'ondeviceorientationabsolute' in window
    const eventName = useAbsolute ? 'deviceorientationabsolute' : 'deviceorientation'
    console.log(`[useDeviceSensors] Listening to ${eventName} (absolute: ${useAbsolute})`)

    window.addEventListener(eventName, handler, true)
    return () => window.removeEventListener(eventName, handler, true)
  }, [smoothHeading])

  // Request permissions (especially needed for iOS 13+)
  const requestPermission = useCallback(async () => {
    try {
      // iOS 13+ requires explicit permission for DeviceOrientation
      if (typeof DeviceOrientationEvent !== 'undefined' &&
          typeof DeviceOrientationEvent.requestPermission === 'function') {
        const orientationPermission = await DeviceOrientationEvent.requestPermission()
        if (orientationPermission !== 'granted') {
          setError('Orientation sensor permission denied. AR markers may not track correctly.')
        }
      }

      // Start sensors
      startGPS()
      const cleanupOrientation = startOrientation()
      setHasPermission(true)
      setError(null)

      return cleanupOrientation
    } catch (err) {
      console.error('Sensor permission error:', err)
      setError('Failed to access device sensors. Please try again.')
      return null
    }
  }, [startGPS, startOrientation])

  // Auto-start on non-iOS devices (no permission prompt needed)
  useEffect(() => {
    if (!isSupported) return

    // Check if iOS permission is needed
    const needsIOSPermission = typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function'

    if (!needsIOSPermission) {
      // Android browsers can start after the page is active.
      startGPS()
      const cleanup = startOrientation()
      setHasPermission(true)
      return () => {
        cleanup?.()
        if (watchIdRef.current != null) {
          navigator.geolocation.clearWatch(watchIdRef.current)
        }
      }
    }

    // iOS — wait for user gesture to call requestPermission()
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [isSupported, startGPS, startOrientation])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  return {
    position,
    heading,
    tilt,
    isSupported,
    hasPermission,
    requiresSecureContext,
    requestPermission,
    error
  }
}
