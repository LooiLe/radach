import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import StarRating, { formatRating } from '../components/StarRating'
import StatusBadge from '../components/StatusBadge'
import './SpotDetailPage.css'

export default function SpotDetailPage() {
  const { id } = useParams()
  const { apiFetch } = useApi()
  const { isAdmin, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [spot, setSpot] = useState(null)
  const [reviews, setReviews] = useState([])
  const [reviewBody, setReviewBody] = useState('')
  const [rating, setRating] = useState(0)
  const [reviewMsg, setReviewMsg] = useState({ type: '', text: '' })
  const [saving, setSaving] = useState(false)

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
          }).catch(() => {});
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

  useEffect(() => { loadSpot(); loadReviews() }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
    if (rating === 0) { setReviewMsg({ type: 'error', text: 'Please select a rating.' }); return }
    setReviewMsg({ type: '', text: '' }); setSaving(true)
    try {
      const res = await apiFetch(`/api/v1/spots/${id}/reviews`, {
        method: 'POST', body: JSON.stringify({ body: reviewBody.trim(), rating })
      })
      const data = await res.json()
      if (res.ok) {
        setReviewMsg({ type: 'success', text: '✓ Review submitted! Pending admin moderation.' })
        setReviewBody(''); setRating(0); loadReviews()
      } else { setReviewMsg({ type: 'error', text: data.error || 'Failed.' }) }
    } catch { setReviewMsg({ type: 'error', text: 'Could not reach server.' }) }
    finally { setSaving(false) }
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
                  {['Restaurant','Food Hall','Café','Bar','Market','Other'].map(t => <option key={t} value={t}>{t}</option>)}
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
                      <img src={'http://localhost:8080' + url} alt={`Spot photo ${idx + 1}`} style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '8px' }} />
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
              <button className="btn btn-primary" onClick={() => { trackEvent('view'); navigate(`/spots?lat=${spot.latitude}&lng=${spot.longitude}&radiusKm=1`) }}> View on map</button>
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
            {spot.tags?.length > 0 && (
              <div className="detail-tags">{spot.tags.map(t => <span key={t} className="spot-tag">{t}</span>)}</div>
            )}
            
            {spot.photos?.length > 0 && (
              <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.8rem' }}>Photos</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
                  {spot.photos.map((url, idx) => (
                    <img key={idx} src={'http://localhost:8080' + url} alt={`Spot photo ${idx + 1}`} style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer' }} onClick={() => window.open('http://localhost:8080' + url, '_blank')} />
                  ))}
                </div>
              </div>
            )}

            <button className="btn btn-primary" onClick={() => { trackEvent('view'); navigate(`/spots?lat=${spot.latitude}&lng=${spot.longitude}&radiusKm=1`) }}>
               View on map
            </button>
          </>
        )}
      </div>

      <h2 className="section-heading"> Reviews</h2>

      <div className="review-form glass">
        <textarea className="textarea" value={reviewBody} onChange={e => setReviewBody(e.target.value)}
          placeholder="Write your review..." maxLength={2000} />
        <div className="rating-row">
          <label className="label" style={{ marginBottom: 0 }}>Rating:</label>
          <StarRating value={rating} onChange={setRating} />
          <span className="rating-display">{rating ? `${rating}/5` : 'Select a rating'}</span>
        </div>
        <div className="review-submit-row">
          <button className="btn btn-primary" onClick={submitReview} disabled={saving}>
            {saving ? 'Submitting...' : 'Submit review'}
          </button>
          {reviewMsg.text && <div className={`msg msg-${reviewMsg.type}`}>{reviewMsg.text}</div>}
        </div>
      </div>

      <div className="reviews-list">
        {reviews.length === 0 && <div className="empty-state">No reviews yet. Be the first!</div>}
        {reviews.map(r => (
          <div key={r.id} className="review-card glass">
            <div className="review-card-header">
              <span className={`badge ${r.reviewType === 'EXPERT' ? 'badge-active' : 'badge-pending'}`}>
                {r.reviewType === 'EXPERT' ? '‍ Expert' : ' User'}
              </span>
              <StarRating value={r.rating} readonly size="1rem" />
            </div>
            <p className="review-text">{r.body}</p>
            <div className="review-author" style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Link to={`/user/${r.authorId}`} className="author-profile-link" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)', fontWeight: '600', textDecoration: 'none', background: 'var(--bg-glass)', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-sm)', transition: 'background 0.2s' }}>
                <span style={{ fontSize: '1.1rem' }}></span> {r.authorName || `User #${r.authorId}`}
              </Link>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>· {new Date(r.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
