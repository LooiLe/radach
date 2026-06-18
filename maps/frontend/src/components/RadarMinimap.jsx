import { useEffect, useRef } from 'react'

export default function RadarMinimap({ position, heading, allPOIs, maxRange }) {
  const radarRef = useRef(null)

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

    // Heading wedge
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

  return (
    <div className="ar-radar">
      <canvas ref={radarRef} className="ar-radar-canvas" />
    </div>
  )
}
