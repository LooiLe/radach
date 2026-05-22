import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import './SearchPage.css'

export default function SearchPage() {
  const { apiFetch } = useApi()
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [users, setUsers] = useState([])
  const [status, setStatus] = useState('Enter a name or email to find users.')
  const [friendRequests, setFriendRequests] = useState({})
  const navigate = useNavigate()

  const doSearch = useCallback(async (q) => {
    setStatus(`Searching for "${q}"...`)
    try {
      const res = await apiFetch(`/api/v1/friends/search-users?query=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'User search failed.')
      setUsers(data)
      setStatus(`${data.length} user${data.length === 1 ? '' : 's'} found for "${q}".`)
    } catch (e) { setStatus(e.message) }
  }, [apiFetch])

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) { setQuery(q); doSearch(q) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (e) => { 
    e.preventDefault(); 
    if (query.trim()) doSearch(query.trim()); 
  }

  const sendFriendRequest = async (e, userId) => {
    e.stopPropagation()
    try {
      const res = await apiFetch(`/api/v1/friends/request/${userId}`, { method: 'POST' })
      if (res.ok) {
        setFriendRequests({ ...friendRequests, [userId]: 'sent' })
      } else {
        const data = await res.json()
        setFriendRequests({ ...friendRequests, [userId]: 'error' })
      }
    } catch {
      setFriendRequests({ ...friendRequests, [userId]: 'error' })
    }
  }

  return (
    <div className="search-page animate-fade-up">
      <div className="search-header">
        <h1 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>User Directory</h1>
        <form className="search-bar" onSubmit={handleSubmit}>
          <input className="input search-input" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search users by name or email..." autoFocus />
          <button className="btn btn-primary" type="submit">Search</button>
        </form>
      </div>
      
      <p className="page-status" style={{ marginBottom: '1.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>{status}</p>
      
      <div className="search-grid">
        {users.map((u, i) => (
          <div key={u.id} className="user-card glass animate-fade-up" style={{ animationDelay: `${i * 0.04}s`, padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="profile-avatar" style={{ width: '50px', height: '50px', fontSize: '1.5rem', margin: 0, cursor: 'pointer' }} onClick={() => navigate(`/user/${u.id}`)}>
              {u.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => navigate(`/user/${u.id}`)}>
              <h3 style={{ margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {u.name}
                {u.isExpert && <span className="badge badge-active" style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem' }}>Expert</span>}
              </h3>
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>{u.email}</p>
            </div>
            {u.isFriend ? (
              <span className="badge badge-ghost" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>Friends</span>
            ) : (
              <button
                className={`btn ${friendRequests[u.id] === 'sent' ? 'btn-ghost' : 'btn-primary'} btn-sm`}
                onClick={(e) => sendFriendRequest(e, u.id)}
                disabled={friendRequests[u.id] === 'sent'}
              >
                {friendRequests[u.id] === 'sent' ? 'Sent ✓' : 'Add Friend'}
              </button>
            )}
          </div>
        ))}
        
        {users.length === 0 && !status.includes('Loading') && !status.includes('Searching') && !status.includes('Enter') && (
          <div className="empty-state">No users found. Try a different name or email.</div>
        )}
      </div>
    </div>
  )
}
