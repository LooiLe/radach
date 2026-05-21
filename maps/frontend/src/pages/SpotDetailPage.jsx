import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { formatRating } from '../components/StarRating'
import StatusBadge from '../components/StatusBadge'
import './SpotDetailPage.css'

// Vibe tag keyword mapping for filtering reviews
const VIBE_KEYWORDS = {
  'cozy': ['cozy', 'cosy', 'intimate', 'warm atmosphere', 'snug'],
  'romantic': ['romantic', 'date night', 'couples', 'candlelit', 'candle light'],
  'lively': ['lively', 'bustling', 'energetic', 'happening', 'buzzy', 'vibrant'],
  'chill': ['chill', 'laid.?back', 'relaxed', 'mellow', 'low.key', 'chilled'],
  'aesthetic': ['aesthetic', 'beautiful decor', 'beautiful interior', 'stylish', 'gorgeous'],
  'sunset views': ['sunset', 'sunsets', 'sun set', 'panoramic view', 'scenic', 'great view', 'nice view', 'breathtaking'],
  'outdoor seating': ['outdoor', 'outdoor seating', 'terrace', 'patio', 'al fresco', 'alfresco', 'garden seating', 'rooftop'],
  'good for studying': ['study', 'studying', 'get work done', 'work here', 'good wifi', 'good wi-fi', 'quiet enough to work', 'laptop friendly'],
  'good for groups': ['group', 'groups', 'gathering', 'get together', 'party', 'large group', 'big group'],
  'late night spot': ['late night', 'open late', 'opens late', 'after midnight', '2am', '3am', '4am', 'night owl'],
  'breakfast spot': ['breakfast', 'brunch', 'morning', 'early'],
  'budget friendly': ['budget', 'cheap', 'affordable', 'reasonably priced', 'good value', 'inexpensive', 'not expensive', 'under \\$', 'low price'],
  'pricey': ['pricey', 'expensive', 'overpriced', 'costly', 'spendy', 'premium price', 'upscale', 'high end'],
  'digital nomad friendly': ['digital nomad', 'remote work', 'good wifi', 'good wi-fi', 'power outlet', 'work from', 'coworking', 'co-working'],
  'touristy': ['tourist', 'touristy', 'tourist trap', 'overrun', 'crowded with tourists', 'tourist spot'],
  'local favorite': ['local', 'locals', 'hidden gem', 'authentic', 'off the beaten path', 'underrated'],
  'family friendly': ['family', 'kids', 'children', 'child friendly', 'kid friendly', 'baby', 'stroller'],
  'pet friendly': ['pet', 'dog', 'dog friendly', 'dogs welcome', 'pets', 'furry'],
  'hidden gem': ['hidden gem', 'off the beaten path', 'undiscovered', 'secret spot', 'tucked away'],
  'trendy': ['trendy', 'hip', 'cool', 'fashionable', 'insta.*famous', 'hottest'],
  'quiet': ['quiet', 'peaceful', 'serene', 'tranquil', 'noiseless', 'silent', 'calm'],
  'spacious': ['spacious', 'roomy', 'big', 'large', 'plenty of space', 'open space', 'airy'],
  'fast service': ['fast service', 'quick', 'speedy', 'efficient', 'prompt', 'no wait', 'on point service'],
  'instagrammable': ['instagram', 'insta', 'photo', 'picturesque', 'beautiful', 'pretty', 'snap', 'pics', 'instagramable'],

  // New tags
  'brunch': ['brunch', 'breakfast', 'morning', 'eggs benedict', 'pancakes', 'avocado toast', 'waffles'],
  'burgers': ['burger', 'burgers', 'patty', 'fries', 'cheeseburger', 'bun'],
  'pasta': ['pasta', 'spaghetti', 'carbonara', 'bolognese', 'noodles', 'fettuccine', 'penne'],
  'coffee': ['coffee', 'latte', 'cappuccino', 'espresso', 'flat white', 'cold brew', 'mocha', 'brew'],
  'matcha': ['matcha', 'green tea', 'matcha latte'],
  'thai food': ['thai', 'pad thai', 'green curry', 'tom yum', 'massaman', 'som tum', 'thai food', 'spicy'],
  'sushi': ['sushi', 'sashimi', 'maki', 'nigiri', 'roll', 'japanese'],
  'pizza': ['pizza', 'margherita', 'pepperoni', 'neapolitan', 'wood.fire', 'thin crust'],
  'seafood': ['seafood', 'fish', 'shrimp', 'oyster', 'crab', 'lobster', 'fresh fish'],
  'desserts': ['dessert', 'cake', 'pastry', 'pie', 'ice cream', 'sweet', 'chocolate cake', 'tiramisu'],
  'vegan friendly': ['vegan', 'plant.based', 'vegetarian', 'veggie', 'tofu', 'dairy.free'],
  'beautiful view': ['beautiful view', 'great view', 'nice view', 'scenic', 'panoramic', 'stunning view', 'amazing view', 'breathtaking view', 'city view', 'ocean view', 'river view'],
  'live music': ['live music', 'live band', 'dj', 'acoustic', 'concert', 'musician', 'jazz', 'performance']
};

