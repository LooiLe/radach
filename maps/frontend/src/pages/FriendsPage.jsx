import { useState, useEffect, useCallback } from 'react'
import { useApi } from '../hooks/useApi'
import './FriendsPage.css'

export default function FriendsPage() {
  const { apiFetch } = useApi()
  const [friends, setFriends] = useState([])
  const [requests, setRequests] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [status, setStatus] = useState('')

  const loadFriends = useCallback(async () => {
    try {
      const [friendsRes, reqRes] = await Promise.all([
        apiFetch('/api/v1/friends'),
        apiFetch('/api/v1/friends/requests')
      ])
      if (friendsRes.ok) {
        setFriends(await friendsRes.json())
      }
      if (reqRes.ok) {
        setRequests(await reqRes.json())
      }
    } catch (e) {
      console.error('Failed to load friends', e)
    }
  }, [apiFetch])

  useEffect(() => { loadFriends() }, [loadFriends])

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setStatus('Searching...')
    try {
      const res = await apiFetch(`/api/v1/friends/search-users?query=${encodeURIComponent(searchQuery)}`)
      if (res.ok) {
        setSearchResults(await res.json())
        setStatus('')
      }
    } catch (e) {
      setStatus('Search failed.')
    }
  }

  const sendRequest = async (userId) => {
    try {
      const res = await apiFetch(`/api/v1/friends/request/${userId}`, { method: 'POST' })
      if (res.ok) {
        alert('Friend request sent!')
        setSearchResults(searchResults.filter(u => u.id !== userId))
      } else {
        const data = await res.json()
        alert(data.message || 'Could not send request')
      }
    } catch (e) {
      alert('Error sending request')
    }
  }

  const acceptRequest = async (friendshipId) => {
    try {
      const res = await apiFetch(`/api/v1/friends/accept/${friendshipId}`, { method: 'POST' })
      if (res.ok) loadFriends()
    } catch (e) {
      console.error(e)
    }
  }

  const rejectRequest = async (friendshipId) => {
    try {
      const res = await apiFetch(`/api/v1/friends/${friendshipId}`, { method: 'DELETE' })
      if (res.ok) loadFriends()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="friends-page animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">🤝 Friends</h1>
        <p className="page-subtitle">Connect with others to see personalized trending spots.</p>
      </div>

      <div className="friends-grid">
        <div className="friends-column">
          <section className="friends-section">
            <h2>Find Friends</h2>
            <form className="search-box" onSubmit={handleSearch}>
              <input
                type="text"
                className="input"
                placeholder="Search by email..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="btn btn-primary">Search</button>
            </form>
            {status && <p className="text-sm">{status}</p>}
            <div className="search-results">
              {searchResults.map(user => (
                <div key={user.id} className="search-result-item">
                  <div className="friend-info">
                    <h3>{user.name}</h3>
                    <p>{user.email}</p>
                  </div>
                  <button className="btn btn-secondary" onClick={() => sendRequest(user.id)}>
                    Add
                  </button>
                </div>
              ))}
              {searchResults.length === 0 && searchQuery && !status && (
                <p className="text-sm text-secondary mt-4">No new users found.</p>
              )}
            </div>
          </section>

          <section className="friends-section mt-4">
            <h2>Pending Requests {requests.length > 0 && `(${requests.length})`}</h2>
            {requests.length === 0 ? (
              <div className="empty-state">No pending requests</div>
            ) : (
              requests.map(req => (
                <div key={req.id} className="request-item">
                  <div className="friend-info">
                    <h3>{req.requesterName}</h3>
                    <p>Wants to be friends</p>
                  </div>
                  <div className="friend-actions">
                    <button className="btn btn-primary" onClick={() => acceptRequest(req.id)}>Accept</button>
                    <button className="btn btn-danger" onClick={() => rejectRequest(req.id)}>Reject</button>
                  </div>
                </div>
              ))
            )}
          </section>
        </div>

        <div className="friends-column">
          <section className="friends-section">
            <h2>My Friends {friends.length > 0 && `(${friends.length})`}</h2>
            {friends.length === 0 ? (
              <div className="empty-state">You haven't added any friends yet.</div>
            ) : (
              friends.map(friend => (
                <div key={friend.id} className="friend-item">
                  <div className="friend-info">
                    <h3>{friend.name}</h3>
                    <p>{friend.email}</p>
                  </div>
                </div>
              ))
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
