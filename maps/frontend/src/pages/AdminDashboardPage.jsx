import { useState, useEffect, useCallback } from 'react'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import './AdminDashboardPage.css'

export default function AdminDashboardPage() {
  const { apiFetch } = useApi()
  const { isSuperAdmin } = useAuth()
  const [tab, setTab] = useState('reviews')

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
        if (!window.confirm("Are you sure you want to completely delete this spot?")) return;
        res = await apiFetch(`/api/v1/admin/spots/${id}`, { method: 'DELETE' })
      }
      if (res && res.ok) {
        setPendingSpots(prev => prev.filter(s => s.id !== id))
        setPendingSpotsCount(c => c - 1)
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

  // === CATEGORIES TAB ===
  const [categories, setCategories] = useState([])
  const [newCatName, setNewCatName] = useState('')
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

  const addCategory = async () => {
    if (!newCatName.trim()) return
    setCatMsg({ type: '', text: '' })
    try {
      const res = await apiFetch('/api/v1/admin/categories', {
        method: 'POST',
        body: JSON.stringify({ name: newCatName.trim() })
      })
      const data = await res.json()
      if (res.ok) {
        setCatMsg({ type: 'success', text: `Added category: ${data.name}` })
        setNewCatName('')
        loadCategories()
      } else {
        setCatMsg({ type: 'error', text: data.error || 'Failed to add category' })
      }
    } catch { setCatMsg({ type: 'error', text: 'Server error' }) }
  }

  const deleteCategory = async (id) => {
    if (!window.confirm("Delete this category?")) return
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
      if (email.trim()) url += `?email=${encodeURIComponent(email.trim())}`
      const res = await apiFetch(url)
      if (res.ok) setUsers(await res.json())
    } catch { /* ignore */ }
  }, [apiFetch, isSuperAdmin])

  const promoteUser = async (id) => {
    setUserMsg({ type: '', text: '' })
    try {
      const res = await apiFetch(`/api/v1/super-admin/users/${id}/promote`, { method: 'PUT' })
      const data = await res.json()
      if (res.ok) { setUserMsg({ type: 'success', text: `✓ ${data.name} promoted to ADMIN!` }); loadUsers(emailFilter) }
      else setUserMsg({ type: 'error', text: data.error || 'Failed.' })
    } catch { setUserMsg({ type: 'error', text: 'Server error.' }) }
  }

  const demoteUser = async (id) => {
    setUserMsg({ type: '', text: '' })
    try {
      const res = await apiFetch(`/api/v1/super-admin/users/${id}/demote`, { method: 'PUT' })
      const data = await res.json()
      if (res.ok) { setUserMsg({ type: 'success', text: `✓ ${data.name} demoted to USER.` }); loadUsers(emailFilter) }
      else setUserMsg({ type: 'error', text: data.error || 'Failed.' })
    } catch { setUserMsg({ type: 'error', text: 'Server error.' }) }
  }

  // Initial load
  useEffect(() => {
    loadPendingReviews()
    loadPendingSpots()
    loadCategories()
    if (isSuperAdmin) loadUsers()
  }, [loadPendingReviews, loadPendingSpots, loadCategories, loadUsers, isSuperAdmin])

  const roleBadgeCls = (r) => r === 'SUPER_ADMIN' ? 'badge-role' : r === 'ADMIN' ? 'badge-pending' : 'badge-inactive'

  return (
    <div className="admin-page animate-fade-up">
      <h1 className="page-title" style={{ marginTop: 0, textAlign: 'center' }}>Admin Control Panel</h1>
      
      <div className="admin-tabs">
        <button className={`admin-tab ${tab === 'reviews' ? 'active' : ''}`} onClick={() => setTab('reviews')}>
          ✅ Verify Reviews {pendingCount > 0 && <span className="pending-badge">{pendingCount}</span>}
        </button>
        <button className={`admin-tab ${tab === 'spots' ? 'active' : ''}`} onClick={() => setTab('spots')}>
          📍 Verify Spots {pendingSpotsCount > 0 && <span className="pending-badge">{pendingSpotsCount}</span>}
        </button>
        <button className={`admin-tab ${tab === 'categories' ? 'active' : ''}`} onClick={() => setTab('categories')}>
          📂 Manage Categories
        </button>
        {isSuperAdmin && (
          <button className={`admin-tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>
            👥 Manage Users
          </button>
        )}
      </div>

      {tab === 'reviews' && (
        <div className="admin-reviews">
          {reviews.length === 0 && <p style={{ color: 'var(--success)', fontWeight: 600, textAlign: 'center', marginTop: '2rem' }}>✓ All reviews moderated. Nothing pending.</p>}
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

      {tab === 'spots' && (
        <div className="admin-reviews">
          {pendingSpots.length === 0 && <p style={{ color: 'var(--success)', fontWeight: 600, textAlign: 'center', marginTop: '2rem' }}>✓ All spots moderated. Nothing pending.</p>}
          {pendingSpots.map(s => (
            <div key={s.id} className="pending-review glass">
              <div className="pending-body">
                <p className="pending-meta">Spot #{s.id} · Type: {s.type}</p>
                <h3 className="pending-text" style={{margin: '0 0 0.5rem'}}>{s.name}</h3>
                <p className="pending-author" style={{marginBottom: '0.5rem'}}>📍 {s.address}</p>
                <p className="pending-author">
                  Coordinates: {s.latitude}, {s.longitude} | Tags: {s.tags?.join(', ') || 'none'}
                </p>
              </div>
              <div className="pending-actions">
                <button className="btn btn-primary" onClick={() => spotAction(s.id, 'APPROVE')}>✓ Approve</button>
                <button className="btn btn-danger" onClick={() => spotAction(s.id, 'REJECT')}>✗ Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'categories' && (
        <div className="admin-categories glass">
          <h3 className="admin-form-title">Spot Categories</h3>
          
          <div className="add-category-row">
            <input 
              className="input" 
              value={newCatName} 
              onChange={e => setNewCatName(e.target.value)} 
              placeholder="New category name..." 
              onKeyDown={e => e.key === 'Enter' && addCategory()}
            />
            <button className="btn btn-primary" onClick={addCategory}>➕ Add</button>
          </div>
          {catMsg.text && <div className={`msg msg-${catMsg.type}`} style={{ marginBottom: '1rem' }}>{catMsg.text}</div>}

          <div className="categories-list">
            {categories.map(c => (
              <div key={c.id} className="category-item">
                <span className="category-name">{c.name}</span>
                {c.name.toLowerCase() !== 'other' && (
                  <button className="btn btn-danger btn-sm" onClick={() => deleteCategory(c.id)}>Delete</button>
                )}
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
              onKeyDown={e => e.key === 'Enter' && loadUsers(emailFilter)} placeholder="Search by email..." />
            <button className="btn btn-primary" onClick={() => loadUsers(emailFilter)}>🔍 Search</button>
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
                      {u.role === 'USER' && <button className="btn btn-primary btn-sm" onClick={() => promoteUser(u.id)}>↑ Promote</button>}
                      {u.role === 'ADMIN' && <button className="btn btn-danger btn-sm" onClick={() => demoteUser(u.id)}>↓ Demote</button>}
                      {u.role === 'SUPER_ADMIN' && <span className="text-muted">—</span>}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No users found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
