import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useToast } from '../components/ToastProvider'
import './FriendsPage.css'

export default function FriendsPage() {
  const { apiFetch } = useApi()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [friends, setFriends] = useState([])
  const [requests, setRequests] = useState([])
  const [sentRequests, setSentRequests] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [status, setStatus] = useState('')

  const loadFriends = useCallback(async () => {
    try {
      const [friendsRes, reqRes, sentReqRes] = await Promise.all([
        apiFetch('/api/v1/friends'),
        apiFetch('/api/v1/friends/requests'),
        apiFetch('/api/v1/friends/requests/sent')
      ])
      if (friendsRes.ok) {
        setFriends(await friendsRes.json())
      }
      if (reqRes.ok) {
        setRequests(await reqRes.json())
      }
      if (sentReqRes.ok) {
        setSentRequests(await sentReqRes.json())
      }
    } catch (e) {
      console.error('Failed to load friends', e)
    }
  }, [apiFetch])

  useEffect(() => { loadFriends() }, [loadFriends])

  const handleSearch = (e) => {
    e.preventDefault()
    if (!searchQuery.trim()) {
      setSearchResults([])
      setStatus('')
      return
    }
    const query = searchQuery.toLowerCase()
    const results = friends.filter(f => 
      f.name.toLowerCase().includes(query) || f.email.toLowerCase().includes(query)
    )
    setSearchResults(results.map(f => ({ ...f, status: 'FRIEND' })))
    setStatus('')
  }

  const sendRequest = async (userId) => {
    try {
      const res = await apiFetch(`/api/v1/friends/request/${userId}`, { method: 'POST' })
      if (res.ok) {
        toast.success('Friend request sent!')
        setSearchResults(searchResults.map(u => u.id === userId ? { ...u, status: 'PENDING_FROM_ME' } : u))
        loadFriends()
      } else {
        const data = await res.json()
        toast.error(data.message || 'Could not send request')
      }
    } catch (e) {
      toast.error('Error sending request')
    }
  }

  const unfriendOrCancel = async (userId) => {
    try {
      const res = await apiFetch(`/api/v1/friends/user/${userId}`, { method: 'DELETE' })
      if (res.ok) {
        setSearchResults(searchResults.map(u => u.id === userId ? { ...u, status: 'NONE', isFriend: false } : u))
        loadFriends()
      }
    } catch (e) {
      console.error(e)
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
        <h1 className="page-title"> Friends</h1>
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
                <div key={user.id} className="search-result-item" style={{cursor: 'pointer'}} onClick={() => navigate(`/user/${user.id}`)}>
                  <div className="friend-info">
                    <h3>{user.name}</h3>
                    <p>{user.email}</p>
                  </div>
                  {user.status === 'FRIEND' ? (
                    <button className="btn btn-secondary" onClick={(e) => { e.stopPropagation(); unfriendOrCancel(user.id); }}>
                      Remove Friend
                    </button>
                  ) : user.status === 'PENDING_FROM_ME' ? (
                    <button className="btn btn-secondary" onClick={(e) => { e.stopPropagation(); unfriendOrCancel(user.id); }}>
                      Undo Request
                    </button>
                  ) : user.status === 'PENDING_TO_ME' ? (
                    <span className="text-sm text-secondary" style={{padding: '0.5rem'}}>Pending Request</span>
                  ) : (
                    <button className="btn btn-secondary" onClick={(e) => { e.stopPropagation(); sendRequest(user.id); }}>
                      Add
                    </button>
                  )}
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
                <div key={req.id} className="request-item" style={{cursor: 'pointer'}} onClick={() => navigate(`/user/${req.requesterId}`)}>
                  <div className="friend-info">
                    <h3>{req.requesterName}</h3>
                    <p>Wants to be friends</p>
                  </div>
                  <div className="friend-actions">
                    <button className="btn btn-primary" onClick={(e) => { e.stopPropagation(); acceptRequest(req.id); }}>Accept</button>
                    <button className="btn btn-danger" onClick={(e) => { e.stopPropagation(); rejectRequest(req.id); }}>Reject</button>
                  </div>
                </div>
              ))
            )}
          </section>

          <section className="friends-section mt-4">
            <h2>Sent Requests {sentRequests.length > 0 && `(${sentRequests.length})`}</h2>
            {sentRequests.length === 0 ? (
              <div className="empty-state">No sent requests</div>
            ) : (
              sentRequests.map(req => (
                <div key={req.id} className="request-item" style={{cursor: 'pointer'}} onClick={() => navigate(`/user/${req.addresseeId}`)}>
                  <div className="friend-info">
                    <h3>{req.addresseeName}</h3>
                    <p>Friend request sent</p>
                  </div>
                  <div className="friend-actions">
                    <button className="btn btn-secondary" onClick={(e) => { e.stopPropagation(); unfriendOrCancel(req.addresseeId); }}>Undo</button>
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
                <div key={friend.id} className="friend-item" style={{cursor: 'pointer'}} onClick={() => navigate(`/user/${friend.id}`)}>
                  <div className="friend-info">
                    <h3>{friend.name}</h3>
                    <p>{friend.email}</p>
                  </div>
                  <button className="btn btn-secondary" onClick={(e) => { e.stopPropagation(); unfriendOrCancel(friend.id); }}>
                    Remove Friend
                  </button>
                </div>
              ))
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
