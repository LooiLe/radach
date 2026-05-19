import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, GeoJSON, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useApi } from '../hooks/useApi'
import './DirectionsPage.css'

// Fix default marker icon
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Create custom icons for start and end
const createStartIcon = () => {
  return new L.DivIcon({
    html: `<div class="custom-map-marker" style="border: 3px solid #16a34a;"><img src="/icons/stash--pin-location-light.svg" alt="Start" /></div>`,
    className: 'custom-leaflet-marker',
    iconSize: [44, 44],
    iconAnchor: [22, 44],
    popupAnchor: [0, -44],
  })
}

const createEndIcon = () => {
  return new L.DivIcon({
    html: `<div class="custom-map-marker" style="border: 3px solid #e11d48;"><img src="/icons/stash--pin-location-light.svg" alt="End" /></div>`,
    className: 'custom-leaflet-marker',
    iconSize: [44, 44],
    iconAnchor: [22, 44],
    popupAnchor: [0, -44],
  })
}

// Zoom controls component
const ZoomControls = () => {
  const map = useMap()
  
  const handleZoomIn = (e) => {
    e.preventDefault()
    if (map) map.zoomIn()
  }
  
  const handleZoomOut = (e) => {
    e.preventDefault()
    if (map) map.zoomOut()
  }
  
  return (
    <div className="leaflet-control-zoom" style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <button type="button" className="leaflet-control-zoom-in" title="Zoom in" onClick={handleZoomIn}>+</button>
      <button type="button" className="leaflet-control-zoom-out" title="Zoom out" onClick={handleZoomOut}>–</button>
    </div>
  )
}

// Fit map to bounds component
function FitBounds({ bounds }) {
  const map = useMap()
  useEffect(() => {
    if (bounds?.length) map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 })
  }, [bounds, map])
  return null
}

