import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import './FeedPage.css'

export default function FeedPage() {
  const { apiFetch } = useApi()
  const { userId, userName } = useAuth()
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('global')
  const navigate = useNavigate()

  // Create post state
  const [postContent, setPostContent] = useState('')
  const [mediaUrls, setMediaUrls] = useState([])
  const [uploading, setUploading] = useState(false)

  // Comments toggle state: { postId: boolean }
  const [showComments, setShowComments] = useState({})
  const [newComment, setNewComment] = useState({})

  // Spot/Event attachment state
  const [attachedSpot, setAttachedSpot] = useState(null)
  const [attachedEvent, setAttachedEvent] = useState(null)
  const [showSpotSearch, setShowSpotSearch] = useState(false)
  const [showEventSearch, setShowEventSearch] = useState(false)
  const [spotSearchQuery, setSpotSearchQuery] = useState('')
  const [eventSearchQuery, setEventSearchQuery] = useState('')
  const [spotSearchResults, setSpotSearchResults] = useState([])
  const [eventSearchResults, setEventSearchResults] = useState([])
  const [searchingSpot, setSearchingSpot] = useState(false)
  const [searchingEvent, setSearchingEvent] = useState(false)

  const loadFeed = async (filter) => {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/v1/feed?filter=${filter}&limit=50`)
      if (res.ok) {
        const data = await res.json()
        // Filter out the current user's own items from the feed
        setFeed(data.filter(item => String(item.userId) !== String(userId)))
      }
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => {
    loadFeed(activeTab)
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await apiFetch('/api/v1/upload', {
        method: 'POST',
        headers: {}, // Do not set Content-Type, let browser set it with boundary
        body: formData
      })
      if (res.ok) {
        const data = await res.json()
        setMediaUrls([...mediaUrls, data.url])
      }
    } catch { alert('Upload failed') }
    setUploading(false)
  }

  const removeMedia = async (url) => {
    setMediaUrls(mediaUrls.filter(u => u !== url))
    await apiFetch(`/api/v1/upload?url=${encodeURIComponent(url)}`, { method: 'DELETE' })
  }

  // Spot search with debounce
  useEffect(() => {
    if (!spotSearchQuery || spotSearchQuery.length < 2) {
      setSpotSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearchingSpot(true)
      try {
        const res = await apiFetch(`/api/v1/spots/search?q=${encodeURIComponent(spotSearchQuery)}`)
        if (res.ok) {
          setSpotSearchResults(await res.json())
        }
      } catch { /* ignore */ }
      setSearchingSpot(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [spotSearchQuery, apiFetch])

  // Event search with debounce
  useEffect(() => {
    if (!eventSearchQuery || eventSearchQuery.length < 2) {
      setEventSearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearchingEvent(true)
      try {
        const res = await apiFetch(`/api/v1/events?limit=20`)
        if (res.ok) {
          const allEvents = await res.json()
          // Filter locally by title match
          const q = eventSearchQuery.toLowerCase()
          setEventSearchResults(allEvents.filter(e => e.title?.toLowerCase().includes(q)))
        }
      } catch { /* ignore */ }
      setSearchingEvent(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [eventSearchQuery, apiFetch])

  const selectSpot = (spot) => {
    setAttachedSpot(spot)
    setAttachedEvent(null)
    setShowSpotSearch(false)
    setSpotSearchQuery('')
    setSpotSearchResults([])
  }

  const selectEvent = (event) => {
    setAttachedEvent(event)
    setAttachedSpot(null)
    setShowEventSearch(false)
    setEventSearchQuery('')
    setEventSearchResults([])
  }

  const submitPost = async () => {
    if (!postContent.trim() && mediaUrls.length === 0) return
    try {
      const body = {
        content: postContent,
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : null
      }
      if (attachedSpot) body.spotId = attachedSpot.id
      if (attachedEvent) body.eventId = attachedEvent.id

      const res = await apiFetch('/api/v1/posts', {
        method: 'POST',
        body: JSON.stringify(body)
      })
      if (res.ok) {
        const createdPost = await res.json()
        // Add the new post to feed temporarily so user sees "You posted" right away
        const tempItem = {
          postId: createdPost.id,
          userId: Number(userId),
          userName: 'You',
          isExpert: false,
          activityType: 'POST',
          spotId: attachedSpot?.id || null,
          spotName: attachedSpot?.name || null,
          spotAddress: attachedSpot?.address || null,
          description: postContent,
          timestamp: new Date().toISOString(),
          mediaUrls: mediaUrls,
          likeCount: 0,
          hasLiked: false,
          comments: []
        }
        setFeed(prev => [tempItem, ...prev])

        setPostContent('')
        setMediaUrls([])
        setAttachedSpot(null)
        setAttachedEvent(null)
      }
    } catch { alert('Failed to create post') }
  }

  const toggleLike = async (postId) => {
    try {
      const res = await apiFetch(`/api/v1/posts/${postId}/like`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setFeed(feed.map(item => {
          if (item.postId === postId) {
            return {
              ...item,
              hasLiked: data.liked,
              likeCount: data.liked ? item.likeCount + 1 : item.likeCount - 1
            }
          }
          return item
        }))
      }
    } catch { /* ignore */ }
  }

  const submitComment = async (postId) => {
    const content = newComment[postId]
    if (!content?.trim()) return
    try {
      const res = await apiFetch(`/api/v1/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content })
      })
      if (res.ok) {
        const comment = await res.json()
        // Optimistically update
        setFeed(feed.map(item => {
          if (item.postId === postId) {
            return {
              ...item,
              comments: [...(item.comments || []), {
                id: comment.id,
                authorName: 'You',
                content: comment.content,
                createdAt: comment.createdAt
              }]
            }
          }
          return item
        }))
        setNewComment({ ...newComment, [postId]: '' })
      }
    } catch { /* ignore */ }
  }

  const timeAgo = (timestamp) => {
    const diff = Date.now() - new Date(timestamp).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    return new Date(timestamp).toLocaleDateString()
  }

  return (
    <div className="feed-page animate-fade-up">
      <div className="feed-header">
        <h1 className="page-title">Feed</h1>
        <p className="page-subtitle">Discover posts, reviews, and activity</p>
      </div>

      <div className="feed-tabs">
        {['friends', 'global', 'experts'].map(tab => (
          <div 
            key={tab} 
            className={`feed-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </div>
        ))}
      </div>

      <div className="create-post-card glass">
        <textarea 
          className="create-post-textarea"
          placeholder="Share your thoughts or vibe..."
          value={postContent}
          onChange={e => setPostContent(e.target.value)}
        />
        {mediaUrls.length > 0 && (
          <div className="uploaded-images-preview">
            {mediaUrls.map(url => (
              <div key={url} className="preview-img-container">
                <img src={url} alt="Upload" />
                <button className="remove-img-btn" onClick={() => removeMedia(url)}>✕</button>
              </div>
            ))}
          </div>
        )}
        
        {/* Attached spot/event display */}
        {attachedSpot && (
          <div className="attached-reference">
            <span>📍 {attachedSpot.name}</span>
            <button className="remove-attachment-btn" onClick={() => setAttachedSpot(null)}>✕</button>
          </div>
        )}
        {attachedEvent && (
          <div className="attached-reference">
            <span>📅 {attachedEvent.title}</span>
            <button className="remove-attachment-btn" onClick={() => setAttachedEvent(null)}>✕</button>
          </div>
        )}

        <div className="create-post-actions">
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="image-upload-wrapper">
              <button className="btn btn-ghost">📷 Add Photo</button>
              <input type="file" accept="image/*" onChange={handleFileUpload} disabled={uploading} />
            </div>
            <div className="attach-wrapper" style={{ position: 'relative' }}>
              <button className="btn btn-ghost" onClick={() => { setShowSpotSearch(!showSpotSearch); setShowEventSearch(false) }}>📍 Spot</button>
              {showSpotSearch && (
                <div className="attach-dropdown" style={{ zIndex: 999 }}>
                  <input
                    type="text"
                    placeholder="Search spots..."
                    value={spotSearchQuery}
                    onChange={e => setSpotSearchQuery(e.target.value)}
                    autoFocus
                  />
                  {searchingSpot && <div className="attach-searching">Searching...</div>}
                  {spotSearchResults.map(s => (
                    <div key={s.id} className="attach-result" onClick={() => selectSpot(s)}>
                      {s.name} {s.address ? `· ${s.address}` : ''}
                    </div>
                  ))}
                  {spotSearchQuery.length >= 2 && !searchingSpot && spotSearchResults.length === 0 && (
                    <div className="attach-no-results">No spots found</div>
                  )}
                </div>
              )}
            </div>
            <div className="attach-wrapper" style={{ position: 'relative' }}>
              <button className="btn btn-ghost" onClick={() => { setShowEventSearch(!showEventSearch); setShowSpotSearch(false) }}>📅 Event</button>
              {showEventSearch && (
                <div className="attach-dropdown" style={{ zIndex: 999 }}>
                  <input
                    type="text"
                    placeholder="Search events..."
                    value={eventSearchQuery}
                    onChange={e => setEventSearchQuery(e.target.value)}
                    autoFocus
                  />
                  {searchingEvent && <div className="attach-searching">Searching...</div>}
                  {eventSearchResults.map(e => (
                    <div key={e.id} className="attach-result" onClick={() => selectEvent(e)}>
                      {e.title} {e.spotName ? `@ ${e.spotName}` : ''}
                    </div>
                  ))}
                  {eventSearchQuery.length >= 2 && !searchingEvent && eventSearchResults.length === 0 && (
                    <div className="attach-no-results">No events found</div>
                  )}
                </div>
              )}
            </div>
          </div>
          <button 
            className="btn btn-primary" 
            onClick={submitPost} 
            disabled={uploading || (!postContent.trim() && mediaUrls.length === 0)}
          >
            Post
          </button>
        </div>
      </div>

      {loading ? (
        <div className="feed-loading">
          <div className="spinner" />
          <p>Loading feed...</p>
        </div>
      ) : feed.length === 0 ? (
        <div className="feed-empty glass">
          <span className="feed-empty-icon"></span>
          <h2>Nothing to see here yet</h2>
          <p>Try following more friends or checking the Global feed.</p>
        </div>
      ) : (
        <div className="feed-timeline">
          {feed.map((item, i) => (
            <div key={`${item.activityType}-${item.postId || item.spotId}-${i}`} className="feed-item glass">
              <div className="feed-item-header">
                <div className="feed-item-user-info">
                  <div className="feed-item-avatar">
                    {item.userName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span className="feed-item-user">
                      <Link to={`/user/${item.userId}`} style={{color: 'inherit', textDecoration: 'none'}}>
                        {String(userId) === String(item.userId) ? 'You' : item.userName}
                      </Link>
                      {item.isExpert && <span className="badge badge-active" style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>Expert</span>}
                    </span>
                    <span className="feed-item-action">
                      {item.activityType === 'POST' ? 'created a post' : (item.activityType === 'REVIEW' ? 'left a review' : item.description)}
                    </span>
                  </div>
                </div>
                <span className="feed-item-time">{timeAgo(item.timestamp)}</span>
              </div>

              {item.activityType === 'POST' ? (
                <>
                  {item.description && <p className="feed-item-content">{item.description}</p>}
                  {item.mediaUrls && item.mediaUrls.length > 0 && (
                    <div className="feed-item-images">
                      {item.mediaUrls.map(url => (
                        <img key={url} src={url} alt="Post media" />
                      ))}
                    </div>
                  )}
                  {/* Show attached spot if post has a spotId */}
                  {item.spotId && (
                    <Link to={`/spot/${item.spotId}`} className="feed-item-spot-link">
                      📍 {item.spotName || 'Linked spot'}
                    </Link>
                  )}
                  <div className="feed-item-footer">
                    <button 
                      className={`feed-action-btn ${item.hasLiked ? 'active' : ''}`}
                      onClick={() => toggleLike(item.postId)}
                    >
                      {item.hasLiked ? '❤️' : '🤍'} {item.likeCount} Likes
                    </button>
                    <button 
                      className="feed-action-btn"
                      onClick={() => setShowComments({ ...showComments, [item.postId]: !showComments[item.postId] })}
                    >
                      💬 {item.comments?.length || 0} Comments
                    </button>
                  </div>
                  {showComments[item.postId] && (
                    <div className="comments-section">
                      {item.comments?.map(c => (
                        <div key={c.id} className="comment-item">
                          <span className="comment-author">{c.authorName}</span>
                          {c.content}
                          <span className="comment-time">{timeAgo(c.createdAt)}</span>
                        </div>
                      ))}
                      <div className="add-comment">
                        <input 
                          type="text" 
                          placeholder="Add a comment..." 
                          value={newComment[item.postId] || ''}
                          onChange={e => setNewComment({ ...newComment, [item.postId]: e.target.value })}
                          onKeyDown={e => e.key === 'Enter' && submitComment(item.postId)}
                        />
                        <button onClick={() => submitComment(item.postId)}>Post</button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {item.description !== 'viewed' && item.description !== 'saved' && item.description !== 'liked' && (
                    <p className="feed-item-content">{item.description}</p>
                  )}
                  <Link to={`/spot/${item.spotId}`} className="feed-item-spot-link">
                    📍 {item.spotName} {item.spotAddress ? `· ${item.spotAddress}` : ''}
                  </Link>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}