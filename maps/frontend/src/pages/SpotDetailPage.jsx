import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/ToastProvider'
import { formatRating } from '../components/StarRating'
import StatusBadge from '../components/StatusBadge'
import Lightbox from '../components/Lightbox'
import ReportModal from '../components/ReportModal'
import ConfirmDialog from '../components/ConfirmDialog'
import PortalPopover from '../components/PortalPopover'
import '../components/SpotCard.css'
import './SpotDetailPage.css'

export default function SpotDetailPage() {
  const { id } = useParams()
  const { apiFetch } = useApi()
  const { isAdmin, isAuthenticated, userId } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [spot, setSpot] = useState(null)
  const [reviews, setReviews] = useState([])
  const [events, setEvents] = useState([])
  const [trailPaths, setTrailPaths] = useState([])
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
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [reportTarget, setReportTarget] = useState({ type: '', id: null })
  const [confirmDialog, setConfirmDialog] = useState(null)
  const [friendIds, setFriendIds] = useState(new Set())
  const [followedExpertIds, setFollowedExpertIds] = useState(new Set())
  const [showDetailFriendLikes, setShowDetailFriendLikes] = useState(false)
  const [detailFriendLikes, setDetailFriendLikes] = useState([])
  const [loadingDetailFriendLikes, setLoadingDetailFriendLikes] = useState(false)
  const [detailPopoverPos, setDetailPopoverPos] = useState({ top: 0, left: 0 })

  // Admin vibe tag management
  const [vibeTagDefinitions, setVibeTagDefinitions] = useState([])
  const [selectedVibeTagId, setSelectedVibeTagId] = useState('')
  const [reanalyzing, setReanalyzing] = useState(false)

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

  const loadReviews = useCallback(async (vibeTag) => {
    try {
      const params = vibeTag ? `?vibeTag=${encodeURIComponent(vibeTag)}` : ''
      const res = await apiFetch(`/api/v1/spots/${id}/reviews${params}`)
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

  const loadTrailPaths = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/v1/spots/${id}/paths`)
      if (res.ok) setTrailPaths(await res.json())
    } catch { /* ignore */ }
  }, [apiFetch, id])

  useEffect(() => {
    if (!isAuthenticated) return
    apiFetch('/api/v1/friends')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        const ids = new Set()
        if (Array.isArray(data)) {
          data.forEach(f => {
            if (f.id) ids.add(String(f.id))
          })
        }
        setFriendIds(ids)
      })
      .catch(() => {})
    // Also fetch followed expert IDs
    apiFetch('/api/v1/users/me/following-expert-ids')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (Array.isArray(data)) {
          setFollowedExpertIds(new Set(data.map(String)))
        }
      })
      .catch(() => {})
  }, [isAuthenticated, apiFetch])

  useEffect(() => { loadSpot(); loadReviews(); loadEvents(); loadTrailPaths(); }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load vibe tag definitions for admin tag management
  useEffect(() => {
    if (!isAdmin) return
    apiFetch('/api/v1/vibe/definitions')
      .then(res => res.ok ? res.json() : [])
      .then(data => setVibeTagDefinitions(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [isAdmin, apiFetch])

  const reanalyzeVibeTags = async () => {
    setReanalyzing(true)
    try {
      const res = await apiFetch(`/api/v1/vibe/analyze/${id}`, { method: 'POST' })
      if (res.ok) {
        await loadSpot()
        alert('✓ Vibe tags re-analyzed!')
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to re-analyze.')
      }
    } catch { alert('Could not reach server.') }
    finally { setReanalyzing(false) }
  }

  const addVibeTag = async () => {
    if (!selectedVibeTagId) return
    try {
      const res = await apiFetch(`/api/v1/vibe/spot/${id}/tag`, {
        method: 'POST',
        body: JSON.stringify({ vibeTagId: parseInt(selectedVibeTagId), confidence: 1.0 })
      })
      if (res.ok) {
        setSelectedVibeTagId('')
        await loadSpot()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to add tag.')
      }
    } catch { alert('Could not reach server.') }
  }

  const removeVibeTag = async (vibeTagId) => {
    try {
      const res = await apiFetch(`/api/v1/vibe/spot/${id}/tag/${vibeTagId}`, { method: 'DELETE' })
      if (res.ok) {
        await loadSpot()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to remove tag.')
      }
    } catch { alert('Could not reach server.') }
  }

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
          toast.warning(`File ${file.name} exceeds 5MB limit.`);
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
          toast.error(`Failed to upload ${file.name}`);
        }
      }
      setEditPhotos(prev => [...prev, ...newPhotoUrls]);
    } catch (err) {
      toast.error('Error uploading files');
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
    if (!rating || rating === 0) { setReviewMsg({ type: 'error', text: 'Please select a rating.' }); return }
    setReviewMsg({ type: '', text: '' }); setSaving(true)
    try {
      const body = reviewBody.trim() || null
      const res = await apiFetch(`/api/v1/spots/${id}/reviews`, {
        method: 'POST', body: JSON.stringify({ body, rating })
      })
      const data = await res.json()
      if (res.ok) {
        const msg = data.status === 'APPROVED'
          ? '✓ Rating submitted!'
          : '✓ Rating submitted! Pending admin moderation.';
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
    if (!editingRating || editingRating === 0) { setReviewMsg({ type: 'error', text: 'Please select a rating.' }); return }
    setReviewMsg({ type: '', text: '' }); setSaving(true)
    try {
      const res = await apiFetch(`/api/v1/spots/${id}/reviews/${editingReviewId}`, {
        method: 'PUT', body: JSON.stringify({ body: editingBody.trim() || null, rating: editingRating })
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
        toast.success('✓ Spot updated!')
      }
      else { toast.error(data.error || 'Failed.') }
    } catch { toast.error('Server error.') }
    finally { setSaving(false) }
  }

  const deleteSpot = async () => {
    setSaving(true)
    try {
      const res = await apiFetch(`/api/v1/spots/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Spot deleted successfully.')
        navigate('/spots')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to delete spot.')
        setSaving(false)
      }
    } catch {
      toast.error('Could not reach server.')
      setSaving(false)
    }
  }

  const handleReportClick = (type, id) => {
    if (!isAuthenticated) return navigate('/login')
    setReportTarget({ type, id })
    setReportModalOpen(true)
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
              <div>
                <label className="btn btn-secondary" style={{ cursor: uploading ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', margin: 0 }}>
                  {uploading ? 'Uploading...' : 'Upload Photos'}
                  <input type="file" multiple accept="image/*" onChange={handleFileChange} disabled={uploading} style={{ display: 'none' }} />
                </label>
              </div>
              {uploading && <p style={{ fontSize: '0.85rem', color: 'var(--primary)', marginTop: '0.5rem' }}>Uploading...</p>}
            </div>

            <div className="edit-actions">
              <button className="btn btn-primary" onClick={() => { trackEvent('view'); navigate(`/spots?mode=nearby&lat=${spot.latitude}&lng=${spot.longitude}&radiusKm=0.1`) }}> View on map</button>
              <button className="btn btn-ghost" style={{ border: '1px solid var(--border-color)' }} onClick={() => navigate(`/directions/${spot.id}`)}> Directions</button>
              <button className="btn btn-primary" onClick={saveSpot} disabled={saving}>{saving ? 'Saving...' : ' Save changes'}</button>
              <button
                className="btn btn-ghost"
                onClick={() => setConfirmDialog({
                  title: 'Delete spot?',
                  message: 'This action cannot be undone.',
                  confirmLabel: 'Delete spot',
                  onConfirm: deleteSpot
                })}
                disabled={saving}
                style={{ color: 'var(--text-error)' }}
              >
                Delete spot
              </button>
            </div>

            {/* Admin Vibe Tag Management */}
            <div style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', background: 'rgba(255,255,255,0.5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <label className="label" style={{ margin: 0, fontWeight: 600 }}>Vibe Tags (Auto-generated)</label>
                <button className="btn btn-ghost btn-sm" onClick={reanalyzeVibeTags} disabled={reanalyzing} style={{ fontSize: '0.8rem' }}>
                  {reanalyzing ? '⏳ Re-analyzing...' : '🔄 Re-analyze Tags'}
                </button>
              </div>

              {spot.vibeTags?.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.75rem' }}>
                  {spot.vibeTags.map(vt => (
                    <span key={vt.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'white', color: '#1a1a2e', borderRadius: '999px', fontSize: '0.8rem', padding: '0.25rem 0.5rem', fontWeight: 500, border: '1px solid #e5e7eb' }}>
                      {vt.emoji && <span>{vt.emoji}</span>}
                      {vt.name}
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>({vt.source})</span>
                      <button onClick={() => removeVibeTag(vt.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-error)', fontSize: '0.7rem', padding: '0 0.15rem', lineHeight: 1 }} title="Remove tag">✕</button>
                    </span>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>No vibe tags yet.</p>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <select className="input select" value={selectedVibeTagId} onChange={e => setSelectedVibeTagId(e.target.value)} style={{ flex: 1, fontSize: '0.85rem', padding: '0.4rem 0.6rem' }}>
                  <option value="">— Add a tag manually —</option>
                  {vibeTagDefinitions
                    .filter(def => !spot.vibeTags?.some(vt => vt.id === def.id))
                    .map(def => (
                      <option key={def.id} value={def.id}>{def.emoji ? `${def.emoji} ` : ''}{def.name}</option>
                    ))}
                </select>
                <button className="btn btn-primary btn-sm" onClick={addVibeTag} disabled={!selectedVibeTagId} style={{ fontSize: '0.8rem' }}>
                  + Add
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h1 className="detail-name" style={{ margin: 0 }}>{spot.name}</h1>
                <div className="detail-meta">
                  <span>{spot.type}</span>
                  <span>{spot.address}</span>
                  <span>{spot.latitude}, {spot.longitude}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  <StatusBadge status={spot.status} />
                  <span className="detail-rating" title="Trusted — ratings from your friends and experts you follow" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', cursor: 'help' }}>
                    <img src="/icons/la--user-friends.svg" alt="Trusted" style={{ width: '1em', height: '1em' }} />
                    {spot.friendsRating > 0 ? spot.friendsRating.toFixed(1) : '-'}
                  </span>
                  <span className="detail-rating" title="Global — average rating from all users" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', cursor: 'help' }}>
                    <img src="/icons/solar--global-broken.svg" alt="Global" style={{ width: '1em', height: '1em' }} />
                    {spot.globalRating > 0 ? spot.globalRating.toFixed(1) : '-'}
                  </span>
                  <span className="detail-rating" title="Experts — average rating from verified experts" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', cursor: 'help' }}>
                    <img src="/icons/mdi--user-tick-outline.svg" alt="Expert" style={{ width: '1em', height: '1em' }} />
                    {spot.expertRating > 0 ? spot.expertRating.toFixed(1) : '-'}
                  </span>
                  {isAuthenticated && (spot.friendLikeCount > 0 || detailFriendLikes.length > 0) && (
                    <>
                      <span style={{ color: 'var(--text-muted)' }}>·</span>
                      <button
                        className="spot-card-friend-likes-btn"
                        onClick={async (e) => {
                          e.stopPropagation()
                          if (showDetailFriendLikes) {
                            setShowDetailFriendLikes(false)
                            return
                          }
                          const rect = e.currentTarget.getBoundingClientRect()
                          setDetailPopoverPos({
                            top: rect.bottom + 4,
                            left: Math.max(8, Math.min(rect.right - 200, window.innerWidth - 208)),
                          })
                          setLoadingDetailFriendLikes(true)
                          setShowDetailFriendLikes(true)
                          try {
                            const res = await apiFetch(`/api/v1/spots/${spot.id}/friend-likes`, { method: 'GET' })
                            if (res.ok) setDetailFriendLikes(await res.json())
                          } catch { /* ignore */ }
                          finally { setLoadingDetailFriendLikes(false) }
                        }}
                      >
                        Liked by {spot.friendLikeCount || detailFriendLikes.length} {(spot.friendLikeCount || detailFriendLikes.length) === 1 ? 'friend' : 'friends'}
                      </button>
                      {showDetailFriendLikes && (
                        <PortalPopover
                          style={{ top: detailPopoverPos.top, left: detailPopoverPos.left }}
                          onClick={e => e.stopPropagation()}
                        >
                          {loadingDetailFriendLikes ? (
                            <div className="spot-card-friend-likes-loading">Loading...</div>
                          ) : detailFriendLikes.length === 0 ? (
                            <div className="spot-card-friend-likes-loading">No friends yet</div>
                          ) : (
                            <div className="spot-card-friend-likes-list">
                              {detailFriendLikes.map(friend => (
                                <div
                                  key={friend.userId}
                                  className="spot-card-friend-like-item"
                                  onClick={() => navigate(`/user/${friend.userId}`)}
                                >
                                  <div className="spot-card-friend-like-avatar">
                                    {friend.profilePicture ? (
                                      <img src={friend.profilePicture} alt={friend.name} />
                                    ) : (
                                      <span>{friend.name?.charAt(0)?.toUpperCase() || '?'}</span>
                                    )}
                                  </div>
                                  <span className="spot-card-friend-like-name">{friend.name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </PortalPopover>
                      )}
                    </>
                  )}
                </div>
                {spot.websiteUrl && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <a href={spot.websiteUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 'bold', textDecoration: 'none' }}>
                      🔗 Visit Website / Social
                    </a>
                  </div>
                )}
              </div>
            </div>

            {spot.photos?.length > 0 && (
              <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.8rem' }}>Photos</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
                  {spot.photos.map((url, idx) => (
                    <img key={idx} src={url} alt={`Spot photo ${idx + 1}`} style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer' }} onClick={() => { setLightboxIndex(idx); setLightboxOpen(true); }} />
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <button className="btn btn-primary" onClick={() => { trackEvent('view'); navigate(`/spots?mode=nearby&lat=${spot.latitude}&lng=${spot.longitude}&radiusKm=0.1`) }}>
                  View on map
                </button>
                <button className="btn btn-ghost" style={{ border: '1px solid var(--border-color)' }} onClick={() => navigate(`/directions/${spot.id}`)}>
                  Directions
                </button>
              </div>
              <div className="spot-card-actions">
                <button className={`action-btn ${(spot.isLiked || spot.liked) ? 'active' : ''}`} onClick={async () => {
                  if (!isAuthenticated) return navigate('/login')
                  const newLiked = !(spot.isLiked || spot.liked)
                  setSpot({ ...spot, isLiked: newLiked, liked: newLiked })
                  try {
                    await apiFetch(`/api/v1/spots/${spot.id}/like`, { method: 'POST' })
                    const res = await apiFetch(`/api/v1/spots/${spot.id}/friend-likes`, { method: 'GET' })
                    if (res.ok) {
                      const data = await res.json()
                      setDetailFriendLikes(data)
                      setSpot(prev => ({ ...prev, friendLikeCount: data.length }))
                    }
                  }
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
                  }
                  catch { setSpot({ ...spot, isSaved: !newSaved, saved: !newSaved }) }
                }} aria-label="Save spot">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={(spot.isSaved || spot.saved) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path>
                  </svg>
                </button>
                <button className="action-btn report-btn" onClick={() => handleReportClick('SPOT', spot.id)} aria-label="Report spot" title="Report spot" style={{ color: 'var(--text-secondary)' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                    <line x1="4" y1="22" x2="4" y2="15"></line>
                  </svg>
                </button>
              </div>
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
                {(event.imageUrls && event.imageUrls.length > 0) ? <img src={event.imageUrls[0]} alt={event.title} style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', marginBottom: '0.75rem' }} /> : event.imageUrl && <img src={event.imageUrl} alt={event.title} style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', marginBottom: '0.75rem' }} />}
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

      {/* Journeys */}
      {spot.type?.toLowerCase() === 'trail' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 className="section-heading" style={{ margin: 0 }}>Journeys</h2>
            <button className="btn btn-primary btn-sm" onClick={() => navigate(`/spot/${spot.id}/add-journey`)} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              Submit a Journey
            </button>
          </div>
          {trailPaths.length === 0 ? (
            <div className="empty-state" style={{ marginBottom: '2rem' }}>No journeys yet. Submit one!</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              {trailPaths.map(tp => (
                <div key={tp.id} className="glass" style={{ padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', cursor: 'pointer', transition: 'border-color 0.2s' }} onClick={() => navigate(`/journey/${tp.id}`)} onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'} onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <h3 style={{ fontSize: '1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {tp.name}
                      {tp.status && tp.status !== 'ACTIVE' && (
                        <span className={`badge ${tp.status === 'PENDING' ? 'badge-pending' : 'badge-inactive'}`} style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}>
                          {tp.status === 'PENDING' ? 'Pending Approval' : 'Rejected'}
                        </span>
                      )}
                    </h3>
                    <span style={{ display: 'inline-flex', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 600, background: tp.difficulty === 'EASY' ? 'rgba(34,197,94,0.15)' : tp.difficulty === 'MODERATE' ? 'rgba(245,158,11,0.15)' : tp.difficulty === 'HARD' ? 'rgba(249,115,22,0.15)' : 'rgba(239,68,68,0.15)', color: tp.difficulty === 'EASY' ? '#22c55e' : tp.difficulty === 'MODERATE' ? '#f59e0b' : tp.difficulty === 'HARD' ? '#f97316' : '#ef4444' }}>
                      {tp.difficulty ? (tp.difficulty.charAt(0) + tp.difficulty.slice(1).toLowerCase()) : 'Unknown'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {tp.distanceMeters && <span>📏 {tp.distanceMeters >= 1000 ? `${(tp.distanceMeters / 1000).toFixed(1)} km` : `${Math.round(tp.distanceMeters)} m`}</span>}
                    {tp.estimatedDurationMin && <span>⏱ {tp.estimatedDurationMin >= 60 ? `${Math.floor(tp.estimatedDurationMin / 60)}h ${tp.estimatedDurationMin % 60}m` : `${tp.estimatedDurationMin} min`}</span>}
                  </div>
                  {tp.description && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.5rem 0 0', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{tp.description}</p>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                    {tp.submitterName && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>by {tp.submitterName}</div>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: tp.upvoteCount > 0 ? 'var(--primary)' : 'var(--text-muted)' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill={tp.upvoteCount > 0 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                      {tp.upvoteCount || 0}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <h2 className="section-heading"> Reviews</h2>

      <div className="review-form glass">
        <textarea className="textarea" value={reviewBody} onChange={e => setReviewBody(e.target.value)}
          placeholder="Write a review." maxLength={2000} />
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

      <div className="reviews-list">
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '0.75rem 1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
            <button
              className={`btn ${reviewFilter === 'trusted' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setReviewFilter('trusted')}
            >Trusted</button>
            <button
              className={`btn ${reviewFilter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setReviewFilter('all')}
            >Global</button>
            <button
              className={`btn ${reviewFilter === 'expert' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setReviewFilter('expert')}
            >Experts</button>
          </div>
          {spot.vibeTags?.length > 0 && (
            <>
              <div style={{ borderTop: '1px solid var(--border)', margin: '0.75rem 0' }} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
                <span
                  onClick={() => {
                    setActiveVibeFilters([])
                    loadReviews()
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', background: activeVibeFilters.length === 0 ? '#9ca3af' : 'white', color: activeVibeFilters.length === 0 ? 'white' : '#1a1a2e', borderRadius: '999px', fontSize: '0.8rem', padding: '0.25rem 0.7rem', fontWeight: 500, lineHeight: 1.4, cursor: 'pointer', transition: 'all 0.15s', opacity: 0.85, border: '1px solid #e5e7eb' }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '0.85'}
                >All</span>
                {spot.vibeTags.map(vt => {
                  const isActive = activeVibeFilters.includes(vt.name)
                  return (
                <span key={vt.id} onClick={() => {
                  const next = isActive
                    ? activeVibeFilters.filter(n => n !== vt.name)
                    : [...activeVibeFilters, vt.name]
                  setActiveVibeFilters(next)
                  loadReviews(next.length > 0 ? next.join(',') : undefined)
                }} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', background: isActive ? '#9ca3af' : 'white', color: isActive ? 'white' : '#1a1a2e', borderRadius: '999px', fontSize: '0.8rem', padding: '0.25rem 0.7rem', fontWeight: 500, lineHeight: 1.4, cursor: 'pointer', transition: 'all 0.15s', opacity: 0.85, border: '1px solid #e5e7eb' }} onMouseEnter={e => e.currentTarget.style.opacity = '1'} onMouseLeave={e => e.currentTarget.style.opacity = '0.85'}>
                      {vt.emoji && <span>{vt.emoji}</span>}
                      {vt.name}
                    </span>
                  )
                })}
              </div>
            </>
          )}
        </div>
        {(() => {
          let filteredReviews = reviews;

          if (reviewFilter === 'trusted') {
            // Trusted = friends + experts you follow
            const trustedIds = new Set([...friendIds, ...followedExpertIds])
            filteredReviews = filteredReviews.filter(r => trustedIds.has(String(r.authorId)));
          } else if (reviewFilter === 'expert') {
            filteredReviews = filteredReviews.filter(r => r.authorIsExpert);
          }

          if (filteredReviews.length === 0) {
            return <div className="empty-state">No reviews yet.</div>;
          }
          return filteredReviews.map(r => (
            <div key={r.id} className="review-card glass">
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
                  <div className="review-text-row">
                    <p className="review-text">{r.body}</p>
                    <span className="review-rating">{r.rating.toFixed(1)}/5</span>
                  </div>
                  <div className="review-author" style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Link to={`/user/${r.authorId}`} className="author-profile-link" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)', fontWeight: '600', textDecoration: 'none', background: 'var(--bg-glass)', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-sm)', transition: 'background 0.2s' }}>
                      {r.authorProfilePicture ? (
                        <img src={r.authorProfilePicture} alt="Profile" style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: '1.1rem' }}></span>
                      )}
                      {r.authorName || `User #${r.authorId}`}
                    </Link>
                    {r.authorIsAdmin && <span className="badge badge-role" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>Admin</span>}
                    {r.authorIsExpert && <span className="badge badge-active" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>Expert</span>}
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>· {new Date(r.createdAt).toLocaleDateString()}</span>
                    {(String(r.authorId) === String(userId)) && (
                      <span style={{ display: 'inline-flex', gap: '0.25rem', marginLeft: '0.5rem' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => startEditReview(r)} style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', lineHeight: 1.2 }}>Edit</button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setConfirmDialog({
                            title: 'Delete review?',
                            message: 'This cannot be undone.',
                            confirmLabel: 'Delete review',
                            onConfirm: () => deleteReview(r.id)
                          })}
                          disabled={deletingReviewId === r.id}
                          style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', lineHeight: 1.2, color: 'var(--text-error)' }}
                        >
                          {deletingReviewId === r.id ? '...' : 'Delete'}
                        </button>
                      </span>
                    )}
                    {isAuthenticated && (String(r.authorId) !== String(userId)) && (
                      <button className="btn btn-ghost btn-sm" onClick={() => handleReportClick('REVIEW', r.id)} style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', lineHeight: 1.2, color: 'var(--text-secondary)' }}>Report</button>
                    )}
                  </div>
                </>
              )}
            </div>
          ));
        })()}
      </div>

      {lightboxOpen && (
        <Lightbox 
          images={spot.photos} 
          initialIndex={lightboxIndex} 
          onClose={() => setLightboxOpen(false)} 
        />
      )}
      {reportModalOpen && (
        <ReportModal 
          contentType={reportTarget.type} 
          contentId={reportTarget.id} 
          onClose={() => setReportModalOpen(false)}
          onSuccess={() => toast.success('Thank you. The content has been reported for review.')}
        />
      )}
      <ConfirmDialog
        open={!!confirmDialog}
        title={confirmDialog?.title}
        message={confirmDialog?.message}
        confirmLabel={confirmDialog?.confirmLabel}
        onCancel={() => setConfirmDialog(null)}
        onConfirm={async () => {
          const action = confirmDialog?.onConfirm
          setConfirmDialog(null)
          await action?.()
        }}
      />
    </div>
  )
}
