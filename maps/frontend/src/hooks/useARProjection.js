import { useMemo } from 'react'

/**
 * Converts a list of POIs with GPS coordinates into screen-space positions
 * based on user's position, heading, and tilt.
 *
 * @param {Object} params
 * @param {number} params.userLat - User's latitude
 * @param {number} params.userLng - User's longitude
 * @param {number} params.heading - Device compass heading (0-360°)
 * @param {number} params.tilt - Device tilt (beta, ~90 when upright)
 * @param {Array} params.pois - Array of { id, latitude, longitude, name, type, ... }
 * @param {number} [params.cameraFOV=60] - Horizontal field of view in degrees
 * @param {number} [params.maxDistance=500] - Max distance in meters to show POIs
 * @param {number} [params.screenWidth=window.innerWidth]
 * @param {number} [params.screenHeight=window.innerHeight]
 * @returns {Array} POIs with added screenX, screenY, distance, bearing, isVisible
 */
export function useARProjection({
  userLat,
  userLng,
  heading,
  tilt,
  pois = [],
  cameraFOV = 60,
  maxDistance = 500,
  screenWidth = typeof window !== 'undefined' ? window.innerWidth : 400,
  screenHeight = typeof window !== 'undefined' ? window.innerHeight : 800
}) {
  return useMemo(() => {
    if (userLat == null || userLng == null || !pois.length) return []

    const projected = pois
      .map((poi) => {
        const lat = poi.latitude ?? poi.lat
        const lng = poi.longitude ?? poi.lng
        if (lat == null || lng == null) return null

        const distance = haversineMeters(userLat, userLng, lat, lng)
        if (distance > maxDistance) return null

        const bearing = calculateBearing(userLat, userLng, lat, lng)

        // Angular difference between device heading and POI bearing
        let angleDiff = bearing - heading
        // Normalize to -180..180
        if (angleDiff > 180) angleDiff -= 360
        if (angleDiff < -180) angleDiff += 360

        // Is POI within the camera's horizontal field of view?
        const halfFOV = cameraFOV / 2
        const isVisible = Math.abs(angleDiff) <= halfFOV + 10 // +10° buffer for edge markers

        // Screen X: map angleDiff to screen width
        const screenX = (angleDiff / cameraFOV) * screenWidth + screenWidth / 2

        // Screen Y: based on distance (farther = higher on screen) and tilt
        // Base Y at 60% of screen height, adjust up for far objects
        const distanceFactor = 1 - Math.min(distance / maxDistance, 1)
        const baseY = screenHeight * 0.35
        const tiltOffset = tilt != null ? ((tilt - 90) / 90) * screenHeight * 0.3 : 0
        const distanceOffset = (1 - distanceFactor) * screenHeight * 0.2
        const screenY = baseY + distanceOffset + tiltOffset

        // Scale: closer objects appear larger
        const scale = 0.6 + distanceFactor * 0.6

        return {
          ...poi,
          distance: Math.round(distance),
          bearing: Math.round(bearing),
          angleDiff,
          screenX: Math.round(screenX),
          screenY: Math.round(Math.max(60, Math.min(screenY, screenHeight - 120))),
          scale,
          isVisible
        }
      })
      .filter(Boolean)

    // Resolve overlap among visible POIs
    const visiblePois = projected
      .filter(poi => poi.isVisible)
      .sort((a, b) => a.distance - b.distance) // closest first

    const adjustedVisible = []
    for (const poi of visiblePois) {
      let screenY = poi.screenY
      let attempts = 0
      let collision = true

      while (collision && attempts < 5) {
        collision = false
        for (const placed of adjustedVisible) {
          const dx = Math.abs(poi.screenX - placed.screenX)
          const dy = Math.abs(screenY - placed.screenY)

          if (dx < 140 && dy < 55) {
            screenY = placed.screenY - 55
            collision = true
            break
          }
        }
        attempts++
      }

      poi.screenY = Math.max(60, screenY)
      adjustedVisible.push(poi)
    }

    // Combine and sort descending by distance so closer ones render on top in DOM
    const nonVisiblePois = projected.filter(poi => !poi.isVisible)
    return [...adjustedVisible, ...nonVisiblePois].sort((a, b) => b.distance - a.distance)
  }, [userLat, userLng, heading, tilt, pois, cameraFOV, maxDistance, screenWidth, screenHeight])
}

/**
 * Calculate bearing (initial azimuth) from point A to point B.
 * Returns degrees 0-360 (0 = North, 90 = East).
 */
function calculateBearing(lat1, lng1, lat2, lng2) {
  const φ1 = toRad(lat1)
  const φ2 = toRad(lat2)
  const Δλ = toRad(lng2 - lng1)

  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)

  const θ = Math.atan2(y, x)
  return (toDeg(θ) + 360) % 360
}

/**
 * Haversine distance in meters between two GPS coordinates.
 */
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000 // Earth radius in meters
  const φ1 = toRad(lat1)
  const φ2 = toRad(lat2)
  const Δφ = toRad(lat2 - lat1)
  const Δλ = toRad(lng2 - lng1)

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

function toRad(deg) { return deg * Math.PI / 180 }
function toDeg(rad) { return rad * 180 / Math.PI }

// Export helpers for testing
export { calculateBearing, haversineMeters }
