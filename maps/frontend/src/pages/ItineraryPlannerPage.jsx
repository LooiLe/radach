import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { useApi } from '../hooks/useApi'
import 'leaflet/dist/leaflet.css'
import './ItineraryPlannerPage.css'

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

function MapEventsHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng)
    }
  })
  return null
}

function FitBounds({ bounds }) {
  const map = useMap()
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 })
    }
  }, [bounds, map])
  return null
}

export default function ItineraryPlannerPage() {
  const { apiFetch } = useApi()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Tab state: 'manual' or 'generate'
  const plannerTabs = ['manual', 'generate']
  const initialTab = plannerTabs.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'manual'
  const [activeTab, setActiveTab] = useState(initialTab)

  // Pricing & User credit/sub info
  const [pricing, setPricing] = useState(null)
  const [credits, setCredits] = useState(0)
  const [subscription, setSubscription] = useState(null)

  // Spot Search & Saved spots
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [savedSpots, setSavedSpots] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showSavedOnly, setShowSavedOnly] = useState(true)

  // Manual Itinerary creation state
  const [itTitle, setItTitle] = useState('')
  const [itDesc, setItDesc] = useState('')
  const [itDate, setItDate] = useState(new Date().toISOString().split('T')[0])
  const [stops, setStops] = useState([]) // Array of stops: { spot, startTime, durationMinutes, notes }
  const [saving, setSaving] = useState(false)

  // Generation parameters state
  const [selectedCategories, setSelectedCategories] = useState(['restaurant', 'activity'])
  const [reviewSource, setReviewSource] = useState('CONNECTIONS')
  const [genDate, setGenDate] = useState(new Date().toISOString().split('T')[0])
  const [numberOfStops, setNumberOfStops] = useState(4)
  const [centerLat, setCenterLat] = useState(13.7563) // default Bangkok
  const [centerLng, setCenterLng] = useState(100.5018)
  const [radiusKm, setRadiusKm] = useState(5.0)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('ONE_TIME')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState(null)
  const [categories, setCategories] = useState([])
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [centerSearchText, setCenterSearchText] = useState('')
  const [centerSuggestions, setCenterSuggestions] = useState([])
  const [centerSearching, setCenterSearching] = useState(false)
  const [centerStatus, setCenterStatus] = useState('')
  const centerSearchTimer = useRef(null)

  // Load initial data
  useEffect(() => {
    loadUserFinancials()
    loadSavedSpots()
    loadCategories()
  }, [])

  useEffect(() => {
    const nextTab = plannerTabs.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'manual'
    setActiveTab(nextTab)
  }, [searchParams])

  const changeTab = (nextTab) => {
    setActiveTab(nextTab)
    setSearchParams(nextTab === 'manual' ? {} : { tab: nextTab })
    if (nextTab === 'generate') {
      loadUserFinancials()
    }
  }

  useEffect(() => {
    if (categories.length === 0) return
    setSelectedCategories(prev => {
      const available = new Set(categories.map(c => c.name.toLowerCase()))
      const next = prev.filter(c => available.has(c.toLowerCase()))
      return next.length > 0 ? next : categories.slice(0, 2).map(c => c.name)
    })
  }, [categories])

  // Auto-schedule helper: Recalculate start/end times based on first stop time & durations
  useEffect(() => {
    if (stops.length === 0) return
    const updated = [...stops]
    let currentHour = 9
    let currentMin = 0

    // Parse the start time of the first stop if set, otherwise default to 09:00
    if (updated[0].startTime) {
      const match = updated[0].startTime.split(':')
      if (match.length >= 2) {
        const h = parseInt(match[0])
        const m = parseInt(match[1])
        if (!isNaN(h) && !isNaN(m)) {
          currentHour = h
          currentMin = m
        }
      }
    }

    for (let i = 0; i < updated.length; i++) {
      const startStr = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`
      updated[i].startTime = startStr

      const duration = updated[i].durationMinutes || 60
      let endMinTotal = currentHour * 60 + currentMin + duration
      const endHour = Math.floor(endMinTotal / 60) % 24
      const endMin = endMinTotal % 60
      updated[i].endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`

      // Add 15 mins travel buffer for the next start time
      let nextMinTotal = endHour * 60 + endMin + 15
      currentHour = Math.floor(nextMinTotal / 60) % 24
      currentMin = nextMinTotal % 60
    }

    // Only update state if values changed to prevent infinite loops
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
  }, [stops])

  async function loadUserFinancials() {
    try {
      const [pricingRes, creditsRes, subRes] = await Promise.all([
        apiFetch('/api/v1/pricing'),
        apiFetch('/api/v1/stripe/my-credits'),
        apiFetch('/api/v1/stripe/my-subscription')
      ])
      if (pricingRes.ok) setPricing(await pricingRes.json())
      if (creditsRes.ok) {
        const d = await creditsRes.json()
        setCredits(d.balance)
      }
      if (subRes.ok) {
        const sub = await subRes.json()
        setSubscription(sub)
        if (sub.tier !== 'NONE') {
          setSelectedPaymentMethod('SUBSCRIPTION')
        } else {
          setSelectedPaymentMethod('ONE_TIME')
        }
      }
    } catch (e) {
      console.error('Failed to load user financial context', e)
    }
  }

  async function loadSavedSpots() {
    try {
      const res = await apiFetch('/api/v1/spots/saved')
      if (res.ok) {
        const data = await res.json()
        setSavedSpots(data)
        if (data.length > 0) {
          // Centering map to first saved spot if present
          setCenterLat(data[0].latitude)
          setCenterLng(data[0].longitude)
        }
      }
    } catch (e) {
      console.error('Failed to load saved spots', e)
    }
  }

  async function loadCategories() {
    setCategoriesLoading(true)
    try {
      const res = await apiFetch('/api/v1/categories')
      if (res.ok) {
        const data = await res.json()
        const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name))
        setCategories(sorted)
      }
    } catch (e) {
      console.error('Failed to load categories', e)
    } finally {
      setCategoriesLoading(false)
    }
  }

  // Handle spot search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    const timeout = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await apiFetch(`/api/v1/spots/search?q=${encodeURIComponent(searchQuery)}&limit=8`)
        if (res.ok) {
          setSearchResults(await res.json())
        }
      } catch (err) {
        console.error('Search failed', err)
      } finally {
        setSearchLoading(false)
      }
    }, 400)
    return () => clearTimeout(timeout)
  }, [searchQuery, apiFetch])

  const handleAddStop = (spot) => {
    if (stops.some(s => s.spot.id === spot.id)) {
      alert('This spot is already in your itinerary')
      return
    }
    setStops(prev => [
      ...prev,
      {
        spot,
        startTime: prev.length === 0 ? '09:00' : '',
        durationMinutes: 60,
        notes: ''
      }
    ])
  }

  const handleRemoveStop = (index) => {
    setStops(prev => prev.filter((_, i) => i !== index))
  }

  const handleMoveStop = (index, direction) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= stops.length) return
    const updated = [...stops]
    const temp = updated[index]
    updated[index] = updated[targetIndex]
    updated[targetIndex] = temp
    setStops(updated)
  }

  const handleStopChange = (index, key, val) => {
    setStops(prev => prev.map((s, i) => i === index ? { ...s, [key]: val } : s))
  }

  // Save manual itinerary
  async function handleSaveManual() {
    if (!itTitle.trim()) {
      alert('Please enter a title for your itinerary')
      return
    }
    if (stops.length === 0) {
      alert('Please add at least one spot to your itinerary')
      return
    }

    setSaving(true)
    try {
      const payload = {
        title: itTitle,
        description: itDesc,
        date: itDate,
        stops: stops.map((s, idx) => ({
          spotId: s.spot.id,
          stopOrder: idx + 1,
          startTime: s.startTime,
          endTime: s.endTime,
          durationMinutes: parseInt(s.durationMinutes) || 60,
          notes: s.notes
        }))
      }

      const res = await apiFetch('/api/v1/itineraries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        const data = await res.json()
        navigate(`/itineraries/${data.id}`)
      } else {
        const err = await res.json()
        alert(`Error: ${err.error || 'Failed to save itinerary'}`)
      }
    } catch (err) {
      console.error(err)
      alert('Network error saving itinerary')
    } finally {
      setSaving(false)
    }
  }

  // Handle generation checkout or direct trigger
  async function handleGenerate() {
    setGenerating(true)
    setGenError(null)

    const payload = {
      preferredCategories: selectedCategories,
      reviewSource,
      date: genDate,
      numberOfStops: parseInt(numberOfStops),
      centerLatitude: centerLat,
      centerLongitude: centerLng,
      radiusKm: parseFloat(radiusKm),
      paymentMethod: selectedPaymentMethod,
      cancelUrl: window.location.href
    }

    try {
      const res = await apiFetch('/api/v1/itineraries/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to initiate generation')
      }

      if (data.checkoutUrl) {
        // Redirect to Stripe checkout for payment
        window.location.href = data.checkoutUrl
      } else if (data.status === 'COMPLETED' || data.status === 'GENERATING' || data.status === 'PAID') {
        // Direct generation completed (Credits or subscription usage)
        navigate(`/payment/success?gen=${data.id}`)
      } else {
        throw new Error('Unexpected response status')
      }
    } catch (err) {
      setGenError(err.message)
      setGenerating(false)
    }
  }

  // Stripe payments: purchase credits or subscription tier
  async function handlePurchaseCredits(qty) {
    try {
      const res = await apiFetch('/api/v1/stripe/credits/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packSize: qty, cancelUrl: window.location.href })
      })
      const data = await res.json()
      if (res.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      } else {
        alert(data.error || 'Payment checkout initialization failed')
      }
    } catch (e) {
      console.error(e)
      alert('Failed to connect to Stripe')
    }
  }

  async function handleSubscribe(tier) {
    try {
      const res = await apiFetch('/api/v1/stripe/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, cancelUrl: window.location.href })
      })
      const data = await res.json()
      if (res.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      } else {
        alert(data.error || 'Subscription checkout initialization failed')
      }
    } catch (e) {
      console.error(e)
      alert('Failed to connect to Stripe')
    }
  }

  // Map click handler to set area center when generating
  const handleMapClick = (lat, lng) => {
    if (activeTab === 'generate') {
      setCenterLat(lat)
      setCenterLng(lng)
      setCenterSearchText('')
      setCenterSuggestions([])
      setCenterStatus('Center moved from map click')
    }
  }

  const setGenerationCenter = (lat, lng, label = '') => {
    setCenterLat(lat)
    setCenterLng(lng)
    setCenterSearchText(label)
    setCenterSuggestions([])
    setCenterStatus(label ? `Center set to ${label}` : 'Center updated')
  }

  const handleCenterSearchInput = (e) => {
    const val = e.target.value
    setCenterSearchText(val)
    setCenterStatus('')
    clearTimeout(centerSearchTimer.current)

    if (val.trim().length < 2) {
      setCenterSuggestions([])
      return
    }

    centerSearchTimer.current = setTimeout(async () => {
      setCenterSearching(true)
      try {
        let combined = []

        try {
          const spotRes = await apiFetch(`/api/v1/spots/search?q=${encodeURIComponent(val)}&limit=4`)
          if (spotRes.ok) {
            combined = await spotRes.json()
          }
        } catch (e) {
          console.error('Center spot search failed', e)
        }

        try {
          const nomRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=4`, {
            headers: { 'Accept-Language': 'en' }
          })
          const nomData = await nomRes.json()
          const formatted = nomData.map(item => ({
            latitude: parseFloat(item.lat),
            longitude: parseFloat(item.lon),
            name: item.display_name.split(',')[0],
            type: 'Place',
            address: item.display_name
          }))
          const existing = new Set(combined.map(s => `${s.name}-${s.latitude}-${s.longitude}`))
          combined = [
            ...combined,
            ...formatted.filter(s => !existing.has(`${s.name}-${s.latitude}-${s.longitude}`))
          ]
        } catch (e) {
          console.error('Center place search failed', e)
        }

        setCenterSuggestions(combined)
      } finally {
        setCenterSearching(false)
      }
    }, 600)
  }

  const selectCenterSuggestion = (place) => {
    setGenerationCenter(place.latitude, place.longitude, place.name)
  }

  const useCurrentCenter = () => {
    const fallbackToIpLocation = async () => {
      setCenterStatus('Using IP-based location estimate...')
      try {
        const res = await fetch('https://get.geojs.io/v1/ip/geo.json')
        const data = await res.json()
        if (!data.latitude || !data.longitude) throw new Error('Invalid IP location')
        const label = data.city ? `Current Location (${data.city})` : 'Current Location'
        setGenerationCenter(parseFloat(data.latitude), parseFloat(data.longitude), label)
      } catch (err) {
        console.error('IP location failed', err)
        setCenterStatus('Could not get your location. Try searching for a place instead.')
      }
    }

    setCenterStatus('Getting current location...')
    if (!navigator.geolocation) {
      fallbackToIpLocation()
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGenerationCenter(position.coords.latitude, position.coords.longitude, 'Current Location')
      },
      (error) => {
        console.warn('Geolocation error:', error)
        fallbackToIpLocation()
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
    )
  }

  // Map center bounds
  const mapBounds = stops.length > 0 
    ? stops.map(s => [s.spot.latitude, s.spot.longitude])
    : activeTab === 'generate' 
      ? [[centerLat - 0.05, centerLng - 0.05], [centerLat + 0.05, centerLng + 0.05]]
      : savedSpots.length > 0 
        ? savedSpots.map(s => [s.latitude, s.longitude])
        : [[13.7563, 100.5018]]

  return (
    <div className="itinerary-planner">
      
      {/* MAP LAYER */}
      <div className="itinerary-map-container">
        {activeTab === 'generate'}
        <MapContainer center={[centerLat, centerLng]} zoom={12} style={{ width: '100%', height: '100%' }}>
          <TileLayer
            url={`https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key=${import.meta.env.VITE_STADIA_API_KEY}`}
            attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="http://openstreetmap.org">OpenStreetMap</a>'
          />

          {/* Manual Itinerary Markers */}
          {activeTab === 'manual' && stops.map((stop, idx) => (
            <Marker
              key={`stop-${stop.spot.id}-${idx}`}
              position={[stop.spot.latitude, stop.spot.longitude]}
              icon={createNumberMarkerIcon(idx + 1, stop.spot.type)}
            >
              <Popup>
                <strong>#{idx + 1} {stop.spot.name}</strong><br />
                {stop.startTime} - {stop.endTime}<br />
                {stop.notes && <em>"{stop.notes}"</em>}
              </Popup>
            </Marker>
          ))}

          {/* Polyline connecting itinerary stops */}
          {activeTab === 'manual' && stops.length > 1 && (
            <Polyline
              positions={stops.map(s => [s.spot.latitude, s.spot.longitude])}
              color="#8b5cf6"
              weight={4}
              opacity={0.8}
              dashArray="8, 12"
            />
          )}

          {/* Generation Center & Radius Circle */}
          {activeTab === 'generate' && (
            <>
              <Marker 
                position={[centerLat, centerLng]} 
                icon={new L.DivIcon({
                  html: '<div class="center-pin">🎯</div>',
                  className: 'generation-center-marker',
                  iconSize: [30, 30],
                  iconAnchor: [15, 15]
                })}
              />
              <Circle
                center={[centerLat, centerLng]}
                radius={radiusKm * 1000}
                pathOptions={{ color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.15, weight: 2 }}
              />
            </>
          )}

          <MapEventsHandler onMapClick={handleMapClick} />
          {mapBounds.length > 0 && <FitBounds bounds={mapBounds} />}
        </MapContainer>
      </div>

      {/* PLANNER SIDEBAR */}
      <div className="itinerary-sidebar">
        <div style={{ padding: '1.5rem 1.5rem 0 1.5rem' }}>
          <Link to="/itineraries" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: '#6366f1', fontWeight: '600', transition: 'color 0.2s' }}>
            ⬅️ Back to My Itineraries
          </Link>
        </div>
        <div className="planner-tabs">
          <button 
            className={`tab-btn ${activeTab === 'manual' ? 'active' : ''}`}
            onClick={() => changeTab('manual')}
          >
            ✏️ Plan Your Own
          </button>
          <button 
            className={`tab-btn ${activeTab === 'generate' ? 'active' : ''}`}
            onClick={() => changeTab('generate')}
          >
            ✨ Generate for Me
          </button>
        </div>

        {/* ─── TAB 1: PLAN YOUR OWN (MANUAL) ─── */}
        {activeTab === 'manual' && (
          <div className="tab-pane manual-pane">
            <div className="form-group">
              <label>Itinerary Title</label>
              <input
                type="text"
                placeholder="e.g. Weekend Food & Culture Tour"
                value={itTitle}
                onChange={e => setItTitle(e.target.value)}
                className="styled-input"
              />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                placeholder="Detail what this trip is all about..."
                value={itDesc}
                onChange={e => setItDesc(e.target.value)}
                className="styled-textarea"
              />
            </div>
            <div className="form-group">
              <label>Planned Date</label>
              <input
                type="date"
                value={itDate}
                onChange={e => setItDate(e.target.value)}
                className="styled-input"
              />
            </div>

            {/* Timeline */}
            <div className="timeline-section">
              <h3 className="section-title">Timeline ({stops.length} stop{stops.length !== 1 ? 's' : ''})</h3>
              
              {stops.length === 0 ? (
                <div className="timeline-empty">
                  <p>Add spots from your saved list or search below to build your timeline!</p>
                </div>
              ) : (
                <div className="planner-timeline">
                  {stops.map((stop, idx) => (
                    <div key={`stop-item-${idx}`} className="timeline-item-card glass">
                      <div className="item-order">{idx + 1}</div>
                      <div className="item-content">
                        <div className="item-header">
                          <span className="item-name">{stop.spot.name}</span>
                          <span className="item-type">{stop.spot.type}</span>
                        </div>
                        <div className="item-time-row">
                          <div className="time-field">
                            <label>Start</label>
                            <input
                              type="time"
                              value={stop.startTime}
                              onChange={e => handleStopChange(idx, 'startTime', e.target.value)}
                              disabled={idx > 0} // First stop sets the root scheduler
                              className="time-input"
                            />
                          </div>
                          <div className="time-field">
                            <label>Duration (mins)</label>
                            <input
                              type="number"
                              min="10"
                              step="5"
                              value={stop.durationMinutes}
                              onChange={e => handleStopChange(idx, 'durationMinutes', parseInt(e.target.value) || 0)}
                              className="duration-input"
                            />
                          </div>
                          <div className="time-display-field">
                            <label>Ends</label>
                            <span className="end-time-display">{stop.endTime}</span>
                          </div>
                        </div>
                        <div className="item-notes-row">
                          <input
                            type="text"
                            placeholder="Add notes (e.g. Try the Pad Thai!)"
                            value={stop.notes}
                            onChange={e => handleStopChange(idx, 'notes', e.target.value)}
                            className="notes-input"
                          />
                        </div>
                      </div>
                      <div className="item-controls">
                        <button onClick={() => handleMoveStop(idx, -1)} disabled={idx === 0} className="ctrl-btn">▲</button>
                        <button onClick={() => handleMoveStop(idx, 1)} disabled={idx === stops.length - 1} className="ctrl-btn">▼</button>
                        <button onClick={() => handleRemoveStop(idx)} className="ctrl-btn delete">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Spot Selector */}
            <div className="spot-selector-section border-top">
              <h3 className="section-title">Add Spots</h3>
              <div className="selector-filters">
                <button 
                  className={`filter-btn ${showSavedOnly ? 'active' : ''}`}
                  onClick={() => setShowSavedOnly(true)}
                >
                  ❤️ Saved Spots
                </button>
                <button 
                  className={`filter-btn ${!showSavedOnly ? 'active' : ''}`}
                  onClick={() => setShowSavedOnly(false)}
                >
                  🔍 Search All
                </button>
              </div>

              {showSavedOnly ? (
                <div className="saved-spots-list">
                  {savedSpots.length === 0 ? (
                    <p className="no-spots-text">No saved spots yet. Browse spots on the map and save them to plan easily!</p>
                  ) : (
                    savedSpots.map(spot => (
                      <div key={`saved-${spot.id}`} className="selector-card">
                        <div className="card-info">
                          <div className="spot-name">{spot.name}</div>
                          <div className="spot-meta">{spot.type} · {spot.address}</div>
                        </div>
                        <button 
                          className="add-to-iti-btn"
                          onClick={() => handleAddStop(spot)}
                        >
                          ➕ Add
                        </button>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="search-spots-wrapper">
                  <input
                    type="text"
                    placeholder="Search spots by name or keyword..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="styled-input search-input"
                  />
                  {searchLoading && <div className="loading-spinner search-spin" />}
                  <div className="search-results-list">
                    {searchResults.map(spot => (
                      <div key={`search-${spot.id}`} className="selector-card">
                        <div className="card-info">
                          <div className="spot-name">{spot.name}</div>
                          <div className="spot-meta">{spot.type} · {spot.address}</div>
                        </div>
                        <button 
                          className="add-to-iti-btn"
                          onClick={() => handleAddStop(spot)}
                        >
                          ➕ Add
                        </button>
                      </div>
                    ))}
                    {!searchLoading && searchQuery.trim() && searchResults.length === 0 && (
                      <p className="no-spots-text">No results found</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="planner-footer">
              <button 
                onClick={handleSaveManual}
                disabled={saving || stops.length === 0}
                className="save-itinerary-btn"
              >
                {saving ? 'Saving...' : '💾 Save Itinerary'}
              </button>
            </div>
          </div>
        )}

        {/* ─── TAB 2: GENERATE FOR ME (PAID) ─── */}
        {activeTab === 'generate' && (
          <div className="tab-pane generate-pane">
            <div className="generation-form">
              <h3>✨ Route Generation Settings</h3>
              <p className="help-text">Select your preferences, center area on map, and generate your customized itinerary.</p>

              <div className="form-group">
                <label>Preferred Activity Types</label>
                <div className="category-chips">
                  {(categories.length > 0 ? categories.map(c => c.name) : ['restaurant', 'cafe', 'bar', 'hotel', 'attraction']).map(cat => {
                    const selected = selectedCategories.some(selectedCat => selectedCat.toLowerCase() === cat.toLowerCase())
                    return (
                      <button
                        key={cat}
                        type="button"
                        className={`chip ${selected ? 'selected' : ''}`}
                        onClick={() => {
                          if (selected) {
                            setSelectedCategories(prev => prev.filter(c => c.toLowerCase() !== cat.toLowerCase()))
                          } else {
                            setSelectedCategories(prev => [...prev, cat])
                          }
                        }}
                      >
                        {cat}
                      </button>
                    )
                  })}
                </div>
                {categoriesLoading && <div className="field-note">Loading categories...</div>}
              </div>

              <div className="form-group">
                <label>Reviews Recommendation Source</label>
                <div className="toggle-group">
                  <button
                    type="button"
                    className={`toggle-btn ${reviewSource === 'CONNECTIONS' ? 'active' : ''}`}
                    onClick={() => setReviewSource('CONNECTIONS')}
                  >
                    👥 Friends & Connections
                  </button>
                  <button
                    type="button"
                    className={`toggle-btn ${reviewSource === 'EXPERT' ? 'active' : ''}`}
                    onClick={() => setReviewSource('EXPERT')}
                  >
                    ⭐ Verified Experts
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Planned Date</label>
                <input
                  type="date"
                  value={genDate}
                  onChange={e => setGenDate(e.target.value)}
                  className="styled-input"
                />
              </div>

              <div className="form-group">
                <label>Number of Stops: {numberOfStops}</label>
                <input
                  type="range"
                  min="2"
                  max="8"
                  value={numberOfStops}
                  onChange={e => setNumberOfStops(parseInt(e.target.value))}
                  className="styled-range"
                />
              </div>

              <div className="form-group">
                <label>Search Radius: {radiusKm} km</label>
                <input
                  type="range"
                  min="1"
                  max="30"
                  step="0.5"
                  value={radiusKm}
                  onChange={e => setRadiusKm(parseFloat(e.target.value))}
                  className="styled-range"
                />
              </div>

              <div className="form-group">
                <label>Center Location</label>
                <div className="center-search">
                  <div className="center-search-row">
                    <input
                      type="text"
                      value={centerSearchText}
                      onChange={handleCenterSearchInput}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && centerSuggestions.length > 0) {
                          selectCenterSuggestion(centerSuggestions[0])
                        }
                      }}
                      placeholder="Search a spot, area, or address..."
                      className="styled-input"
                    />
                    <button type="button" className="location-btn" onClick={useCurrentCenter}>
                      Current
                    </button>
                  </div>
                  {centerSearching && <div className="field-note">Searching...</div>}
                  {centerSuggestions.length > 0 && (
                    <div className="center-suggestions">
                      {centerSuggestions.map((place, idx) => (
                        <button
                          key={`${place.name}-${place.latitude}-${place.longitude}-${idx}`}
                          type="button"
                          className="center-suggestion"
                          onClick={() => selectCenterSuggestion(place)}
                        >
                          <span className="suggestion-name">{place.name}</span>
                          <span className="suggestion-meta">{place.type} - {place.address}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {centerStatus && <div className="field-note">{centerStatus}</div>}
                </div>
              </div>

              {/* PRICING & PAYMENT */}
              <div className="pricing-header border-top">
                <h3>Select Monetization / Payment Mode</h3>
                <div className="user-balances">
                  <div className="balance-pill credits">🎟️ Credits: {credits}</div>
                  <div className="balance-pill sub">
                    ⭐ Sub: {subscription?.tier === 'NONE' ? 'Free Tier' : `${subscription?.tier || 'Free Tier'}`}
                  </div>
                </div>
              </div>

              <div className="pricing-grid">
                
                {/* 1. One Time Payment */}
                <div 
                  className={`pricing-card ${selectedPaymentMethod === 'ONE_TIME' ? 'selected' : ''}`}
                  onClick={() => setSelectedPaymentMethod('ONE_TIME')}
                >
                  <div className="card-badge">Single Use</div>
                  <h4>One-Time Generation</h4>
                  <div className="price">${pricing ? (pricing.oneTimePriceCents / 100).toFixed(2) : '1.99'}</div>
                  <p>Pay once per itinerary route generated</p>
                  <span className="select-indicator" />
                </div>

                {/* 2. Credits */}
                <div 
                  className={`pricing-card ${selectedPaymentMethod === 'CREDITS' ? 'selected' : ''}`}
                  onClick={() => setSelectedPaymentMethod('CREDITS')}
                >
                  <div className="card-badge bg-amber">Best Value</div>
                  <h4>Use Itinerary Credits</h4>
                  <div className="price">1 Credit</div>
                  <p>Spend credits from your balance.</p>
                  
                  {credits > 0 ? (
                    <span className="credit-indicator text-green">Available: {credits}</span>
                  ) : (
                    <div className="credit-buy-actions" onClick={e => e.stopPropagation()}>
                      <button onClick={() => handlePurchaseCredits(pricing?.creditPackSmallQty || 5)}>
                        Buy 5 Pack (${pricing ? (pricing.creditPackSmallCents / 100).toFixed(2) : '7.99'})
                      </button>
                      <button onClick={() => handlePurchaseCredits(pricing?.creditPackLargeQty || 10)}>
                        Buy 10 Pack (${pricing ? (pricing.creditPackLargeCents / 100).toFixed(2) : '12.99'})
                      </button>
                    </div>
                  )}
                  <span className="select-indicator" />
                </div>

                {/* 3. Subscription */}
                <div 
                  className={`pricing-card ${selectedPaymentMethod === 'SUBSCRIPTION' ? 'selected' : ''}`}
                  onClick={() => setSelectedPaymentMethod('SUBSCRIPTION')}
                >
                  <div className="card-badge bg-purple">Pro Option</div>
                  <h4>Monthly Subscription</h4>
                  
                  {subscription?.tier && subscription.tier !== 'NONE' ? (
                    <>
                      <div className="price">Active ({subscription.tier})</div>
                      <p>Generations used this month: {subscription.generationsUsed} / {subscription.generationsLimit === 2147483647 ? '∞' : subscription.generationsLimit}</p>
                    </>
                  ) : (
                    <>
                      <div className="price">Subscribe</div>
                      <div className="sub-buy-actions" onClick={e => e.stopPropagation()}>
                        <button onClick={() => handleSubscribe('PRO')}>
                          Pro: $4.99/mo ({pricing?.proGenerationsLimit || 5} gens)
                        </button>
                        <button onClick={() => handleSubscribe('UNLIMITED')}>
                          Unlimited: $9.99/mo
                        </button>
                      </div>
                    </>
                  )}
                  <span className="select-indicator" />
                </div>

              </div>

              {genError && (
                <div className="gen-error-message">
                  ⚠️ {genError}
                </div>
              )}

              <div className="planner-footer">
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="generate-route-btn"
                >
                  {generating ? (
                    <>
                      <div className="loading-spinner btn-spin" />
                      Generating...
                    </>
                  ) : selectedPaymentMethod === 'ONE_TIME' ? (
                    '💳 Pay $1.99 & Generate Route'
                  ) : selectedPaymentMethod === 'CREDITS' ? (
                    credits > 0 ? '🎟️ Spend 1 Credit & Generate' : '❌ Purchase Credits to Generate'
                  ) : (
                    subscription && subscription.tier !== 'NONE' ? '⚡ Generate Route (Subscription)' : '❌ Subscribe to Generate'
                  )}
                </button>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  )
}
