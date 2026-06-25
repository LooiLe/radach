import { useState, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/ToastProvider'
import './FeedPage.css'

export default function FeedPage() {
  const { apiFetch } = useApi()
  const { userId, userName } = useAuth()
  const { toast } = useToast()
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchParams, setSearchParams] = useSearchParams()
  const feedTabs = ['trusted', 'global', 'experts']
  const initialTab = feedTabs.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'global'
  const [activeTab, setActiveTab] = useState(initialTab)
  const navigate = useNavigate()

  // Create post state
  const [postContent, setPostContent] = useState('')
  const [mediaUrls, setMediaUrls] = useState([])
  const [uploading, setUploading] = useState(false)

  // Likes/comments toggle state: { postId: boolean }
  const [showComments, setShowComments] = useState({})
  const [showLikes, setShowLikes] = useState({})
  const [newComment, setNewComment] = useState({})

  // Spot/Event/Journey attachment state (arrays for multiple)
  const [attachedSpots, setAttachedSpots] = useState([])
  const [attachedEvents, setAttachedEvents] = useState([])
  const [attachedJourneys, setAttachedJourneys] = useState([])
  const [showSpotSearch, setShowSpotSearch] = useState(false)
  const [showEventSearch, setShowEventSearch] = useState(false)
  const [showJourneySearch, setShowJourneySearch] = useState(false)
  const [spotSearchQuery, setSpotSearchQuery] = useState('')
  const [eventSearchQuery, setEventSearchQuery] = useState('')
  const [journeySearchQuery, setJourneySearchQuery] = useState('')
  const [spotSearchResults, setSpotSearchResults] = useState([])
  const [eventSearchResults, setEventSearchResults] = useState([])
  const [journeySearchResults, setJourneySearchResults] = useState([])
  const [searchingSpot, setSearchingSpot] = useState(false)
  const [searchingEvent, setSearchingEvent] = useState(false)
  const [searchingJourney, setSearchingJourney] = useState(false)

  const loadFeed = async (filter) => {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/v1/feed?filter=${filter}&limit=50`)
      if (res.ok) {
        const data = await res.json()
        // Filter out the current user's own items and VIEW items (viewed spots are private)
        setFeed(data.filter(item => String(item.userId) !== String(userId) && item.activityType !== 'VIEW'))
      }
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => {
    loadFeed(activeTab)
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const nextTab = feedTabs.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'global'
    setActiveTab(nextTab)
  }, [searchParams])

  const changeTab = (nextTab) => {
    setActiveTab(nextTab)
    setSearchParams(nextTab === 'global' ? {} : { tab: nextTab })
  }

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
    } catch { toast.error('Upload failed') }
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
    setAttachedSpots(prev => [...prev, spot])
    setShowSpotSearch(false)
    setSpotSearchQuery('')
    setSpotSearchResults([])
  }

  const selectEvent = (event) => {
    setAttachedEvents(prev => [...prev, event])
    setShowEventSearch(false)
    setEventSearchQuery('')
    setEventSearchResults([])
  }

  // Journey search with debounce
  useEffect(() => {
    if (!journeySearchQuery || journeySearchQuery.length < 2) {
      setJourneySearchResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearchingJourney(true)
      try {
        const res = await apiFetch(`/api/v1/journeys?limit=20`)
        if (res.ok) {
          const allJourneys = await res.json()
          const q = journeySearchQuery.toLowerCase()
          setJourneySearchResults(allJourneys.filter(j => j.name?.toLowerCase().includes(q)))
        }
      } catch { /* ignore */ }
      setSearchingJourney(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [journeySearchQuery, apiFetch])

  const selectJourney = (journey) => {
    setAttachedJourneys(prev => [...prev, journey])
    setShowJourneySearch(false)
    setJourneySearchQuery('')
    setJourneySearchResults([])
  }

  const submitPost = async () => {
    if (!postContent.trim() && mediaUrls.length === 0) return
    try {
      const body = {
        content: postContent,
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : null,
        spotIds: attachedSpots.length > 0 ? attachedSpots.map(s => s.id) : null,
        eventIds: attachedEvents.length > 0 ? attachedEvents.map(e => e.id) : null,
        journeyIds: attachedJourneys.length > 0 ? attachedJourneys.map(j => j.id) : null
      }

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
          userProfilePicture: null,
          isExpert: false,
          activityType: 'POST',
          spotId: attachedSpots[0]?.id || null,
          spotName: attachedSpots[0]?.name || null,
          spotAddress: attachedSpots[0]?.address || null,
          eventId: attachedEvents[0]?.id || null,
          eventName: attachedEvents[0]?.title || null,
          journeyId: attachedJourneys[0]?.id || null,
          journeyName: attachedJourneys[0]?.name || null,
          description: postContent,
          timestamp: new Date().toISOString(),
          mediaUrls: mediaUrls,
          likeCount: 0,
          hasLiked: false,
          comments: [],
          linkedSpots: attachedSpots.map(s => ({ id: s.id, name: s.name, address: s.address })),
          linkedEvents: attachedEvents.map(e => ({ id: e.id, title: e.title })),
          linkedJourneys: attachedJourneys.map(j => ({ id: j.id, name: j.name }))
        }
        setFeed(prev => [tempItem, ...prev])

        setPostContent('')
        setMediaUrls([])
        setAttachedSpots([])
        setAttachedEvents([])
        setAttachedJourneys([])
      }
    } catch { toast.error('Failed to create post') }
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
        {['trusted', 'global', 'experts'].map(tab => (
          <div 
            key={tab} 
            className={`feed-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => changeTab(tab)}
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
        
        {/* Attached spots/events/journeys display */}
        {attachedSpots.map(s => (
          <div key={s.id} className="attached-reference">
            <span>📍 {s.name}</span>
            <button className="remove-attachment-btn" onClick={() => setAttachedSpots(prev => prev.filter(x => x.id !== s.id))}>✕</button>
          </div>
        ))}
        {attachedEvents.map(e => (
          <div key={e.id} className="attached-reference">
            <span>📅 {e.title}</span>
            <button className="remove-attachment-btn" onClick={() => setAttachedEvents(prev => prev.filter(x => x.id !== e.id))}>✕</button>
          </div>
        ))}
        {attachedJourneys.map(j => (
          <div key={j.id} className="attached-reference">
            <span>🥾 {j.name}</span>
            <button className="remove-attachment-btn" onClick={() => setAttachedJourneys(prev => prev.filter(x => x.id !== j.id))}>✕</button>
          </div>
        ))}

        <div className="create-post-actions" style={{ flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="image-upload-wrapper">
              <button className="btn btn-ghost">📷 Add Photo</button>
              <input type="file" accept="image/*" onChange={handleFileUpload} disabled={uploading} />
            </div>
            <button className="btn btn-ghost" onClick={() => { setShowSpotSearch(!showSpotSearch); setShowEventSearch(false); setShowJourneySearch(false) }}>📍 Spot</button>
            <button className="btn btn-ghost" onClick={() => { setShowEventSearch(!showEventSearch); setShowSpotSearch(false); setShowJourneySearch(false) }}>📅 Event</button>
            <button className="btn btn-ghost" onClick={() => { setShowJourneySearch(!showJourneySearch); setShowSpotSearch(false); setShowEventSearch(false) }}>🥾 Journey</button>
          </div>
          {showSpotSearch && (
            <div className="attach-dropdown" style={{ width: '100%' }}>
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
          {showEventSearch && (
            <div className="attach-dropdown" style={{ width: '100%' }}>
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
          {showJourneySearch && (
            <div className="attach-dropdown" style={{ width: '100%' }}>
              <input
                type="text"
                placeholder="Search journeys..."
                value={journeySearchQuery}
                onChange={e => setJourneySearchQuery(e.target.value)}
                autoFocus
              />
              {searchingJourney && <div className="attach-searching">Searching...</div>}
              {journeySearchResults.map(j => (
                <div key={j.id} className="attach-result" onClick={() => selectJourney(j)}>
                  {j.name}
                </div>
              ))}
              {journeySearchQuery.length >= 2 && !searchingJourney && journeySearchResults.length === 0 && (
                <div className="attach-no-results">No journeys found</div>
              )}
            </div>
          )}
          <button 
            className="btn btn-primary" 
            onClick={submitPost} 
            disabled={uploading || (!postContent.trim() && mediaUrls.length === 0)}
            style={{ width: '100%' }}
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
          {activeTab === 'trusted' && (
            <>

              <h2>Your trusted feed is empty</h2>
              <p>Follow people you trust to see their activity here.</p>
            </>
          )}
          {activeTab === 'global' && (
            <>
              <h2>Nothing happening yet</h2>
              <p>Check back later to see what's trending around you.</p>
            </>
          )}
          {activeTab === 'experts' && (
            <>
              <h2>No expert activity</h2>
              <p>Follow experts to see their reviews and recommendations.</p>
            </>
          )}
        </div>
      ) : (
        <div className="feed-timeline">
          {feed.map((item, i) => (
            <div key={`${item.activityType}-${item.postId || item.spotId}-${i}`} className="feed-item glass">
              <div className="feed-item-header">
                <div className="feed-item-user-info">
                  <div className="feed-item-avatar" style={{ padding: item.userProfilePicture ? 0 : undefined, overflow: 'hidden' }}>
                    {item.userProfilePicture ? (
                      <img src={item.userProfilePicture} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      item.userName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <span className="feed-item-user">
                      <Link to={`/user/${item.userId}`} style={{color: 'inherit', textDecoration: 'none'}}>
                        {String(userId) === String(item.userId) ? 'You' : item.userName}
                      </Link>
                      {item.isExpert && <span className="badge badge-active" style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>Expert</span>}
                      {item.isAdmin && <span className="badge badge-role" style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>Admin</span>}
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
                  {/* Show all attached spots */}
                  {(item.linkedSpots || (item.spotId ? [{id: item.spotId, name: item.spotName, address: item.spotAddress}] : [])).map(s => (
                    <Link key={s.id} to={`/spot/${s.id}`} className="feed-item-spot-link">
                      📍 {s.name || 'Linked spot'}
                    </Link>
                  ))}
                  {/* Show all attached events */}
                  {(item.linkedEvents || (item.eventId ? [{id: item.eventId, title: item.eventName}] : [])).map(e => (
                    <Link key={e.id} to={`/event/${e.id}`} className="feed-item-spot-link">
                      📅 {e.title || 'Linked event'}
                    </Link>
                  ))}
                  {/* Show all attached journeys */}
                  {(item.linkedJourneys || (item.journeyId ? [{id: item.journeyId, name: item.journeyName}] : [])).map(j => (
                    <Link key={j.id} to={`/journey/${j.id}`} className="feed-item-spot-link">
                      🥾 {j.name || 'Linked journey'}
                    </Link>
                  ))}
                  <div className="feed-item-footer">
                    <div className="feed-item-footer-left">
                      <button
                        className={`feed-like-heart ${item.hasLiked ? 'liked' : ''}`}
                        onClick={() => toggleLike(item.postId)}
                        aria-label="Like post"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill={item.hasLiked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                        </svg>
                      </button>
                      <span
                        className="feed-likes-text"
                        onClick={() => setShowLikes({ ...showLikes, [item.postId]: !showLikes[item.postId] })}
                      >
                        {item.likeCount} Likes
                      </span>
                    </div>
                    <span
                      className={`feed-action-btn ${showComments[item.postId] ? 'active' : ''}`}
                      onClick={() => setShowComments({ ...showComments, [item.postId]: !showComments[item.postId] })}
                      style={{ cursor: 'pointer' }}
                    >
                      💬 {item.comments?.length || 0} Comments
                    </span>
                  </div>
                  {showLikes[item.postId] && item.likers && item.likers.length > 0 && (
                    <div className="profile-feed-likers">
                      {item.likers.map(liker => (
                        <Link key={liker.userId} to={`/user/${liker.userId}`} className="liker-name">
                          {liker.userName}
                        </Link>
                      ))}
                    </div>
                  )}
                  {showComments[item.postId] && (
                    <div className="profile-feed-comments">
                      {item.comments?.map(c => (
                        <div key={c.id} className="profile-comment-item">
                          <Link to={`/user/${c.authorId}`} className="comment-author">{c.authorName}</Link>
                          <span>{c.content}</span>
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