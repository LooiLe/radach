import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useApi } from '../hooks/useApi'
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

function FitBounds({ bounds }) {
  const map = useMap()
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 })
    }
  }, [bounds, map])
  return null
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

  const [itinerary, setItinerary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)

  // Edit fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState('')
  const [stops, setStops] = useState([]) // array of: { spot, startTime, durationMinutes, notes }

  // Spot selector for additions
  const [showAddForm, setShowAddForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [savedSpots, setSavedSpots] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showSavedOnly, setShowSavedOnly] = useState(true)

  const [updating, setUpdating] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    loadItinerary()
    loadSavedSpots()
  }, [id])

  // Auto-schedule scheduler helper
  useEffect(() => {
    if (!isEditing || stops.length === 0) return
    const updated = [...stops]
    let currentHour = 9
    let currentMin = 0

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

      let nextMinTotal = endHour * 60 + endMin + 15
      currentHour = Math.floor(nextMinTotal / 60) % 24
      currentMin = nextMinTotal % 60
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
        setStops((data.stops || []).map(normalizeStop))
      } else {
        alert('Itinerary not found or access denied')
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
      alert('This spot is already in the itinerary')
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
    setShowAddForm(false)
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

  async function handleSaveChanges() {
    if (!title.trim()) {
      alert('Please enter a title for this itinerary')
      return
    }
    setUpdating(true)
    try {
      const payload = {
        title: title.trim(),
        description,
        date: date || null,
        stops: stops.map((s, idx) => ({
          spotId: s.spot.id,
          stopOrder: idx + 1,
          startTime: s.startTime,
          endTime: s.endTime,
          durationMinutes: parseInt(s.durationMinutes) || 60,
          notes: s.notes
        }))
      }

      const res = await apiFetch(`/api/v1/itineraries/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        const updatedData = await res.json()
        updatedData.stops = (updatedData.stops || []).map(normalizeStop)
        setItinerary(updatedData)
        setStops(updatedData.stops)
        setIsEditing(false)
      } else {
        const err = await res.json().catch(() => ({}))
        alert(err.error || 'Failed to update itinerary')
      }
    } catch (e) {
      console.error(e)
      alert('Failed to connect to backend')
    } finally {
      setUpdating(false)
    }
  }

  async function handleDeleteItinerary() {
    try {
      const res = await apiFetch(`/api/v1/itineraries/${id}`, { method: 'DELETE' })
      if (res.ok) {
        navigate('/itineraries')
      } else {
        alert('Failed to delete itinerary')
      }
    } catch (e) {
      console.error(e)
      alert('Failed to delete itinerary')
    }
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
              color="#8b5cf6"
              weight={4}
              opacity={0.8}
              dashArray="8, 12"
            />
          )}
          {mapBounds.length > 0 && <FitBounds bounds={mapBounds} />}
        </MapContainer>
      </div>

      {/* TIMELINE SIDEBAR */}
      <div className="detail-sidebar">
        
        {/* HEADER SECTION */}
        <div className="detail-header glass">
          <div className="header-meta">
            <Link to="/itineraries" className="back-link">
              ⬅️ All Itineraries
            </Link>
            {itinerary.source === 'GENERATED' && <span className="source-badge generated">⚡Generated</span>}
            {itinerary.source === 'MANUAL' && <span className="source-badge manual">✏️ Manual Plan</span>}
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
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="edit-date-input"
              />
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
              {itinerary.date && <div className="detail-date">📅 {itinerary.date}</div>}
              {itinerary.description && <p className="detail-desc">{itinerary.description}</p>}
            </div>
          )}

          {canManage && (
            <div className="owner-actions">
              {isEditing ? (
                <>
                  <button onClick={handleSaveChanges} disabled={updating} className="btn-save">
                    {updating ? 'Saving...' : '💾 Save Changes'}
                  </button>
                  <button onClick={() => { setIsEditing(false); loadItinerary(); }} className="btn-cancel">
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setIsEditing(true)} className="btn-edit">
                    ✏️ Edit Route
                  </button>
                  <button onClick={() => setShowDeleteConfirm(true)} className="btn-delete">
                    🗑️ Delete
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* TIMELINE LIST */}
        <div className="detail-timeline-section">
          <h3>Route Timeline</h3>

          {stops.length === 0 ? (
            <div className="empty-timeline-message">
              No stops in this itinerary yet.
            </div>
          ) : (
            <div className="detail-timeline-list">
              {stops.map((stop, idx) => (
                <div key={`stop-card-${idx}`} className="detail-stop-card glass">
                  <div className="stop-badge">#{idx + 1}</div>

                  <div className="stop-details">
                    <div className="stop-header">
                      <h4 className="stop-name">{stop.spot.name}</h4>
                      <span className="stop-type">{stop.spot.type}</span>
                    </div>

                    <div className="stop-time">
                      🕒 {stop.startTime} - {stop.endTime} ({stop.durationMinutes} mins)
                    </div>

                    {isEditing ? (
                      <div className="stop-edit-inputs">
                        <div className="edit-row">
                          <label>Start Time</label>
                          <input
                            type="time"
                            value={stop.startTime}
                            onChange={e => handleStopChange(idx, 'startTime', e.target.value)}
                            disabled={idx > 0} // automatic scheduling handles subsequent stops
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
                            onChange={e => handleStopChange(idx, 'durationMinutes', parseInt(e.target.value) || 0)}
                            className="mini-input"
                          />
                        </div>
                        <div className="edit-row notes-row">
                          <input
                            type="text"
                            placeholder="Add notes for this stop..."
                            value={stop.notes || ''}
                            onChange={e => handleStopChange(idx, 'notes', e.target.value)}
                            className="mini-notes-input"
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        {stop.notes && <div className="stop-notes">📝 <em>"{stop.notes}"</em></div>}
                        <div className="stop-navigation-link">
                          <Link to={`/spot/${stop.spot.id}`} className="btn-spot-link">
                            View Spot
                          </Link>
                          <Link to={`/directions/${stop.spot.id}`} className="btn-directions-link">
                            🚗 Get Directions
                          </Link>
                        </div>
                      </>
                    )}
                  </div>

                  {isEditing && (
                    <div className="stop-edit-controls">
                      <button onClick={() => handleMoveStop(idx, -1)} disabled={idx === 0} className="edit-arrow-btn">▲</button>
                      <button onClick={() => handleMoveStop(idx, 1)} disabled={idx === stops.length - 1} className="edit-arrow-btn">▼</button>
                      <button onClick={() => handleRemoveStop(idx)} className="edit-remove-btn">✕</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {isEditing && !showAddForm && (
            <button className="btn-add-stop-trigger" onClick={() => setShowAddForm(true)}>
              ➕ Add Another Spot
            </button>
          )}

          {isEditing && showAddForm && (
            <div className="add-stop-panel glass">
              <div className="panel-header">
                <h4>Select Spot to Add</h4>
                <button onClick={() => setShowAddForm(false)} className="close-panel-btn">✕</button>
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
