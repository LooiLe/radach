import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import './FeedPage.css'

export default function FeedPage() {
  const { apiFetch } = useApi()
  const { userId } = useAuth()
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

  const loadFeed = async (filter) => {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/v1/feed?filter=${filter}&limit=50`)
      if (res.ok) {
        setFeed(await res.json())
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

  const submitPost = async () => {
    if (!postContent.trim() && mediaUrls.length === 0) return
    try {
      const res = await apiFetch('/api/v1/posts', {
        method: 'POST',
        body: JSON.stringify({ content: postContent, mediaUrls })
      })
      if (res.ok) {
        setPostContent('')
        setMediaUrls([])
        loadFeed(activeTab) // Reload feed
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
                authorName: 'You', // In a real app we'd fetch our own name from auth context
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
                <img src={`http://localhost:8080${url}`} alt="Upload" />
                <button className="remove-img-btn" onClick={() => removeMedia(url)}>✕</button>
              </div>
            ))}
          </div>
        )}
        <div className="create-post-actions">
          <div className="image-upload-wrapper">
            <button className="btn btn-ghost">📷 Add Photo</button>
            <input type="file" accept="image/*" onChange={handleFileUpload} disabled={uploading} />
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
                        <img key={url} src={`http://localhost:8080${url}`} alt="Post media" />
                      ))}
                    </div>
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
