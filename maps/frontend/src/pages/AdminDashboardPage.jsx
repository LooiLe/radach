import { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../components/ToastProvider'
import './AdminDashboardPage.css'

export default function AdminDashboardPage() {
  const { apiFetch } = useApi()
  const { isSuperAdmin } = useAuth()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const adminTabs = ['reviews', 'spots', 'events', 'paths', 'reports', 'experts', 'annotations', 'categories', 'users']
  const initialTab = adminTabs.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'reviews'
  const [tab, setTab] = useState(initialTab)
  const [confirmDialog, setConfirmDialog] = useState(null)

  // === SPOTS TAB ===
  const [pendingSpots, setPendingSpots] = useState([])
  const [pendingSpotsCount, setPendingSpotsCount] = useState(0)

  const loadPendingSpots = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v1/admin/spots/pending')
      const data = await res.json()
      if (res.ok) { setPendingSpots(data); setPendingSpotsCount(data.length) }
    } catch { /* ignore */ }
  }, [apiFetch])

  const spotAction = async (id, action) => {
    try {
      let res;
      if (action === 'APPROVE') {
        res = await apiFetch(`/api/v1/admin/spots/${id}/status?status=ACTIVE`, { method: 'PATCH' })
      } else if (action === 'REJECT') {
        res = await apiFetch(`/api/v1/admin/spots/${id}`, { method: 'DELETE' })
      }
      if (res && res.ok) {
        setPendingSpots(prev => prev.filter(s => s.id !== id))
        setPendingSpotsCount(c => c - 1)
      }
    } catch { /* ignore */ }
  }

  // === EVENTS TAB ===
  const [pendingEvents, setPendingEvents] = useState([])
  const [pendingEventsCount, setPendingEventsCount] = useState(0)

  const loadPendingEvents = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v1/admin/events/pending')
      const data = await res.json()
      if (res.ok) { setPendingEvents(data); setPendingEventsCount(data.length) }
    } catch { /* ignore */ }
  }, [apiFetch])

  const eventAction = async (id, action) => {
    try {
      let res;
      if (action === 'APPROVE') {
        res = await apiFetch(`/api/v1/admin/events/${id}/status?status=ACTIVE`, { method: 'PATCH' })
      } else if (action === 'REJECT') {
        res = await apiFetch(`/api/v1/admin/events/${id}`, { method: 'DELETE' })
      }
      if (res && res.ok) {
        setPendingEvents(prev => prev.filter(e => e.id !== id))
        setPendingEventsCount(c => c - 1)
      }
    } catch { /* ignore */ }
  }

  // === TRAIL PATHS TAB ===
  const [pendingPaths, setPendingPaths] = useState([])
  const [pendingPathsCount, setPendingPathsCount] = useState(0)

  const loadPendingPaths = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v1/admin/paths/pending')
      const data = await res.json()
      if (res.ok) { setPendingPaths(data); setPendingPathsCount(data.length) }
    } catch { /* ignore */ }
  }, [apiFetch])

  const pathAction = async (id, action) => {
    try {
      let res;
      if (action === 'APPROVE') {
        res = await apiFetch(`/api/v1/admin/paths/${id}/status?status=ACTIVE`, { method: 'PATCH' })
      } else if (action === 'REJECT') {
        res = await apiFetch(`/api/v1/admin/paths/${id}`, { method: 'DELETE' })
      }
      if (res && res.ok) {
        setPendingPaths(prev => prev.filter(p => p.id !== id))
        setPendingPathsCount(c => c - 1)
      }
    } catch { /* ignore */ }
  }

  // === REVIEWS TAB ===
  const [reviews, setReviews] = useState([])
  const [pendingCount, setPendingCount] = useState(0)

  const loadPendingReviews = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v1/admin/reviews/pending')
      const data = await res.json()
      if (res.ok) { setReviews(data); setPendingCount(data.length) }
    } catch { /* ignore */ }
  }, [apiFetch])

  const reviewAction = async (id, statusVal) => {
    try {
      const url = `/api/v1/admin/reviews/${id}/status?status=${statusVal}`
      const res = await apiFetch(url, { method: 'PATCH' })
      if (res.ok) {
        setReviews(prev => prev.filter(r => r.id !== id))
        setPendingCount(c => c - 1)
      } else {
        const errorText = await res.text()
        console.error(`Failed to ${statusVal} review ${id}:`, res.status, errorText)
        if (res.status === 404) {
          toast.error(`Review ${id} not found. It may have been deleted.`)
        } else if (res.status === 403) {
          toast.warning('Permission denied. Please ensure you are logged in as an admin.')
        } else {
          toast.error(`Failed to ${statusVal} review: ${res.status}`)
        }
      }
    } catch (err) {
      console.error(`Error ${statusVal} review ${id}:`, err)
      toast.error(`Error: ${err.message}`)
    }
  }

  // === EXPERT APPLICATIONS TAB ===
  const [expertApps, setExpertApps] = useState([])
  const [expertAppsCount, setExpertAppsCount] = useState(0)

  const loadExpertApps = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v1/admin/expert-applications/pending')
      const data = await res.json()
      if (res.ok) { setExpertApps(data); setExpertAppsCount(data.length) }
    } catch { /* ignore */ }
  }, [apiFetch])

  const expertAppAction = async (id, action) => {
    try {
      const res = await apiFetch(`/api/v1/admin/expert-applications/${id}/${action}`, { method: 'PATCH' })
      if (res.ok) {
        setExpertApps(prev => prev.filter(a => a.id !== id))
        setExpertAppsCount(c => c - 1)
      }
    } catch { /* ignore */ }
  }

  // === AR ANNOTATIONS TAB ===
  const [annotations, setAnnotations] = useState([])
  const [pendingAnnotationsCount, setPendingAnnotationsCount] = useState(0)
  const [annotationStatus, setAnnotationStatus] = useState('PENDING')
  const [editingAnnotation, setEditingAnnotation] = useState(null)

  const loadPendingAnnotationsCountOnly = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v1/ar/annotations/pending')
      const data = await res.json()
      if (res.ok) { setPendingAnnotationsCount(data.length) }
    } catch { /* ignore */ }
  }, [apiFetch])

  const loadAnnotations = useCallback(async (statusVal = annotationStatus) => {
    try {
      const url = `/api/v1/admin/annotations?status=${statusVal}`
      const res = await apiFetch(url)
      const data = await res.json()
      if (res.ok) {
        setAnnotations(data)
        if (statusVal === 'PENDING') {
          setPendingAnnotationsCount(data.length)
        }
      }
    } catch { /* ignore */ }
  }, [apiFetch, annotationStatus])

  const annotationAction = async (id, action) => {
    try {
      const res = await apiFetch(`/api/v1/ar/annotations/${id}/review?action=${action}`, { method: 'PATCH' })
      if (res.ok) {
        setAnnotations(prev => prev.filter(a => a.id !== id))
        loadAnnotations(annotationStatus)
        loadPendingAnnotationsCountOnly()
      }
    } catch { /* ignore */ }
  }

  const handleUpdateAnnotation = async () => {
    if (!editingAnnotation) return
    try {
      const res = await apiFetch(`/api/v1/admin/annotations/${editingAnnotation.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: editingAnnotation.title,
          description: editingAnnotation.description,
          latitude: parseFloat(editingAnnotation.latitude),
          longitude: parseFloat(editingAnnotation.longitude),
          bearing: editingAnnotation.bearing !== null && editingAnnotation.bearing !== '' ? parseFloat(editingAnnotation.bearing) : null,
          photoUrl: editingAnnotation.photoUrl,
          radiusMeters: editingAnnotation.radiusMeters !== null && editingAnnotation.radiusMeters !== '' ? parseFloat(editingAnnotation.radiusMeters) : null
        })
      })
      if (res.ok) {
        toast.success('Annotation updated successfully!')
        setEditingAnnotation(null)
        loadAnnotations(annotationStatus)
        loadPendingAnnotationsCountOnly()
      } else {
        toast.error('Failed to update annotation.')
      }
    } catch (err) {
      toast.error('Error updating annotation.')
    }
  }

  const handleDeleteAnnotation = async (id) => {
    try {
      const res = await apiFetch(`/api/v1/admin/annotations/${id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        toast.success('Annotation deleted successfully!')
        setAnnotations(prev => prev.filter(a => a.id !== id))
        loadPendingAnnotationsCountOnly()
      } else {
        toast.error('Failed to delete annotation.')
      }
    } catch {
      toast.error('Error deleting annotation.')
    }
  }

  // === REPORTS TAB ===
  const [reports, setReports] = useState([])
  const [reportsCount, setReportsCount] = useState(0)

  const loadPendingReports = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v1/reports/admin')
      const data = await res.json()
      if (res.ok) { setReports(data); setReportsCount(data.length) }
    } catch { /* ignore */ }
  }, [apiFetch])

  const reportAction = async (id, statusVal) => {
    try {
      const res = await apiFetch(`/api/v1/reports/admin/${id}/status?status=${statusVal}`, { method: 'PATCH' })
      if (res.ok) {
        setReports(prev => prev.filter(r => r.id !== id))
        setReportsCount(c => c - 1)
        if (statusVal === 'RESOLVED') {
          loadPendingReviews()
          loadPendingSpots()
          loadPendingEvents()
          loadPendingPaths()
        }
      } else {
        toast.error('Failed to update report status.')
      }
    } catch (err) {
      console.error('Error updating report:', err)
      toast.error('Error updating report.')
    }
  }

  // === CATEGORIES TAB ===
  const [categories, setCategories] = useState([])
  const [newCatName, setNewCatName] = useState('')
  const [newCatIconUrl, setNewCatIconUrl] = useState('')
  const [uploadingIcon, setUploadingIcon] = useState(false)
  const [catMsg, setCatMsg] = useState({ type: '', text: '' })

  const loadCategories = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v1/categories')
      const data = await res.json()
      if (res.ok) {
        const sorted = data.sort((a, b) => {
          if (a.name.toLowerCase() === 'other') return 1;
          if (b.name.toLowerCase() === 'other') return -1;
          return a.name.localeCompare(b.name);
        });
        setCategories(sorted);
      }
    } catch { /* ignore */ }
  }, [apiFetch])

  const handleCatIconUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadingIcon(true)
    setCatMsg({ type: '', text: '' })
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await apiFetch('/api/v1/upload', { method: 'POST', body: formData })
      if (res.ok) {
        const data = await res.json()
        setNewCatIconUrl(data.url)
        setCatMsg({ type: 'success', text: 'Icon uploaded successfully!' })
      } else {
        setCatMsg({ type: 'error', text: 'Failed to upload icon' })
      }
    } catch {
      setCatMsg({ type: 'error', text: 'Error uploading icon' })
    } finally {
      setUploadingIcon(false)
      e.target.value = ''
    }
  }

  const updateExistingCatIcon = async (id, e) => {
    const file = e.target.files[0]
    if (!file) return
    setCatMsg({ type: '', text: '' })
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await apiFetch('/api/v1/upload', { method: 'POST', body: formData })
      if (res.ok) {
        const data = await res.json()
        await apiFetch(`/api/v1/admin/categories/${id}/icon`, {
          method: 'PUT',
          body: JSON.stringify({ iconUrl: data.url })
        })
        loadCategories()
        setCatMsg({ type: 'success', text: 'Category icon updated successfully!' })
      }
    } catch {
      setCatMsg({ type: 'error', text: 'Failed to update category icon' })
    } finally {
      e.target.value = ''
    }
  }

  const addCategory = async () => {
    if (!newCatName.trim()) return
    setCatMsg({ type: '', text: '' })
    try {
      const res = await apiFetch('/api/v1/admin/categories', {
        method: 'POST',
        body: JSON.stringify({ name: newCatName.trim(), iconUrl: newCatIconUrl.trim() })
      })
      const data = await res.json()
      if (res.ok) {
        setCatMsg({ type: 'success', text: `Added category: ${data.name}` })
        setNewCatName('')
        setNewCatIconUrl('')
        loadCategories()
      } else {
        setCatMsg({ type: 'error', text: data.error || 'Failed to add category' })
      }
    } catch { setCatMsg({ type: 'error', text: 'Server error' }) }
  }

  const deleteCategory = async (id) => {
    setCatMsg({ type: '', text: '' })
    try {
      const res = await apiFetch(`/api/v1/admin/categories/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setCatMsg({ type: 'success', text: 'Category deleted' })
        loadCategories()
      } else {
        setCatMsg({ type: 'error', text: 'Failed to delete category' })
      }
    } catch { setCatMsg({ type: 'error', text: 'Server error' }) }
  }

  // === USERS TAB ===
  const [users, setUsers] = useState([])
  const [emailFilter, setEmailFilter] = useState('')
  const [userMsg, setUserMsg] = useState({ type: '', text: '' })

  const loadUsers = useCallback(async (email = '') => {
    if (!isSuperAdmin) return
    try {
      let url = '/api/v1/super-admin/users'
      if (email.trim()) url += `?query=${encodeURIComponent(email.trim())}`
      const res = await apiFetch(url)
      if (res.ok) setUsers(await res.json())
    } catch { /* ignore */ }
  }, [apiFetch, isSuperAdmin])

  const promoteUser = async (id) => {
    setUserMsg({ type: '', text: '' })
    try {
      const res = await apiFetch(`/api/v1/super-admin/users/${id}/promote`, { method: 'PUT' })
      const data = await res.json()
      if (res.ok) { setUserMsg({ type: 'success', text: `${data.name} promoted to ADMIN!` }); loadUsers(emailFilter) }
      else setUserMsg({ type: 'error', text: data.error || 'Failed.' })
    } catch { setUserMsg({ type: 'error', text: 'Server error.' }) }
  }

  const demoteUser = async (id) => {
    setUserMsg({ type: '', text: '' })
    try {
      const res = await apiFetch(`/api/v1/super-admin/users/${id}/demote`, { method: 'PUT' })
      const data = await res.json()
      if (res.ok) { setUserMsg({ type: 'success', text: `${data.name} demoted to USER.` }); loadUsers(emailFilter) }
      else setUserMsg({ type: 'error', text: data.error || 'Failed.' })
    } catch { setUserMsg({ type: 'error', text: 'Server error.' }) }
  }

  const toggleExpert = async (id) => {
    setUserMsg({ type: '', text: '' })
    try {
      const res = await apiFetch(`/api/v1/admin/users/${id}/toggle-expert`, { method: 'PUT' })
      const data = await res.json()
      if (res.ok) {
        setUserMsg({ type: 'success', text: `${data.name} is now ${data.isExpert ? 'an Expert' : 'a regular user'}.` })
        loadUsers(emailFilter)
      }
      else setUserMsg({ type: 'error', text: data.error || 'Failed.' })
    } catch { setUserMsg({ type: 'error', text: 'Server error.' }) }
  }

  // Initial load
  useEffect(() => {
    loadPendingReviews()
    loadPendingSpots()
    loadPendingEvents()
    loadPendingPaths()
    loadExpertApps()
    loadCategories()
    loadPendingReports()
    loadPendingAnnotationsCountOnly()
    if (isSuperAdmin) loadUsers()
  }, [loadPendingReviews, loadPendingSpots, loadPendingEvents, loadPendingPaths, loadExpertApps, loadCategories, loadPendingReports, loadPendingAnnotationsCountOnly, loadUsers, isSuperAdmin])

  // Annotations tab listing trigger
  useEffect(() => {
    if (tab === 'annotations') {
      loadAnnotations(annotationStatus)
    }
  }, [tab, annotationStatus, loadAnnotations])

  useEffect(() => {
    const nextTab = adminTabs.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'reviews'
    setTab(nextTab)
  }, [searchParams])

  const changeTab = (nextTab) => {
    setTab(nextTab)
    setSearchParams(nextTab === 'reviews' ? {} : { tab: nextTab })
  }

  const roleBadgeCls = (r) => r === 'SUPER_ADMIN' ? 'badge-role' : r === 'ADMIN' ? 'badge-pending' : 'badge-inactive'

  return (
    <div className="admin-page animate-fade-up">
      <h1 className="page-title" style={{ marginTop: 0, textAlign: 'center' }}>Admin Control Panel</h1>
      
      <div className="admin-tabs">
        <button className={`admin-tab ${tab === 'reviews' ? 'active' : ''}`} onClick={() => changeTab('reviews')}>
          Verify Reviews {pendingCount > 0 && <span className="pending-badge">{pendingCount}</span>}
        </button>
        <button className={`admin-tab ${tab === 'spots' ? 'active' : ''}`} onClick={() => changeTab('spots')}>
          Verify Spots {pendingSpotsCount > 0 && <span className="pending-badge">{pendingSpotsCount}</span>}
        </button>
        <button className={`admin-tab ${tab === 'events' ? 'active' : ''}`} onClick={() => changeTab('events')}>
          Verify Events {pendingEventsCount > 0 && <span className="pending-badge">{pendingEventsCount}</span>}
        </button>
        <button className={`admin-tab ${tab === 'paths' ? 'active' : ''}`} onClick={() => changeTab('paths')}>
          Verify Paths {pendingPathsCount > 0 && <span className="pending-badge">{pendingPathsCount}</span>}
        </button>
        <button className={`admin-tab ${tab === 'reports' ? 'active' : ''}`} onClick={() => changeTab('reports')}>
          Active Reports {reportsCount > 0 && <span className="pending-badge">{reportsCount}</span>}
        </button>
        <button className={`admin-tab ${tab === 'experts' ? 'active' : ''}`} onClick={() => changeTab('experts')}>
          Expert Applications {expertAppsCount > 0 && <span className="pending-badge">{expertAppsCount}</span>}
        </button>
        <button className={`admin-tab ${tab === 'annotations' ? 'active' : ''}`} onClick={() => changeTab('annotations')}>
          AR Annotations {pendingAnnotationsCount > 0 && <span className="pending-badge">{pendingAnnotationsCount}</span>}
        </button>
        <button className={`admin-tab ${tab === 'categories' ? 'active' : ''}`} onClick={() => changeTab('categories')}>
          Manage Categories
        </button>
        {isSuperAdmin && (
          <button className={`admin-tab ${tab === 'users' ? 'active' : ''}`} onClick={() => changeTab('users')}>
            Manage Users
          </button>
        )}
      </div>

      {tab === 'reviews' && (
        <div className="admin-reviews">
          {reviews.length === 0 && <p style={{ color: 'var(--success)', fontWeight: 600, textAlign: 'center', marginTop: '2rem' }}>All reviews moderated. Nothing pending.</p>}
          {reviews.map(r => (
            <div key={r.id} className="pending-review glass">
              <div className="pending-body">
                <p className="pending-meta">Review #{r.id} · Spot #{r.spotId} · Rating: {r.rating.toFixed(1)}/5 · {r.reviewType}</p>
                <p className="pending-text">{r.body}</p>
                <p className="pending-author" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <strong>
                    <Link to={`/user/${r.authorId}`} style={{ color: 'var(--text-primary)', textDecoration: 'none' }} className="hover-link">
                      {r.authorName}
                    </Link>
                  </strong>
                  <span className={`badge ${r.authorIsExpert ? 'badge-active' : 'badge-pending'}`} style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem' }}>
                    {r.authorIsExpert ? 'Expert' : 'User'}
                  </span>
                  <span>· {r.authorEmail} · {r.authorApprovedCount} approved reviews</span>
                </p>
              </div>
              <div className="pending-actions">
                <button className="btn btn-primary" onClick={() => reviewAction(r.id, 'APPROVED')}>Approve</button>
                <button className="btn btn-danger" onClick={() => reviewAction(r.id, 'REJECTED')}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'spots' && (
        <div className="admin-reviews">
          {pendingSpots.length === 0 && <p style={{ color: 'var(--success)', fontWeight: 600, textAlign: 'center', marginTop: '2rem' }}>All spots moderated. Nothing pending.</p>}
          {pendingSpots.map(s => (
            <div key={s.id} className="pending-review glass">
              <div className="pending-body">
                <p className="pending-meta">Spot #{s.id}</p>
                <h3 className="pending-text" style={{ margin: '0 0 0.5rem' }}>
                  <Link to={`/spot/${s.id}`} style={{ color: 'var(--primary)', textDecoration: 'none' }} className="hover-link">
                    {s.name}
                  </Link>
                </h3>

                {s.photos && s.photos.length > 0 && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <a href={s.photos[0]} target="_blank" rel="noreferrer" style={{ display: 'inline-block' }}>
                      <img 
                        src={s.photos[0]} 
                        alt={s.name} 
                        style={{ 
                          maxWidth: '100%', 
                          maxHeight: '200px', 
                          objectFit: 'cover', 
                          borderRadius: 'var(--radius-md)', 
                          border: '1px solid var(--border)' 
                        }} 
                      />
                    </a>
                  </div>
                )}

                <p className="pending-author" style={{ marginBottom: '0.5rem' }}>
                  📍 {s.address}
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1.5rem', fontSize: '0.9rem', marginBottom: '0.75rem' }} className="pending-author">
                  <div><strong>Type:</strong> {s.type}</div>
                  <div><strong>Coordinates:</strong> {s.latitude}, {s.longitude}</div>
                  <div><strong>Tags:</strong> {s.tags && s.tags.length > 0 ? s.tags.join(', ') : 'None'}</div>
                  {s.websiteUrl && (
                    <div>
                      <strong>Website:</strong>{' '}
                      <a href={s.websiteUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }} className="hover-link">
                        {s.websiteUrl}
                      </a>
                    </div>
                  )}
                </div>

                {s.submitterId && (
                  <p className="pending-author" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                    <span>Submitted by: </span>
                    <strong>
                      <Link to={`/user/${s.submitterId}`} style={{ color: 'var(--text-primary)', textDecoration: 'none' }} className="hover-link">
                        {s.submitterName || `User #${s.submitterId}`}
                      </Link>
                    </strong>
                    {s.submitterIsExpert && (
                      <span className="badge badge-active" style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem' }}>Expert</span>
                    )}
                  </p>
                )}
              </div>
              <div className="pending-actions">
                <button className="btn btn-primary" onClick={() => spotAction(s.id, 'APPROVE')}>Approve</button>
                <button className="btn btn-danger" onClick={() => setConfirmDialog({
                  title: 'Delete pending spot?',
                  message: `This will permanently delete "${s.name}".`,
                  confirmLabel: 'Delete spot',
                  onConfirm: () => spotAction(s.id, 'REJECT')
                })}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'events' && (
        <div className="admin-reviews">
          {pendingEvents.length === 0 && <p style={{ color: 'var(--success)', fontWeight: 600, textAlign: 'center', marginTop: '2rem' }}>All events moderated. Nothing pending.</p>}
          {pendingEvents.map(e => (
            <div key={e.id} className="pending-review glass">
              <div className="pending-body">
                <p className="pending-meta">Event #{e.id}</p>
                <h3 className="pending-text" style={{margin: '0 0 0.5rem'}}>
                  {e.title}
                </h3>

                {(e.imageUrls && e.imageUrls.length > 0) ? (
                  <div style={{ marginTop: '0.5rem', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    {e.imageUrls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer" style={{ display: 'inline-block' }}>
                        <img 
                          src={url} 
                          alt="Event" 
                          style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} 
                        />
                      </a>
                    ))}
                  </div>
                ) : e.imageUrl && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <a href={e.imageUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block' }}>
                      <img 
                        src={e.imageUrl} 
                        alt="Event" 
                        style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} 
                      />
                    </a>
                  </div>
                )}

                {e.spotName && (
                  <p className="pending-author" style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
                    <span>📍 Location: </span>
                    <strong>
                      <Link to={`/spot/${e.spotId}`} style={{ color: 'var(--primary)', textDecoration: 'none' }} className="hover-link">
                        {e.spotName}
                      </Link>
                    </strong>
                    {e.spotAddress && <span style={{ color: 'var(--text-muted)' }}>({e.spotAddress})</span>}
                  </p>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1.5rem', fontSize: '0.9rem', marginBottom: '0.75rem' }} className="pending-author">
                  <div><strong>Start:</strong> {new Date(e.startTime).toLocaleString()}</div>
                  <div><strong>End:</strong> {e.endTime ? new Date(e.endTime).toLocaleString() : '—'}</div>
                  <div><strong>Repeats:</strong> {
                    e.recurrenceRule === 'FREQ=DAILY' ? 'Daily' :
                    e.recurrenceRule === 'FREQ=WEEKLY' ? 'Weekly' :
                    e.recurrenceRule === 'FREQ=WEEKLY;INTERVAL=2' ? 'Bi-weekly' :
                    e.recurrenceRule === 'FREQ=MONTHLY' ? 'Monthly' :
                    e.recurrenceRule === 'FREQ=YEARLY' ? 'Yearly' :
                    e.recurrenceRule || 'None'
                  }</div>
                </div>

                {e.description && <p className="pending-text" style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>{e.description}</p>}
                
                {e.submittedBy && (
                  <p className="pending-author" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                    <span>Submitted by: </span>
                    <strong>
                      <Link to={`/user/${e.submittedBy}`} style={{ color: 'var(--text-primary)', textDecoration: 'none' }} className="hover-link">
                        {e.submitterName || `User #${e.submittedBy}`}
                      </Link>
                    </strong>
                  </p>
                )}
              </div>
              <div className="pending-actions">
                <button className="btn btn-primary" onClick={() => eventAction(e.id, 'APPROVE')}>Approve</button>
                <button className="btn btn-danger" onClick={() => setConfirmDialog({
                  title: 'Delete pending event?',
                  message: `This will permanently delete "${e.title}".`,
                  confirmLabel: 'Delete event',
                  onConfirm: () => eventAction(e.id, 'REJECT')
                })}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'paths' && (
        <div className="admin-reviews">
          {pendingPaths.length === 0 && <p style={{ color: 'var(--success)', fontWeight: 600, textAlign: 'center', marginTop: '2rem' }}>All trail paths moderated. Nothing pending.</p>}
          {pendingPaths.map(p => (
            <div key={p.id} className="pending-review glass">
              <div className="pending-body">
                <p className="pending-meta">Path #{p.id} · Spot: {p.spotName || `#${p.spotId}`}</p>
                <h3 className="pending-text" style={{ margin: '0 0 0.5rem' }}>{p.name}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1.5rem', fontSize: '0.9rem', marginBottom: '0.75rem' }} className="pending-author">
                  <div><strong>Difficulty:</strong> <span style={{ color: p.difficulty === 'EASY' ? '#22c55e' : p.difficulty === 'MODERATE' ? '#f59e0b' : p.difficulty === 'HARD' ? '#f97316' : '#ef4444' }}>{p.difficulty}</span></div>
                  <div><strong>Distance:</strong> {p.distanceMeters ? (p.distanceMeters >= 1000 ? `${(p.distanceMeters / 1000).toFixed(1)} km` : `${Math.round(p.distanceMeters)} m`) : '—'}</div>
                  <div><strong>Duration:</strong> {p.estimatedDurationMin ? `${p.estimatedDurationMin} min` : '—'}</div>
                  <div><strong>Privacy:</strong> {p.isPrivate ? '🔒 Private' : 'Public'}</div>
                </div>
                {p.description && <p className="pending-text" style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>{p.description}</p>}
                {p.submitterName && (
                  <p className="pending-author" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                    <span>Submitted by: </span>
                    <strong>
                      <Link to={`/user/${p.submittedBy}`} style={{ color: 'var(--text-primary)', textDecoration: 'none' }} className="hover-link">
                        {p.submitterName}
                      </Link>
                    </strong>
                  </p>
                )}
              </div>
              <div className="pending-actions">
                <button className="btn btn-primary" onClick={() => pathAction(p.id, 'APPROVE')}>Approve</button>
                <button className="btn btn-danger" onClick={() => setConfirmDialog({
                  title: 'Reject trail path?',
                  message: `This will permanently delete "${p.name}".`,
                  confirmLabel: 'Reject path',
                  onConfirm: () => pathAction(p.id, 'REJECT')
                })}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'experts' && (
        <div className="admin-reviews">
          {expertApps.length === 0 && <p style={{ color: 'var(--success)', fontWeight: 600, textAlign: 'center', marginTop: '2rem' }}>No pending expert applications.</p>}
          {expertApps.map(app => (
            <div key={app.id} className="pending-review glass">
              <div className="pending-body">
                <p className="pending-meta">Application #{app.id} · {new Date(app.createdAt).toLocaleDateString()}</p>
                <h3 className="pending-text" style={{ margin: '0 0 0.5rem' }}>
                  <Link to={`/user/${app.userId}`} style={{ color: 'var(--text-primary)', textDecoration: 'none' }} className="hover-link">
                    {app.userName || `User #${app.userId}`}
                  </Link>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>{app.userEmail}</span>
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1.5rem', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                  <div><strong>Title:</strong> {app.professionalTitle}</div>
                  <div><strong>Organization:</strong> {app.organization || '—'}</div>
                  <div><strong>Experience:</strong> {app.yearsExperience} years</div>
                  <div><strong>Specializations:</strong> {app.specializations || '—'}</div>
                </div>
                {app.portfolioUrl && (
                  <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                    <strong>Portfolio:</strong>{' '}
                    <a href={app.portfolioUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>{app.portfolioUrl}</a>
                  </p>
                )}
                <p className="pending-text" style={{ fontStyle: 'italic', borderLeft: '3px solid var(--primary)', paddingLeft: '0.75rem' }}>
                  "{app.justification}"
                </p>
              </div>
              <div className="pending-actions">
                <button className="btn btn-primary" onClick={() => expertAppAction(app.id, 'approve')}>Approve</button>
                <button className="btn btn-danger" onClick={() => expertAppAction(app.id, 'reject')}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'categories' && (
        <div className="admin-categories glass">
          <h3 className="admin-form-title">Spot Categories</h3>
          
          <div className="add-category-box" style={{ background: 'var(--bg-card)', padding: '1.25rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', border: '1px solid var(--border)' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: 'var(--text-secondary)' }}>Create New Category</h4>
            <div className="add-category-row" style={{ marginBottom: '1rem' }}>
              <input 
                className="input" 
                value={newCatName} 
                onChange={e => setNewCatName(e.target.value)} 
                placeholder="Category name (e.g. Museum)..." 
                onKeyDown={e => e.key === 'Enter' && addCategory()}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div className="category-icon" style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src={newCatIconUrl || '/icons/stash--pin-location-light.svg'} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
                <div>
                  <label className="btn btn-sm" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', cursor: 'pointer', display: 'inline-block' }}>
                    {uploadingIcon ? 'Uploading...' : 'Upload Custom Icon'}
                    <input type="file" accept="image/svg+xml, image/png, image/webp" style={{ display: 'none' }} onChange={handleCatIconUpload} disabled={uploadingIcon} />
                  </label>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>SVG or PNG (default pin icon if none)</div>
                </div>
              </div>
              <button className="btn btn-primary" onClick={addCategory} style={{ padding: '0.6rem 1.5rem' }}>Add Category</button>
            </div>
          </div>
          {catMsg.text && <div className={`msg msg-${catMsg.type}`} style={{ marginBottom: '1rem' }}>{catMsg.text}</div>}

          <div className="categories-list">
            {categories.map(c => (
              <div key={c.id} className="category-item">
                <div className="category-info">
                  <img className="category-icon" src={c.iconUrl || '/icons/stash--pin-location-light.svg'} alt={c.name} />
                  <span className="category-name">{c.name}</span>
                </div>
                <div className="category-actions">
                  <label className="btn btn-sm" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', cursor: 'pointer', margin: 0 }}>
                    Change Icon
                    <input type="file" accept="image/svg+xml, image/png, image/webp" style={{ display: 'none' }} onChange={(e) => updateExistingCatIcon(c.id, e)} />
                  </label>
                  {c.name.toLowerCase() !== 'other' && (
                    <button className="btn btn-danger btn-sm" onClick={() => setConfirmDialog({
                      title: 'Delete category?',
                      message: `This will delete "${c.name}".`,
                      confirmLabel: 'Delete category',
                      onConfirm: () => deleteCategory(c.id)
                    })}>Delete</button>
                  )}
                </div>
              </div>
            ))}
            {categories.length === 0 && <p className="text-muted">No categories found.</p>}
          </div>
        </div>
      )}

      {tab === 'users' && isSuperAdmin && (
        <div className="admin-users">
          {userMsg.text && <div className={`msg msg-${userMsg.type}`} style={{ marginBottom: '1rem' }}>{userMsg.text}</div>}

          <div className="users-search" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <input className="input" value={emailFilter} onChange={e => setEmailFilter(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadUsers(emailFilter)} placeholder="Search by name or email..." />
            <button className="btn btn-primary" onClick={() => loadUsers(emailFilter)}>Search</button>
            {emailFilter && <button className="btn" onClick={() => { setEmailFilter(''); loadUsers('') }}>Clear</button>}
          </div>

          <div className="users-table-wrap glass">
            <table className="users-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '1rem' }}>ID</th>
                  <th style={{ padding: '1rem' }}>Name</th>
                  <th style={{ padding: '1rem' }}>Email</th>
                  <th style={{ padding: '1rem' }}>Role</th>
                  <th style={{ padding: '1rem' }}>Expert</th>
                  <th style={{ padding: '1rem' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '1rem' }}>{u.id}</td>
                    <td style={{ padding: '1rem' }}>{u.name}</td>
                    <td style={{ padding: '1rem' }}>{u.email}</td>
                    <td style={{ padding: '1rem' }}><span className={`badge ${roleBadgeCls(u.role)}`}>{u.role}</span></td>
                    <td style={{ padding: '1rem' }}>
                      {u.isExpert
                        ? <span className="badge badge-active">Expert</span>
                        : <span className="badge badge-inactive">No</span>
                      }
                    </td>
                    <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button className={`btn btn-sm ${u.isExpert ? 'btn-danger' : 'btn-primary'}`} onClick={() => toggleExpert(u.id)}>
                        {u.isExpert ? 'Remove Expert' : 'Make Expert'}
                      </button>
                      {u.role === 'USER' && <button className="btn btn-primary btn-sm" onClick={() => promoteUser(u.id)}>Promote</button>}
                      {u.role === 'ADMIN' && <button className="btn btn-danger btn-sm" onClick={() => demoteUser(u.id)}>Demote</button>}
                      {u.role === 'SUPER_ADMIN' && <span className="text-muted">—</span>}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No users found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'reports' && (
        <div className="admin-reviews">
          {reports.length === 0 && <p style={{ color: 'var(--success)', fontWeight: 600, textAlign: 'center', marginTop: '2rem' }}>No pending reports. All clear!</p>}
          {reports.map(r => (
            <div key={r.id} className="pending-review glass">
              <div className="pending-body">
                <p className="pending-meta">Report #{r.id} · Created {new Date(r.createdAt).toLocaleString()}</p>
                <h3 className="pending-text" style={{ margin: '0 0 0.5rem', color: 'var(--text-error)' }}>
                  🚨 Reported {r.contentType} (ID: {r.contentId})
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem', fontSize: '0.95rem', marginBottom: '0.75rem' }} className="pending-author">
                  <div><strong>Reason:</strong> <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{r.reason}</span></div>
                  {r.details && <div><strong>Reporter Details:</strong> "{r.details}"</div>}
                  <div>
                    <strong>Action Link:</strong>{' '}
                    {r.contentType === 'SPOT' && <Link to={`/spot/${r.contentId}`} className="hover-link" style={{ color: 'var(--primary)' }}>View Spot #{r.contentId}</Link>}
                    {r.contentType === 'EVENT' && <Link to={`/events`} className="hover-link" style={{ color: 'var(--primary)' }}>View in Events (ID: {r.contentId})</Link>}
                    {r.contentType === 'TRAIL_PATH' && <Link to={`/path/${r.contentId}`} className="hover-link" style={{ color: 'var(--primary)' }}>View Path #{r.contentId}</Link>}
                    {r.contentType === 'REVIEW' && <span>Review ID: {r.contentId} (check Spot details)</span>}
                  </div>
                </div>
                <p className="pending-author">
                  Reported by: <strong>{r.reporterName}</strong> ({r.reporterEmail})
                </p>
              </div>
              <div className="pending-actions" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button className="btn btn-danger" onClick={() => setConfirmDialog({
                  title: 'Delete reported content?',
                  message: `This will approve the report and delete content ID ${r.contentId} immediately.`,
                  confirmLabel: 'Delete content',
                  onConfirm: () => reportAction(r.id, 'RESOLVED')
                })}>
                  Delete Content (Resolve)
                </button>
                <button className="btn btn-ghost" style={{ border: '1px solid var(--border)' }} onClick={() => reportAction(r.id, 'DISMISSED')}>
                  Dismiss Report
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'annotations' && (
        <div className="admin-reviews">
          {/* Status filter bar */}
          <div className="admin-sub-tabs" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', justifyContent: 'center' }}>
            {['PENDING', 'APPROVED', 'REJECTED'].map(statusVal => (
              <button
                key={statusVal}
                className={`btn btn-sm ${annotationStatus === statusVal ? 'btn-primary' : 'btn-ghost'}`}
                style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}
                onClick={() => setAnnotationStatus(statusVal)}
              >
                {statusVal} {statusVal === 'PENDING' && pendingAnnotationsCount > 0 && `(${pendingAnnotationsCount})`}
              </button>
            ))}
          </div>

          {annotations.length === 0 && (
            <p style={{ color: 'var(--success)', fontWeight: 600, textAlign: 'center', marginTop: '2rem' }}>
              No {annotationStatus.toLowerCase()} AR annotations found.
            </p>
          )}

          {annotations.map(ann => (
            <div key={ann.id} className="pending-review glass">
              <div className="pending-body">
                <p className="pending-meta">
                  Annotation #{ann.id} · {new Date(ann.createdAt).toLocaleDateString()}
                  <span className={`badge ${ann.status === 'APPROVED' ? 'badge-active' : ann.status === 'REJECTED' ? 'badge-role' : 'badge-pending'}`} style={{ marginLeft: '8px', fontSize: '0.75rem' }}>
                    {ann.status}
                  </span>
                </p>
                <h3 className="pending-text" style={{ margin: '0 0 0.5rem' }}>
                  📖 {ann.title}
                </h3>

                <p className="pending-text" style={{ fontSize: '0.9rem', marginBottom: '0.75rem', borderLeft: '3px solid var(--warning, #f59e0b)', paddingLeft: '0.75rem' }}>
                  {ann.description}
                </p>

                {ann.photoUrl && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <a href={ann.photoUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block' }}>
                      <img
                        src={ann.photoUrl}
                        alt={ann.title}
                        style={{
                          maxWidth: '100%',
                          maxHeight: '160px',
                          objectFit: 'cover',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid var(--border)'
                        }}
                      />
                    </a>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1.5rem', fontSize: '0.9rem', marginBottom: '0.75rem' }} className="pending-author">
                  <div>
                    <strong>Coordinates:</strong> {ann.latitude?.toFixed(5)}, {ann.longitude?.toFixed(5)}
                    <a
                      href={`/spots?lat=${ann.latitude}&lng=${ann.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--primary)', textDecoration: 'none', marginLeft: '6px', fontSize: '0.8rem' }}
                    >
                      🗺️ View Map
                    </a>
                  </div>
                  <div><strong>Radius:</strong> {ann.radiusMeters}m</div>
                  {ann.bearing != null && <div><strong>Bearing:</strong> {ann.bearing}°</div>}
                </div>

                <p className="pending-author" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                  <span>Submitted by: </span>
                  <strong>
                    <Link to={`/user/${ann.authorId}`} style={{ color: 'var(--text-primary)', textDecoration: 'none' }} className="hover-link">
                      {ann.authorName || `User #${ann.authorId}`}
                    </Link>
                  </strong>
                  {ann.authorIsExpert && (
                    <span className="badge badge-active" style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem' }}>Expert</span>
                  )}
                </p>
              </div>

              <div className="pending-actions" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center' }}>
                <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                  <button className="btn btn-sm btn-ghost" style={{ flex: 1, border: '1px solid var(--border)' }} onClick={() => setEditingAnnotation(ann)}>
                    ✏️ Edit
                  </button>
                  <button className="btn btn-sm btn-danger" style={{ flex: 1 }} onClick={() => setConfirmDialog({
                    title: 'Delete annotation permanently?',
                    message: `This will permanently delete "${ann.title}".`,
                    confirmLabel: 'Delete annotation',
                    onConfirm: () => handleDeleteAnnotation(ann.id)
                  })}>
                    🗑️ Delete
                  </button>
                </div>

                {ann.status === 'PENDING' && (
                  <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                    <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => annotationAction(ann.id, 'approve')}>Approve</button>
                    <button className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={() => annotationAction(ann.id, 'reject')}>Reject</button>
                  </div>
                )}
                {ann.status === 'APPROVED' && (
                  <button className="btn btn-danger btn-sm" style={{ width: '100%' }} onClick={() => annotationAction(ann.id, 'reject')}>Reject (Revoke)</button>
                )}
                {ann.status === 'REJECTED' && (
                  <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={() => annotationAction(ann.id, 'approve')}>Approve (Reactivate)</button>
                )}
              </div>
            </div>
          ))}

          {/* Inline Edit Form Overlay Modal */}
          {editingAnnotation && (
            <div className="confirm-dialog-overlay" role="dialog" aria-modal="true" style={{ zIndex: 1100 }}>
              <div className="confirm-dialog-box" style={{ maxWidth: '500px', width: '90%' }}>
                <h3 style={{ marginTop: 0, marginBottom: '1.5rem', textAlign: 'center' }}>
                  ✏️ Edit Annotation #{editingAnnotation.id}
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left', marginBottom: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Title</label>
                    <input
                      type="text"
                      className="input"
                      style={{ width: '100%' }}
                      value={editingAnnotation.title}
                      onChange={(e) => setEditingAnnotation(prev => ({ ...prev, title: e.target.value }))}
                      maxLength={150}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Explanation</label>
                    <textarea
                      className="input"
                      style={{ minHeight: '100px', width: '100%', resize: 'vertical' }}
                      value={editingAnnotation.description}
                      onChange={(e) => setEditingAnnotation(prev => ({ ...prev, description: e.target.value }))}
                      maxLength={2000}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Latitude</label>
                      <input
                        type="number"
                        step="any"
                        className="input"
                        style={{ width: '100%' }}
                        value={editingAnnotation.latitude}
                        onChange={(e) => setEditingAnnotation(prev => ({ ...prev, latitude: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Longitude</label>
                      <input
                        type="number"
                        step="any"
                        className="input"
                        style={{ width: '100%' }}
                        value={editingAnnotation.longitude}
                        onChange={(e) => setEditingAnnotation(prev => ({ ...prev, longitude: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Bearing (°)</label>
                      <input
                        type="number"
                        className="input"
                        style={{ width: '100%' }}
                        placeholder="0-360"
                        value={editingAnnotation.bearing ?? ''}
                        onChange={(e) => setEditingAnnotation(prev => ({ ...prev, bearing: e.target.value === '' ? null : e.target.value }))}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Radius (m)</label>
                      <input
                        type="number"
                        className="input"
                        style={{ width: '100%' }}
                        placeholder="e.g. 30"
                        value={editingAnnotation.radiusMeters ?? ''}
                        onChange={(e) => setEditingAnnotation(prev => ({ ...prev, radiusMeters: e.target.value === '' ? null : parseFloat(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Photo URL</label>
                      <input
                        type="text"
                        className="input"
                        style={{ width: '100%' }}
                        placeholder="Optional photo URL"
                        value={editingAnnotation.photoUrl ?? ''}
                        onChange={(e) => setEditingAnnotation(prev => ({ ...prev, photoUrl: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="confirm-dialog-actions">
                  <button className="confirm-dialog-secondary" onClick={() => setEditingAnnotation(null)}>
                    Cancel
                  </button>
                  <button className="confirm-dialog-primary" onClick={handleUpdateAnnotation}>
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
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
