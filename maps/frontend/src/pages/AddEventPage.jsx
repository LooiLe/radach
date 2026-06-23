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
  const [category, setCategory] = useState(editEvent?.category || '')
  const [eventCategories, setEventCategories] = useState([])

  const formatDateForInput = (iso) => iso ? new Date(iso).toISOString().slice(0, 16) : ''
  const [startTime, setStartTime] = useState(formatDateForInput(editEvent?.startTime))
  const [endTime, setEndTime] = useState(formatDateForInput(editEvent?.endTime))
  const [recurrenceRule, setRecurrenceRule] = useState(editEvent?.recurrenceRule || '')
  const [photos, setPhotos] = useState(editEvent?.imageUrls || (editEvent?.imageUrl ? [editEvent.imageUrl] : []))
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState({ type: '', text: '' })

  const newlyUploaded = useRef([])

  // Auto-cleanup uploaded image if form unmounts
  useEffect(() => {
    return () => {
      if (newlyUploaded.current.length > 0) {
        newlyUploaded.current.forEach(url => {
          fetch(`/api/v1/upload?url=${encodeURIComponent(url)}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          }).catch(() => { })
        });
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

  // Fetch event categories
  useEffect(() => {
    async function fetchEventCategories() {
      try {
        const res = await apiFetch('/api/v1/event-categories')
        if (res.ok) {
          const data = await res.json()
          const sorted = data.sort((a, b) => {
            if (a.name.toLowerCase() === 'other') return 1;
            if (b.name.toLowerCase() === 'other') return -1;
            return a.name.localeCompare(b.name);
          });
          setEventCategories(sorted)
        }
      } catch { /* ignore */ }
    }
    fetchEventCategories()
  }, [apiFetch])

  const handleSpotSelect = (spot) => {
    setSelectedSpotId(spot.id)
    setSearchSpotQuery(spot.name)
    setSpots([])
  }

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files)
    if (!files.length) return

    setUploading(true)
    setMsg({ type: '', text: '' })
    try {
      const newPhotoUrls = []
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
          setMsg({ type: 'error', text: `File ${file.name} exceeds 5MB limit.` })
          continue
        }
        const formData = new FormData()
        formData.append('file', file)

        const res = await apiFetch('/api/v1/upload', {
          method: 'POST',
          body: formData
        })

        if (res.ok) {
          const data = await res.json()
          newPhotoUrls.push(data.url)
          newlyUploaded.current.push(data.url)
        } else {
          setMsg({ type: 'error', text: `Failed to upload ${file.name}` })
        }
      }
      setPhotos(prev => [...prev, ...newPhotoUrls])
    } catch {
      setMsg({ type: 'error', text: 'Error uploading files' })
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const removePhoto = async (index) => {
    const photoUrl = photos[index]
    try {
      await apiFetch(`/api/v1/upload?url=${encodeURIComponent(photoUrl)}`, { method: 'DELETE' })
      newlyUploaded.current = newlyUploaded.current.filter(url => url !== photoUrl)
      setPhotos(prev => prev.filter((_, i) => i !== index))
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
        imageUrls: photos.length > 0 ? photos : null,
        category: category || null
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
          setPhotos([])
          setCategory('')
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
          <label className="label">Category</label>
          <select className="input select" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">Select a category...</option>
            {eventCategories.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
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
          <div>
            <label className="btn btn-secondary" style={{ cursor: uploading ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', margin: 0 }}>
              {uploading ? 'Uploading...' : 'Upload Photos'}
              <input type="file" multiple accept="image/png, image/jpeg, image/webp" style={{ display: 'none' }} onChange={handleFileChange} disabled={uploading} />
            </label>
          </div>

          {photos.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
              {photos.map((url, idx) => (
                <div key={idx} style={{ position: 'relative', width: '120px', height: '120px' }}>
                  <img src={url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
                  <button
                    onClick={() => removePhoto(idx)}
                    style={{ position: 'absolute', top: '-5px', right: '-5px', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                    ✕
                  </button>
                </div>
              ))}
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
