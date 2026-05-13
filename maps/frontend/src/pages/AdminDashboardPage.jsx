import { useState, useEffect, useRef, useCallback } from 'react'
import { useApi } from '../hooks/useApi'
import './AdminDashboardPage.css'

export default function AdminDashboardPage() {
  const { apiFetch } = useApi()
  const [tab, setTab] = useState('add-spot')

  // Add Spot form
  const [name, setName] = useState(''); const [type, setType] = useState('Restaurant')
  const [address, setAddress] = useState(''); const [lat, setLat] = useState('')
  const [lng, setLng] = useState(''); const [tags, setTags] = useState('')
  const [status, setStatus] = useState('ACTIVE')
  const [spotMsg, setSpotMsg] = useState({ type: '', text: '' })
  const [suggestions, setSuggestions] = useState([])
  const geocodeTimer = useRef(null)

  // Reviews
  const [reviews, setReviews] = useState([])
  const [pendingCount, setPendingCount] = useState(0)

  const loadPending = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v1/admin/reviews/pending')
      const data = await res.json()
      if (res.ok) { setReviews(data); setPendingCount(data.length) }
    } catch { /* ignore */ }
  }, [apiFetch])

  useEffect(() => { loadPending() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddressInput = (q) => {
    setAddress(q)
    clearTimeout(geocodeTimer.current)
    if (q.length < 3) { setSuggestions([]); return }
    geocodeTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`, { headers: { 'Accept-Language': 'en' } })
        setSuggestions(await res.json())
      } catch { setSuggestions([]) }
    }, 300)
  }

  const selectAddress = (s) => {
    setAddress(s.display_name); setLat(s.lat); setLng(s.lon); setSuggestions([])
  }

  const addSpot = async () => {
    if (!name || !address || !lat || !lng) { setSpotMsg({ type: 'error', text: 'Fill in name, address, latitude, and longitude.' }); return }
    setSpotMsg({ type: '', text: '' })
    const tagList = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []
    try {
      const res = await apiFetch('/api/v1/spots', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), type, address: address.trim(), latitude: parseFloat(lat), longitude: parseFloat(lng), tags: tagList, status })
      })
      const data = await res.json()
      if (res.ok) {
        setSpotMsg({ type: 'success', text: `✓ "${data.name}" created!` })
        setName(''); setAddress(''); setLat(''); setLng(''); setTags('')
      } else setSpotMsg({ type: 'error', text: data.error || 'Failed.' })
    } catch { setSpotMsg({ type: 'error', text: 'Server error.' }) }
  }

  const reviewAction = async (id, statusVal, reviewType) => {
    try {
      let url = `/api/v1/admin/reviews/${id}/status?status=${statusVal}`
      if (reviewType) url += `&reviewType=${reviewType}`
      const res = await apiFetch(url, { method: 'PATCH' })
      if (res.ok) {
        setReviews(prev => prev.filter(r => r.id !== id))
        setPendingCount(c => c - 1)
      }
    } catch { /* ignore */ }
  }

  return (
    <div className="admin-page animate-fade-up">
      <div className="admin-tabs">
        <button className={`admin-tab ${tab === 'add-spot' ? 'active' : ''}`} onClick={() => setTab('add-spot')}>
          ➕ Add new spot
        </button>
        <button className={`admin-tab ${tab === 'reviews' ? 'active' : ''}`} onClick={() => setTab('reviews')}>
          ✅ Verify reviews {pendingCount > 0 && <span className="pending-badge">{pendingCount}</span>}
        </button>
      </div>

      {tab === 'add-spot' && (
        <div className="admin-form glass">
          <h3 className="admin-form-title">Add a new spot</h3>
          <div className="form-row">
            <div className="field"><label className="label">Name</label><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Spot name" /></div>
            <div className="field"><label className="label">Type</label>
              <select className="input select" value={type} onChange={e => setType(e.target.value)}>
                {['Restaurant','Food Hall','Café','Bar','Market','Other'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="field" style={{ position: 'relative' }}>
            <label className="label">Address</label>
            <input className="input" value={address} onChange={e => handleAddressInput(e.target.value)} placeholder="Full address" autoComplete="off" />
            {suggestions.length > 0 && (
              <div className="suggestions-dropdown">
                {suggestions.map((s, i) => (
                  <div key={i} className="suggestion-item" onClick={() => selectAddress(s)}>
                    <div className="suggestion-name">{s.display_name.split(',')[0]}</div>
                    <div className="suggestion-full">{s.display_name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="form-row">
            <div className="field"><label className="label">Latitude</label><input className="input" value={lat} readOnly style={{ opacity: 0.6 }} placeholder="Auto-filled" /></div>
            <div className="field"><label className="label">Longitude</label><input className="input" value={lng} readOnly style={{ opacity: 0.6 }} placeholder="Auto-filled" /></div>
          </div>
          <div className="field"><label className="label">Tags (comma separated)</label><input className="input" value={tags} onChange={e => setTags(e.target.value)} placeholder="thai, trending, cheap" /></div>
          <div className="field"><label className="label">Status</label>
            <select className="input select" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="PENDING">Pending</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={addSpot}>➕ Create spot</button>
          {spotMsg.text && <div className={`msg msg-${spotMsg.type}`}>{spotMsg.text}</div>}
        </div>
      )}

      {tab === 'reviews' && (
        <div className="admin-reviews">
          {reviews.length === 0 && <p style={{ color: 'var(--success)', fontWeight: 600 }}>✓ All reviews moderated. Nothing pending.</p>}
          {reviews.map(r => (
            <div key={r.id} className="pending-review glass">
              <div className="pending-body">
                <p className="pending-meta">Review #{r.id} · Spot #{r.spotId} · Rating: {r.rating}/5 · {r.reviewType}</p>
                <p className="pending-text">{r.body}</p>
                <p className="pending-author">
                  ✍️ <strong>{r.authorName}</strong> · 📧 {r.authorEmail} · ✅ {r.authorApprovedCount} approved
                </p>
              </div>
              <div className="pending-actions">
                <button className="btn btn-primary" onClick={() => reviewAction(r.id, 'APPROVED', 'EXPERT')}>👨‍🍳 Expert</button>
                <button className="btn btn-primary" onClick={() => reviewAction(r.id, 'APPROVED', 'USER')}>👤 User</button>
                <button className="btn btn-danger" onClick={() => reviewAction(r.id, 'REJECTED')}>✗ Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