export default function SpotDetailPage() {
  const { id } = useParams()
  const { apiFetch } = useApi()
  const { isAdmin, isAuthenticated, userId } = useAuth()
  const navigate = useNavigate()
  const [spot, setSpot] = useState(null)
  const [reviews, setReviews] = useState([])
  const [events, setEvents] = useState([])
  const [reviewBody, setReviewBody] = useState('')
  const [rating, setRating] = useState(0)
  const [saving, setSaving] = useState(false)
  const [reviewMsg, setReviewMsg] = useState({ type: '', text: '' })
  const [reviewFilter, setReviewFilter] = useState('all') // 'all', 'expert', 'user'
  const [editingReviewId, setEditingReviewId] = useState(null)
  const [editingBody, setEditingBody] = useState('')
  const [editingRating, setEditingRating] = useState(0)
  const [deletingReviewId, setDeletingReviewId] = useState(null)
  const [activeVibeFilters, setActiveVibeFilters] = useState([])

  // Admin edit fields
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editLat, setEditLat] = useState('')
  const [editLng, setEditLng] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editStatus, setEditStatus] = useState('ACTIVE')
  const [editWebsiteUrl, setEditWebsiteUrl] = useState('')
  const [editPhotos, setEditPhotos] = useState([])
  const [uploading, setUploading] = useState(false)
  const newlyUploaded = useRef([])

  useEffect(() => {
    return () => {
      // Cleanup newly uploaded photos if component unmounts before saving
      if (newlyUploaded.current.length > 0) {
        newlyUploaded.current.forEach(url => {
          fetch(`/api/v1/upload?url=${encodeURIComponent(url)}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          }).catch(() => { });
        });
      }
    };
  }, []);

  const loadSpot = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/v1/spots/${id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSpot(data)
      setEditName(data.name); setEditType(data.type); setEditAddress(data.address)
      setEditLat(data.latitude); setEditLng(data.longitude)
      setEditTags((data.tags || []).join(', ')); setEditStatus(data.status)
      setEditWebsiteUrl(data.websiteUrl || '')
      setEditPhotos(data.photos || [])
    } catch { setSpot(null) }
  }, [apiFetch, id])

  const loadReviews = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/v1/spots/${id}/reviews`)
      const data = await res.json()
      if (res.ok) {
        const list = Array.isArray(data.content) ? data.content : Array.isArray(data) ? data : []
        setReviews(list)
      }
    } catch { /* ignore */ }
  }, [apiFetch, id])

  const loadEvents = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/v1/events/spot/${id}`)
      if (res.ok) setEvents(await res.json())
    } catch { /* ignore */ }
  }, [apiFetch, id])

  useEffect(() => { loadSpot(); loadReviews(); loadEvents(); }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const trackEvent = async (type) => {
    try { await apiFetch(`/api/v1/spots/${id}/${type}`, { method: 'POST' }) } catch { /* ok */ }
  }

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    try {
      const newPhotoUrls = [];
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
          alert(`File ${file.name} exceeds 5MB limit.`);
          continue;
        }
        const formData = new FormData();
        formData.append('file', file);
        const res = await apiFetch('/api/v1/upload', { method: 'POST', body: formData });
        if (res.ok) {
          const data = await res.json();
          newPhotoUrls.push(data.url);
          newlyUploaded.current.push(data.url);
        } else {
          alert(`Failed to upload ${file.name}`);
        }
      }
      setEditPhotos(prev => [...prev, ...newPhotoUrls]);
    } catch (err) {
      alert('Error uploading files');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removePhoto = (index) => {
    // We only remove from state here. Physical file deletion is handled by SpotService.update
    // or we could eagerly delete if we tracked which ones were newly uploaded.
    // For simplicity, just remove from state and let the backend clean up old photos.
    setEditPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const submitReview = async () => {
    if (!reviewBody.trim()) { setReviewMsg({ type: 'error', text: 'Please write a review.' }); return }
    if (!rating || rating === 0) { setReviewMsg({ type: 'error', text: 'Please select a rating.' }); return }
    setReviewMsg({ type: '', text: '' }); setSaving(true)
    try {
      const res = await apiFetch(`/api/v1/spots/${id}/reviews`, {
        method: 'POST', body: JSON.stringify({ body: reviewBody.trim(), rating })
      })
      const data = await res.json()
      if (res.ok) {
        const msg = data.status === 'APPROVED'
          ? '✓ Review submitted and published! (Expert reviewer)'
          : '✓ Review submitted! Pending admin moderation.';
        setReviewMsg({ type: 'success', text: msg })
        setReviewBody(''); setRating(0); loadReviews(); loadSpot()
      } else { setReviewMsg({ type: 'error', text: data.error || 'Failed.' }) }
    } catch { setReviewMsg({ type: 'error', text: 'Could not reach server.' }) }
    finally { setSaving(false) }
  }

  const startEditReview = (r) => {
    setEditingReviewId(r.id)
    setEditingBody(r.body)
    setEditingRating(r.rating)
  }

  const cancelEditReview = () => {
    setEditingReviewId(null)
    setEditingBody('')
    setEditingRating(0)
  }

  const saveEditReview = async () => {
    if (!editingBody.trim()) { setReviewMsg({ type: 'error', text: 'Please write a review.' }); return }
    if (!editingRating || editingRating === 0) { setReviewMsg({ type: 'error', text: 'Please select a rating.' }); return }
    setReviewMsg({ type: '', text: '' }); setSaving(true)
    try {
      const res = await apiFetch(`/api/v1/spots/${id}/reviews/${editingReviewId}`, {
        method: 'PUT', body: JSON.stringify({ body: editingBody.trim(), rating: editingRating })
      })
      if (res.ok) {
        setReviewMsg({ type: 'success', text: '✓ Review updated!' })
        cancelEditReview()
        loadReviews(); loadSpot()
      } else {
        const data = await res.json()
        setReviewMsg({ type: 'error', text: data.error || 'Failed to update.' })
      }
    } catch { setReviewMsg({ type: 'error', text: 'Could not reach server.' }) }
    finally { setSaving(false) }
  }

  const deleteReview = async (reviewId) => {
    if (!window.confirm('Delete this review? This cannot be undone.')) return
    setDeletingReviewId(reviewId)
    try {
      const res = await apiFetch(`/api/v1/spots/${id}/reviews/${reviewId}`, { method: 'DELETE' })
      if (res.ok) {
        setReviewMsg({ type: 'success', text: '✓ Review deleted.' })
        loadReviews(); loadSpot()
      } else {
        const data = await res.json()
        setReviewMsg({ type: 'error', text: data.error || 'Failed to delete.' })
      }
    } catch { setReviewMsg({ type: 'error', text: 'Could not reach server.' }) }
    finally { setDeletingReviewId(null) }
  }

  const saveSpot = async () => {
    setSaving(true)
    const tags = editTags ? editTags.split(',').map(t => t.trim()).filter(Boolean) : []
    try {
      const res = await apiFetch(`/api/v1/spots/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editName.trim(), type: editType, address: editAddress.trim(),
          latitude: parseFloat(editLat), longitude: parseFloat(editLng), tags, status: editStatus,
          websiteUrl: editWebsiteUrl.trim(), photos: editPhotos
        })
      })
      const data = await res.json()
      if (res.ok) {
        setSpot(data);
        newlyUploaded.current = []; // Clear tracking so they aren't deleted on unmount
        alert('✓ Spot updated!')
      }
      else { alert(data.error || 'Failed.') }
    } catch { alert('Server error.') }
    finally { setSaving(false) }
  }

  const deleteSpot = async () => {
    if (!window.confirm('Are you sure you want to delete this spot? This action cannot be undone.')) return
    setSaving(true)
    try {
      const res = await apiFetch(`/api/v1/spots/${id}`, { method: 'DELETE' })
      if (res.ok) {
        alert('Spot deleted successfully.')
        navigate('/spots')
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to delete spot.')
        setSaving(false)
      }
    } catch {
      alert('Could not reach server.')
      setSaving(false)
    }
  }

  if (!spot) return <div className="detail-page"><div className="empty-state">Loading spot...</div></div>

  return (
    <div className="detail-page animate-fade-up">
      <button className="btn btn-ghost back-btn" onClick={() => navigate(-1)}>← Back</button>

      <div className="detail-header glass">
        {isAdmin ? (
          <div className="edit-fields">
            <div className="edit-row">
              <div className="field"><label className="label">Name</label><input className="input" value={editName} onChange={e => setEditName(e.target.value)} /></div>
              <div className="field"><label className="label">Type</label>
                <select className="input select" value={editType} onChange={e => setEditType(e.target.value)}>
                  {['Restaurant', 'Food Hall', 'Café', 'Bar', 'Market', 'Other'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="field"><label className="label">Address</label><input className="input" value={editAddress} onChange={e => setEditAddress(e.target.value)} /></div>
            <div className="edit-row">
              <div className="field"><label className="label">Latitude</label><input className="input" value={editLat} readOnly style={{ opacity: 0.6 }} /></div>
              <div className="field"><label className="label">Longitude</label><input className="input" value={editLng} readOnly style={{ opacity: 0.6 }} /></div>
            </div>
            <div className="edit-row">
              <div className="field"><label className="label">Tags (comma separated)</label><input className="input" value={editTags} onChange={e => setEditTags(e.target.value)} /></div>
              <div className="field"><label className="label">Website / Social Link</label><input className="input" value={editWebsiteUrl} onChange={e => setEditWebsiteUrl(e.target.value)} /></div>
            </div>
            <div className="field"><label className="label">Status</label>
              <select className="input select" value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                <option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option><option value="PENDING">Pending</option>
              </select>
            </div>

            <div className="field" style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
              <label className="label">Photos</label>

              {editPhotos.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px', marginBottom: '1rem' }}>
                  {editPhotos.map((url, idx) => (
                    <div key={idx} style={{ position: 'relative' }}>
                      <img src={url} alt={`Spot photo ${idx + 1}`} style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px' }} />
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        style={{ position: 'absolute', top: 5, right: 5, background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}
                      >✕</button>
                    </div>
                  ))}
                </div>
              )}

              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                disabled={uploading}
                className="input"
                style={{ padding: '0.4rem' }}
              />
              {uploading && <p style={{ fontSize: '0.85rem', color: 'var(--primary)', marginTop: '0.5rem' }}>Uploading...</p>}
            </div>

            <div className="edit-actions">
              <button className="btn btn-primary" onClick={() => { trackEvent('view'); navigate(`/spots?mode=nearby&lat=${spot.latitude}&lng=${spot.longitude}&radiusKm=0.1`) }}> View on map</button>
              <button className="btn btn-ghost" style={{ border: '1px solid var(--border-color)' }} onClick={() => navigate(`/directions/${spot.id}`)}> Directions</button>
              <button className="btn btn-primary" onClick={saveSpot} disabled={saving}>{saving ? 'Saving...' : ' Save changes'}</button>
              <button className="btn btn-ghost" onClick={deleteSpot} disabled={saving} style={{ color: 'var(--text-error)' }}> Delete spot</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h1 className="detail-name">{spot.name}</h1>
                <div className="detail-meta">
                  <span>{spot.type}</span>
                  <span>{spot.address}</span>
                  <span>{spot.latitude}, {spot.longitude}</span>
                  <StatusBadge status={spot.status} />
                  <span className="detail-rating">{formatRating(spot.averageRating)}</span>
                </div>
                {spot.websiteUrl && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <a href={spot.websiteUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 'bold', textDecoration: 'none' }}>
                      🔗 Visit Website / Social
                    </a>
                  </div>
                )}
              </div>
              <div className="spot-card-actions" style={{ marginLeft: '1rem' }}>
                <button className={`action-btn ${(spot.isLiked || spot.liked) ? 'active' : ''}`} onClick={async () => {
                  if (!isAuthenticated) return navigate('/login')
                  const newLiked = !(spot.isLiked || spot.liked)
                  setSpot({ ...spot, isLiked: newLiked, liked: newLiked })
                  try { await apiFetch(`/api/v1/spots/${spot.id}/like`, { method: 'POST' }) }
                  catch { setSpot({ ...spot, isLiked: !newLiked, liked: !newLiked }) }
                }} aria-label="Like spot">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={(spot.isLiked || spot.liked) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                  </svg>
                </button>
                <button className={`action-btn ${(spot.isSaved || spot.saved) ? 'active' : ''}`} onClick={async () => {
                  if (!isAuthenticated) return navigate('/login')
                  const newSaved = !(spot.isSaved || spot.saved)
                  setSpot({ ...spot, isSaved: newSaved, saved: newSaved })
                  try {
                    const res = await apiFetch(`/api/v1/spots/${spot.id}/save`, { method: 'POST' })
                    const data = await res.json()
                    console.log('SAVE RESPONSE:', data)
                  }
                  catch { setSpot({ ...spot, isSaved: !newSaved, saved: !newSaved }) }
                }} aria-label="Save spot">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={(spot.isSaved || spot.saved) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path>
                  </svg>
                </button>
              </div>
            </div>

            {spot.photos?.length > 0 && (
              <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.8rem' }}>Photos</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
                  {spot.photos.map((url, idx) => (
                    <img key={idx} src={url} alt={`Spot photo ${idx + 1}`} style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer' }} onClick={() => window.open(url, '_blank')} />
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={() => { trackEvent('view'); navigate(`/spots?mode=nearby&lat=${spot.latitude}&lng=${spot.longitude}&radiusKm=0.1`) }}>
                View on map
              </button>
              <button className="btn btn-ghost" style={{ border: '1px solid var(--border-color)' }} onClick={() => navigate(`/directions/${spot.id}`)}>
                Directions
              </button>
            </div>
          </>
        )}
      </div>

      {events.length > 0 && (
        <>
          <h2 className="section-heading"> Upcoming Events</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            {events.map(event => (
              <div key={event.id} className="glass" style={{ padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                {event.imageUrl && <img src={event.imageUrl} alt={event.title} style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', marginBottom: '0.75rem' }} />}
                <h3 style={{ fontSize: '1.05rem', margin: '0 0 0.5rem 0' }}>{event.title}</h3>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  📅 {new Date(event.startTime).toLocaleDateString()}
                </div>
                {event.description && <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{event.description}</p>}
                <Link to="/events" className="btn btn-ghost btn-sm" style={{ marginTop: '0.5rem', padding: '0.4rem 0' }}>View in Events Tab</Link>
              </div>
            ))}
          </div>
        </>
      )}

      <h2 className="section-heading"> Reviews</h2>

      <div className="review-form glass">
        <textarea className="textarea" value={reviewBody} onChange={e => setReviewBody(e.target.value)}
          placeholder="Write your review..." maxLength={2000} />
        <div className="rating-row">
          <label className="label" style={{ marginBottom: 0 }}>Rating:</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="range"
              min="1"
              max="5"
              step="0.1"
              value={rating || 1}
              onChange={(e) => setRating(parseFloat(e.target.value))}
              style={{ width: '200px', color: 'var(--primary)' }}
            />
            <span className="rating-display">
              {rating >= 1 ? `${rating.toFixed(1)}/5` : 'Select a rating'}
            </span>
          </div>
        </div>
        <div className="review-submit-row">
          <button className="btn btn-primary" onClick={submitReview} disabled={saving}>
            {saving ? 'Submitting...' : 'Submit review'}
          </button>
          {reviewMsg.text && <div className={`msg msg-${reviewMsg.type}`}>{reviewMsg.text}</div>}
        </div>
      </div>

      {spot.vibeTags?.length > 0 && (
        <div className="glass" style={{ padding: '0.7rem 1rem', marginBottom: '1.5rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {spot.vibeTags.map(vt => {
              const isActive = activeVibeFilters.includes(vt.name);
              return (
                <span key={vt.id} onClick={() => {
                  setActiveVibeFilters(prev =>
                    isActive ? prev.filter(name => name !== vt.name) : [...prev, vt.name]
                  );
                }} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', background: isActive ? '#9ca3af' : 'white', color: isActive ? 'white' : '#1a1a2e', borderRadius: '999px', fontSize: '0.8rem', padding: '0.25rem 0.7rem', fontWeight: 500, lineHeight: 1.4, cursor: 'pointer', transition: 'all 0.15s', opacity: 0.85, border: '1px solid #e5e7eb' }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.85'}>
                  {vt.emoji && <span>{vt.emoji}</span>}
                  {vt.name}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="reviews-list">
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button
            className={`btn ${reviewFilter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setReviewFilter('all')}
          >All Reviews</button>
          <button
            className={`btn ${reviewFilter === 'expert' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setReviewFilter('expert')}
          >Experts</button>
          <button
            className={`btn ${reviewFilter === 'user' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setReviewFilter('user')}
          >Users</button>
        </div>
        {(() => {
          let filteredReviews = reviews;

          if (reviewFilter === 'expert') {
            filteredReviews = filteredReviews.filter(r => r.authorIsExpert);
          } else if (reviewFilter === 'user') {
            filteredReviews = filteredReviews.filter(r => !r.authorIsExpert);
          }

          if (activeVibeFilters.length > 0) {
            filteredReviews = filteredReviews.filter(r => {
              const lower = r.body?.toLowerCase() || '';
              // Check if review matches ANY of the selected tags
              return activeVibeFilters.some(filterName => {
                const keywords = VIBE_KEYWORDS[filterName] || [filterName];
                return keywords.some(kw => lower.includes(kw.toLowerCase()));
              });
            });
          }
          if (filteredReviews.length === 0) {
            return <div className="empty-state">{activeVibeFilters.length > 0 ? `No reviews match the selected tags.` : 'No reviews yet. Be the first!'}</div>;
          }
          return filteredReviews.map(r => (
            <div key={r.id} className="review-card glass">
              <div className="review-card-header">
                <span className={`badge ${r.authorIsExpert ? 'badge-active' : 'badge-pending'}`}>
                  {r.authorIsExpert ? 'Expert' : 'User'}
                </span>
                <span className="review-rating">{r.rating.toFixed(1)}/5</span>
              </div>
              {editingReviewId === r.id ? (
                <div className="review-form glass" style={{ marginTop: '0.5rem', marginBottom: '0.5rem', padding: '0.75rem' }}>
                  <textarea className="textarea" value={editingBody} onChange={e => setEditingBody(e.target.value)}
                    placeholder="Edit your review..." maxLength={2000} />
                  <div className="rating-row" style={{ marginTop: '0.5rem' }}>
                    <label className="label" style={{ marginBottom: 0 }}>Rating:</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input type="range" min="1" max="5" step="0.1" value={editingRating || 1}
                        onChange={(e) => setEditingRating(parseFloat(e.target.value))} style={{ width: '150px' }} />
                      <span className="rating-display">{editingRating >= 1 ? `${editingRating.toFixed(1)}/5` : 'Select a rating'}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button className="btn btn-primary btn-sm" onClick={saveEditReview} disabled={saving}>
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={cancelEditReview}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="review-text">{r.body}</p>
                  <div className="review-author" style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Link to={`/user/${r.authorId}`} className="author-profile-link" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)', fontWeight: '600', textDecoration: 'none', background: 'var(--bg-glass)', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-sm)', transition: 'background 0.2s' }}>
                      <span style={{ fontSize: '1.1rem' }}></span> {r.authorName || `User #${r.authorId}`}
                    </Link>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>· {new Date(r.createdAt).toLocaleDateString()}</span>
                    {(String(r.authorId) === String(userId)) && (
                      <span style={{ display: 'inline-flex', gap: '0.25rem', marginLeft: '0.5rem' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => startEditReview(r)} style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', lineHeight: 1.2 }}>Edit</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => deleteReview(r.id)} disabled={deletingReviewId === r.id} style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', lineHeight: 1.2, color: 'var(--text-error)' }}>{deletingReviewId === r.id ? '...' : 'Delete'}</button>
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          ));
        })()}
      </div>
    </div>
  )
}
