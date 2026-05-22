import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import './AddEventPage.css'

const RECURRENCE_OPTIONS = [
  { label: 'None', value: '' },
  { label: 'Daily', value: 'FREQ=DAILY' },
  { label: 'Weekly', value: 'FREQ=WEEKLY' },
  { label: 'Monthly', value: 'FREQ=MONTHLY' },
]

export default function AddEventPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { apiFetch } = useApi()
  const { isAdmin, userId } = useAuth()

  const editEvent = location.state?.editEvent || null

  // Try to pre-fill spot if passed via state
  const initialSpotId = editEvent ? editEvent.spotId : (location.state?.spotId || '')
  const initialSpotName = editEvent ? (editEvent.spotName || '') : (location.state?.spotName || '')

  const [spots, setSpots] = useState([])
  const [selectedSpotId, setSelectedSpotId] = useState(initialSpotId)
  const [searchSpotQuery, setSearchSpotQuery] = useState(initialSpotName)

  const [title, setTitle] = useState(editEvent?.title || '')
  const [description, setDescription] = useState(editEvent?.description || '')

  const formatDateForInput = (iso) => iso ? new Date(iso).toISOString().slice(0, 16) : ''
  const [startTime, setStartTime] = useState(formatDateForInput(editEvent?.startTime))
  const [endTime, setEndTime] = useState(formatDateForInput(editEvent?.endTime))
  const [recurrenceRule, setRecurrenceRule] = useState(editEvent?.recurrenceRule || '')
  const [photoUrl, setPhotoUrl] = useState(editEvent?.imageUrl || '')
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState({ type: '', text: '' })

  const newlyUploaded = useRef(null)

  // Auto-cleanup uploaded image if form unmounts
  useEffect(() => {
    return () => {
      if (newlyUploaded.current) {
        fetch(`/api/v1/upload?url=${encodeURIComponent(newlyUploaded.current)}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }).catch(() => { })
      }
    }
  }, [])

  // Search spots
  useEffect(() => {
    const fetchSpots = async () => {
      if (searchSpotQuery.length < 2) {
        setSpots([])
        return
      }
      try {
        const res = await apiFetch(`/api/v1/spots/search?q=${encodeURIComponent(searchSpotQuery)}`)
        if (res.ok) {
          const data = await res.json()
          setSpots(data.slice(0, 5)) // limit to 5 suggestions
        }
      } catch { /* ignore */ }
    }
    const timer = setTimeout(fetchSpots, 300)
    return () => clearTimeout(timer)
  }, [searchSpotQuery, apiFetch])

  const handleSpotSelect = (spot) => {
    setSelectedSpotId(spot.id)
    setSearchSpotQuery(spot.name)
    setSpots([])
  }

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setMsg({ type: 'error', text: 'File exceeds 5MB limit.' })
      return
    }

    setUploading(true)
    setMsg({ type: '', text: '' })
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await apiFetch('/api/v1/upload', {
        method: 'POST',
        body: formData
      })

      if (res.ok) {
        const data = await res.json()
        setPhotoUrl(data.url)
        newlyUploaded.current = data.url
      } else {
        setMsg({ type: 'error', text: 'Failed to upload image' })
      }
    } catch {
      setMsg({ type: 'error', text: 'Error uploading file' })
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const removePhoto = async () => {
    try {
      await apiFetch(`/api/v1/upload?url=${encodeURIComponent(photoUrl)}`, { method: 'DELETE' })
      newlyUploaded.current = null
      setPhotoUrl('')
    } catch { /* ignore */ }
  }

  const submitEvent = async () => {
    if (!selectedSpotId || !title || !startTime) {
      setMsg({ type: 'error', text: 'Please select a spot, enter a title, and select a start time.' })
      return
    }

    setMsg({ type: '', text: '' })
    try {
      const payload = {
        spotId: selectedSpotId,
        title: title.trim(),
        description: description.trim() || null,
        startTime: new Date(startTime).toISOString(),
        endTime: endTime ? new Date(endTime).toISOString() : null,
        recurrenceRule: recurrenceRule || null,
        imageUrl: photoUrl || null
      }

      if (editEvent) {
        const url = isAdmin ? `/api/v1/admin/events/${editEvent.id}` : `/api/v1/events/${editEvent.id}`
        const res = await apiFetch(url, {
          method: 'PUT',
          body: JSON.stringify(payload)
        })
        const data = await res.json()
        if (res.ok) {
          setMsg({ type: 'success', text: `✓ Event "${data.title}" updated successfully! ${!isAdmin ? '(Pending approval)' : ''}` })
        } else {
          setMsg({ type: 'error', text: data.error || 'Failed to update event.' })
        }
      } else {
        const res = await apiFetch('/api/v1/events', {
          method: 'POST',
          body: JSON.stringify(payload)
        })
        const data = await res.json()
        if (res.ok) {
          setMsg({ type: 'success', text: `✓ Event "${data.title}" submitted successfully! ${!isAdmin ? '(Pending approval)' : ''}` })
          newlyUploaded.current = null
          setTitle('')
          setDescription('')
          setStartTime('')
          setEndTime('')
          setRecurrenceRule('')
          setPhotoUrl('')
          setSelectedSpotId('')
          setSearchSpotQuery('')
        } else {
          setMsg({ type: 'error', text: data.error || 'Failed to submit event.' })
        }
      }
    } catch {
      setMsg({ type: 'error', text: 'Server error. Please try again later.' })
    }
  }

  return (
    <div className="add-event-page animate-fade-up">
      <div className="add-event-container glass">
        <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: '1rem', padding: '0.5rem', minWidth: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Back
        </button>
        <h1 className="page-title" style={{ marginTop: 0 }}>{editEvent ? 'Edit Event' : 'Add Event'}</h1>
        <p className="page-sub">{editEvent ? 'Update the details for this event.' : `Create an event for a specific spot. ${isAdmin ? '' : 'Requires admin approval.'}`}</p>

        {msg.text && <div className={`msg msg-${msg.type}`} style={{ marginBottom: '1.5rem' }}>{msg.text}</div>}

        <div className="field" style={{ position: 'relative' }}>
          <label className="label">Location (Spot)</label>
          <input
            className="input"
            placeholder="Search for a spot..."
            value={searchSpotQuery}
            onChange={e => {
              setSearchSpotQuery(e.target.value)
              if (selectedSpotId) setSelectedSpotId('') // clear selection if user types
            }}
          />
          {spots.length > 0 && !selectedSpotId && (
            <div className="suggestions-dropdown">
              {spots.map(spot => (
                <div key={spot.id} className="suggestion-item" onClick={() => handleSpotSelect(spot)}>
                  <div className="suggestion-name">{spot.name}</div>
                  <div className="suggestion-full">{spot.address}</div>
                </div>
              ))}
            </div>
          )}
          {selectedSpotId && <div style={{ fontSize: '0.8rem', color: 'var(--success)', marginTop: '0.25rem', fontWeight: 600 }}>✓ Spot selected</div>}
        </div>

        <div className="field">
          <label className="label">Event Title</label>
          <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Live Music Night" />
        </div>

        <div className="field">
          <label className="label">Description</label>
          <textarea className="input textarea" value={description} onChange={e => setDescription(e.target.value)} placeholder="Event details..." />
        </div>

        <div className="form-row">
          <div className="field">
            <label className="label">Start Time</label>
            <input type="datetime-local" className="input" value={startTime} onChange={e => setStartTime(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">End Time (Optional)</label>
            <input type="datetime-local" className="input" value={endTime} onChange={e => setEndTime(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label className="label">Repeat</label>
          <select className="input select" value={recurrenceRule} onChange={e => setRecurrenceRule(e.target.value)}>
            {RECURRENCE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="label">Event Image (Max 5MB)</label>
          <input type="file" accept="image/png, image/jpeg, image/webp" className="input" onChange={handleFileChange} disabled={uploading} />
          {uploading && <div style={{ fontSize: '0.9rem', color: 'var(--primary)', marginTop: '0.5rem' }}>Uploading...</div>}

          {photoUrl && (
            <div style={{ position: 'relative', width: '120px', height: '120px', marginTop: '1rem' }}>
              <img src={photoUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
              <button
                onClick={removePhoto}
                style={{ position: 'absolute', top: '-5px', right: '-5px', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                ✕
              </button>
            </div>
          )}
        </div>

        <button className="btn btn-primary btn-submit" onClick={submitEvent}>
          {editEvent ? '💾 Save Changes' : '➕ Submit Event'}
        </button>
      </div>
    </div>
  )
}
