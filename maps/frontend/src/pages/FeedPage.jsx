import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import './FeedPage.css'

export default function FeedPage() {
  const { apiFetch } = useApi()
  const [feed, setFeed] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const loadFeed = async () => {
      try {
        const res = await apiFetch('/api/v1/feed?limit=50')
        if (res.ok) {
          setFeed(await res.json())
        }
      } catch { /* ignore */ }
      setLoading(false)
    }
    loadFeed()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const getIcon = (type) => {
    switch (type) {
      case 'REVIEW': return ''
      case 'LIKE': return '️'
      case 'SAVE': return ''
      case 'VIEW': return ''
      default: return ''
    }
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
    <div className="feed-page">
      <div className="feed-header animate-fade-up">
        <h1 className="page-title"> Friend Activity</h1>
        <p className="page-subtitle">See what your friends are up to</p>
      </div>

      {loading ? (
        <div className="feed-loading">
          <div className="spinner" />
          <p>Loading feed...</p>
        </div>
      ) : feed.length === 0 ? (
        <div className="feed-empty glass animate-fade-up">
          <span className="feed-empty-icon"></span>
          <h2>No friend activity yet</h2>
          <p>Add friends to see their reviews, likes, and saves here.</p>
          <button className="btn btn-primary" onClick={() => navigate('/friends')}>
            Find Friends
          </button>
        </div>
      ) : (
        <div className="feed-timeline">
          {feed.map((item, i) => (
            <div
              key={`${item.activityType}-${item.spotId}-${item.userId}-${i}`}
              className="feed-item glass animate-fade-up"
              style={{ animationDelay: `${i * 0.04}s` }}
              onClick={() => navigate(`/spot/${item.spotId}`)}
            >
              <div className="feed-item-icon">{getIcon(item.activityType)}</div>
              <div className="feed-item-content">
                <div className="feed-item-header">
                  <span className="feed-item-user">{item.userName}</span>
                  <span className="feed-item-time">{timeAgo(item.timestamp)}</span>
                </div>
                <p className="feed-item-desc">
                  {item.description} <span className="feed-item-spot-name">{item.spotName}</span>
                </p>
                {item.spotAddress && (
                  <p className="feed-item-location">
                    <span className="location-pin"></span> {item.spotAddress}
                  </p>
                )}
              </div>
              <div className="feed-item-arrow">→</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