export default function DirectionsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { apiFetch } = useApi()

  const [status, setStatus] = useState('Loading...')
  const [destinationSpot, setDestinationSpot] = useState(null)
  
  const [startPoint, setStartPoint] = useState(null) // { lat, lng, name }
  const [endPoint, setEndPoint] = useState(null) // { lat, lng, name }
  
  const [routeData, setRouteData] = useState(null)
  const [routeInfo, setRouteInfo] = useState(null) // { distance, duration }
  
  // Search state
  const [startInputText, setStartInputText] = useState('Current Location')
  const [endInputText, setEndInputText] = useState('')
  const [activeField, setActiveField] = useState(null) // 'start' or 'end'
  const [suggestions, setSuggestions] = useState([])
  const [isSearchingLoc, setIsSearchingLoc] = useState(false)
  const [usingCurrentLocation, setUsingCurrentLocation] = useState(true)
  const searchTimer = useRef(null)

  // 1. Load the destination spot
  useEffect(() => {
    if (!id) return;
    async function loadSpot() {
      try {
        const res = await apiFetch(`/api/v1/spots/${id}`)
        const data = await res.json()
        if (res.ok) {
          setDestinationSpot(data)
          setEndPoint({ lat: data.latitude, lng: data.longitude, name: data.name })
          setEndInputText(data.name)
        } else {
          setStatus('Spot not found.')
        }
      } catch (err) {
        setStatus('Error loading spot.')
      }
    }
    loadSpot()
  }, [id, apiFetch])

  // 2. Try to get Current Location on mount
  useEffect(() => {
    const fallbackToIpLocation = async (reason) => {
      setStatus(`IP-based location estimate...`)
      try {
        const res = await fetch('https://get.geojs.io/v1/ip/geo.json')
        const data = await res.json()
        if (data.latitude && data.longitude) {
          setStartPoint({
            lat: parseFloat(data.latitude),
            lng: parseFloat(data.longitude),
            name: data.city ? `Current Location (${data.city})` : 'Current Location'
          })
          setStartInputText(data.city ? `Current Location (${data.city})` : 'Current Location')
          setUsingCurrentLocation(true)
          setStatus('')
        } else {
          throw new Error('Invalid IP data')
        }
      } catch (err) {
        setStatus('Could not get current location. Please search manually.')
        setStartInputText('')
        setUsingCurrentLocation(false)
      }
    }

    if (!navigator.geolocation) {
      fallbackToIpLocation('Not supported')
      return
    }
    
    setStatus('Getting current location...')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setStartPoint({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          name: 'Current Location'
        })
        setStartInputText('Current Location')
        setUsingCurrentLocation(true)
        setStatus('')
      },
      (error) => {
        console.warn('Geolocation error:', error)
        fallbackToIpLocation(error.message || 'Permission denied')
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
    )
  }, [])

  // 3. Fetch Route from OSRM when both start and end are available
  useEffect(() => {
    if (!startPoint || !endPoint) return;

    async function fetchRoute() {
      setStatus('Calculating route...')
      setRouteData(null)
      setRouteInfo(null)
      
      try {
        // OSRM expects coordinates as lon,lat
        const url = `https://router.project-osrm.org/route/v1/driving/${startPoint.lng},${startPoint.lat};${endPoint.lng},${endPoint.lat}?overview=full&geometries=geojson`
        
        // Note: For a public production app, replace this free public API with a dedicated OSRM instance or commercial API (e.g. Mapbox).
        const res = await fetch(url)
        const data = await res.json()
        
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const route = data.routes[0]
          setRouteData(route.geometry)
          
          // distance in meters, duration in seconds
          const distanceKm = (route.distance / 1000).toFixed(1)
          const durationMin = Math.round(route.duration / 60)
          
          let durationStr = `${durationMin} min`
          if (durationMin >= 60) {
            const hours = Math.floor(durationMin / 60)
            const mins = durationMin % 60
            durationStr = `${hours} hr ${mins} min`
          }
          
          setRouteInfo({
            distance: `${distanceKm} km`,
            duration: durationStr
          })
          setStatus('')
        } else {
          setStatus('Could not find a driving route between these locations.')
        }
      } catch (err) {
        console.error('Routing error:', err)
        setStatus('Error calculating route.')
      }
    }
    
    fetchRoute()
  }, [startPoint, endPoint])

  // Autocomplete search
  const handleSearchInput = (e, field) => {
    const val = e.target.value
    setActiveField(field)
    
    if (field === 'start') {
      setStartInputText(val)
      setUsingCurrentLocation(false)
    } else {
      setEndInputText(val)
    }
    
    clearTimeout(searchTimer.current)
    if (val.length < 2) {
      setSuggestions([])
      return
    }
    
    searchTimer.current = setTimeout(async () => {
      try {
        let combinedSuggestions = []

        // 1. Fetch from local backend spots
        try {
          const backendRes = await apiFetch(`/api/v1/spots/search?q=${encodeURIComponent(val)}&limit=3`)
          if (backendRes.ok) {
            const backendData = await backendRes.json()
            if (backendData && backendData.length > 0) {
              combinedSuggestions = [...backendData]
            }
          }
        } catch (e) { console.error('Backend search error:', e) }

        // 2. Fetch from Nominatim for global locations
        try {
          const nomRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=3`, {
            headers: { 'Accept-Language': 'en' }
          })
          const nomData = await nomRes.json()
          if (nomData && nomData.length > 0) {
            const formatted = nomData.map(item => ({
              latitude: parseFloat(item.lat),
              longitude: parseFloat(item.lon),
              name: item.display_name.split(',')[0],
              type: 'Global Location',
              address: item.display_name
            }))
            // Filter out exact name duplicates just in case
            const existingNames = new Set(combinedSuggestions.map(s => s.name))
            const uniqueFormatted = formatted.filter(f => !existingNames.has(f.name))
            combinedSuggestions = [...combinedSuggestions, ...uniqueFormatted]
          }
        } catch (e) { console.error('Nominatim search error:', e) }

        setSuggestions(combinedSuggestions)
      } catch (error) {
        console.error('Error fetching suggestions:', error)
        setSuggestions([])
      }
    }, 800) // Increased debounce to 800ms to respect Nominatim rate limits
  }

  const selectSuggestion = (spot) => {
    if (activeField === 'start') {
      setStartInputText(spot.name)
      setStartPoint({ lat: spot.latitude, lng: spot.longitude, name: spot.name })
      setUsingCurrentLocation(false)
    } else {
      setEndInputText(spot.name)
      setEndPoint({ lat: spot.latitude, lng: spot.longitude, name: spot.name })
    }
    setSuggestions([])
    setActiveField(null)
  }

  // Geocode with Nominatim if user hits enter and didn't select suggestion
  const geocodeInput = async () => {
    const isStart = activeField === 'start'
    const val = isStart ? startInputText : endInputText
    if (!val.trim() || (isStart && usingCurrentLocation)) return
    
    setIsSearchingLoc(true)
    setStatus(`Searching for "${val}"...`)
    setSuggestions([])
    
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=1`)
      const data = await res.json()
      if (data && data.length > 0) {
        const result = data[0]
        if (isStart) {
          setStartPoint({ lat: parseFloat(result.lat), lng: parseFloat(result.lon), name: result.display_name })
          setStartInputText(result.display_name)
        } else {
          setEndPoint({ lat: parseFloat(result.lat), lng: parseFloat(result.lon), name: result.display_name })
          setEndInputText(result.display_name)
        }
      } else {
        setStatus('Location not found. Try a different search.')
      }
    } catch (e) {
      setStatus('Error searching for location.')
    } finally {
      setIsSearchingLoc(false)
      setActiveField(null)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      geocodeInput()
    }
  }
  
  const useCurrentLocationAgain = () => {
    const fallbackToIpLocation = async (reason) => {
      setStatus(`IP-based location estimate...`)
      try {
        const res = await fetch('https://get.geojs.io/v1/ip/geo.json')
        const data = await res.json()
        if (data.latitude && data.longitude) {
          setStartPoint({
            lat: parseFloat(data.latitude),
            lng: parseFloat(data.longitude),
            name: data.city ? `Current Location (${data.city})` : 'Current Location'
          })
          setStartInputText(data.city ? `Current Location (${data.city})` : 'Current Location')
          setUsingCurrentLocation(true)
          setSuggestions([])
          setStatus('')
        } else {
          throw new Error('Invalid IP data')
        }
      } catch (err) {
        setStatus('Could not get current location.')
      }
    }

    if (!navigator.geolocation) {
      fallbackToIpLocation('Not supported')
      return;
    }
    setStatus('Getting current location...')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setStartPoint({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          name: 'Current Location'
        })
        setStartInputText('Current Location')
        setUsingCurrentLocation(true)
        setSuggestions([])
        setStatus('')
      },
      (error) => {
        console.warn('Geolocation error:', error)
        fallbackToIpLocation(error.message || 'Permission denied')
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
    )
  }

  // Calculate bounds to show both start and end point
  const mapBounds = []
  if (startPoint) mapBounds.push([startPoint.lat, startPoint.lng])
  if (endPoint) mapBounds.push([endPoint.lat, endPoint.lng])

  // Center map if only one point or none
  const defaultCenter = [13.7563, 100.5018]
  const center = mapBounds.length > 0 ? mapBounds[0] : defaultCenter

  return (
    <div className="directions-page animate-fade-in">
      <div className="directions-panel">
        <div className="directions-header">
          <div className="directions-header-title">
            <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ padding: '0.2rem', minWidth: 'auto', marginRight: '0.2rem' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </button>
            <h2>Directions</h2>
          </div>

          <div className="location-inputs">
            <div className="input-connector"></div>
            
            <div className="input-group">
              <div className="input-icon">
                <div className="dot-start"></div>
              </div>
              <input 
                className="input" 
                value={startInputText}
                onChange={(e) => handleSearchInput(e, 'start')}
                onFocus={() => setActiveField('start')}
                onKeyDown={handleKeyDown}
                placeholder="Choose starting point..."
                disabled={isSearchingLoc && activeField === 'start'}
              />
              {startInputText && (
                <button className="clear-btn" onClick={() => { setStartInputText(''); setStartPoint(null); setUsingCurrentLocation(false); setRouteData(null); setRouteInfo(null); }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              )}
              
              {(activeField === 'start' && startInputText.length > 0 && startInputText !== startPoint?.name) && (
                <div className="suggestions-dropdown">
                  <div className="suggestion-item" onClick={useCurrentLocationAgain} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>
                    <span className="suggestion-name" style={{ margin: 0, color: 'inherit' }}>Your Current Location</span>
                  </div>
                  {suggestions.map((s, i) => (
                    <div key={i} className="suggestion-item" onClick={() => selectSuggestion(s)}>
                      <div className="suggestion-name">{s.name}</div>
                      <div className="suggestion-full">{s.type} · {s.address}</div>
                    </div>
                  ))}
                  {startInputText.length > 1 && !usingCurrentLocation && (
                    <div className="suggestion-item" onClick={geocodeInput} style={{ borderTop: suggestions.length > 0 ? '1px solid var(--border)' : 'none', background: 'var(--bg-glass)' }}>
                      <div className="suggestion-name" style={{ color: 'var(--text-secondary)' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        Search for "{startInputText}"
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="input-group">
              <div className="input-icon">
                <div className="dot-end"></div>
              </div>
              <input 
                className="input" 
                value={endInputText}
                onChange={(e) => handleSearchInput(e, 'end')}
                onFocus={() => setActiveField('end')}
                onKeyDown={handleKeyDown}
                placeholder="Choose destination..."
                disabled={isSearchingLoc && activeField === 'end'}
              />
              {endInputText && (
                <button className="clear-btn" onClick={() => { setEndInputText(''); setEndPoint(null); setRouteData(null); setRouteInfo(null); }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              )}

              {(activeField === 'end' && endInputText.length > 0 && endInputText !== endPoint?.name) && (
                <div className="suggestions-dropdown">
                  {suggestions.map((s, i) => (
                    <div key={i} className="suggestion-item" onClick={() => selectSuggestion(s)}>
                      <div className="suggestion-name">{s.name}</div>
                      <div className="suggestion-full">{s.type} · {s.address}</div>
                    </div>
                  ))}
                  {endInputText.length > 1 && (
                    <div className="suggestion-item" onClick={geocodeInput} style={{ borderTop: suggestions.length > 0 ? '1px solid var(--border)' : 'none', background: 'var(--bg-glass)' }}>
                      <div className="suggestion-name" style={{ color: 'var(--text-secondary)' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        Search for "{endInputText}"
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {(status || routeInfo) && (
          <div className="route-info">
            {status && <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{status}</div>}
            {routeInfo && !status && (
              <>
                <div className="route-info-row">
                  <span className="route-info-label">Distance:</span>
                  <span className="route-info-value">{routeInfo.distance}</span>
                </div>
                <div className="route-info-row">
                  <span className="route-info-label">Est. Time:</span>
                  <span className="route-info-value" style={{ color: 'var(--success)' }}>{routeInfo.duration}</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="directions-map">
        <MapContainer 
          center={center} 
          zoom={13} 
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            url={`https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key=${import.meta.env.VITE_STADIA_API_KEY}`}
            attribution='Map tiles by <a href="https://stadiamaps.com/">Stadia Maps</a>, <a href="https://openmaptiles.org/">OpenMapTiles</a>, and <a href="http://openstreetmap.org">OpenStreetMap</a> contributors'
          />
          
          {startPoint && (
            <Marker position={[startPoint.lat, startPoint.lng]} icon={createStartIcon()}>
              <Popup><strong>Start:</strong> {startPoint.name}</Popup>
            </Marker>
          )}
          
          {endPoint && (
            <Marker position={[endPoint.lat, endPoint.lng]} icon={createEndIcon()}>
              <Popup><strong>Destination:</strong> {endPoint.name}</Popup>
            </Marker>
          )}
          
          {routeData && (
            <GeoJSON 
              data={routeData} 
              style={{
                color: '#3b82f6', // blue
                weight: 5,
                opacity: 0.8,
                lineCap: 'round',
                lineJoin: 'round'
              }} 
            />
          )}
          
          <FitBounds bounds={mapBounds} />
          <ZoomControls />
        </MapContainer>
      </div>
    </div>
  )
}
