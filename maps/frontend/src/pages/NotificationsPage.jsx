import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import './NotificationsPage.css'

export default function NotificationsPage() {
  const { apiFetch } = useApi()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  const loadNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/v1/notifications')
      if (res.ok) {
        setNotifications(await res.json())
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [apiFetch])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  const markAsRead = async (id) => {
    try {
      await apiFetch(`/api/v1/notifications/${id}/read`, { method: 'POST' })
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    } catch { /* ignore */ }
  }

  const markAllAsRead = async () => {
    try {
      await apiFetch('/api/v1/notifications/read-all', { method: 'POST' })
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } catch { /* ignore */ }
  }

  const handleNotificationClick = async (notif) => {
    if (!notif.read) {
      await markAsRead(notif.id)
    }
    // Navigate based on type
    if (notif.type === 'FRIEND_REQUEST' || notif.type === 'FRIEND_ACCEPTED') {
      navigate('/friends')
    } else if (notif.type === 'POST_LIKE' || notif.type === 'POST_COMMENT') {
      navigate('/feed')
    } else if (notif.type === 'EVENT_CHANGE') {
      if (notif.referenceId) {
        navigate(`/event/${notif.referenceId}`)
      } else {
        navigate('/events')
      }
    }
  }

  const formatTime = (timestamp) => {
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
    <div className="notifications-page animate-fade-up">
      <div className="notifications-header">
        <h1 className="page-title">Notifications</h1>
        {notifications.some(n => !n.read) && (
          <button className="btn btn-ghost btn-sm" onClick={markAllAsRead}>Mark all as read</button>
        )}
      </div>

      {loading ? (
        <div className="feed-loading">
          <div className="spinner" />
          <p>Loading notifications...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="empty-state glass">
          <h2>No notifications yet</h2>
          <p>When someone interacts with your content, you'll see it here.</p>
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map(notif => (
            <div
              key={notif.id}
              className={`notification-item glass ${!notif.read ? 'unread' : ''}`}
              onClick={() => handleNotificationClick(notif)}
            >
              <div className="notification-content">
                <span className="notification-type-icon">
                  {notif.type === 'FRIEND_REQUEST' ? '👤' :
                   notif.type === 'FRIEND_ACCEPTED' ? '✅' :
                   notif.type === 'POST_LIKE' ? '❤️' :
                   notif.type === 'POST_COMMENT' ? '💬' :
                   notif.type === 'EVENT_CHANGE' ? '📅' : '🔔'}
                </span>
                <div>
                  <p className="notification-message">{notif.message}</p>
                  <span className="notification-time">{formatTime(notif.createdAt)}</span>
                </div>
              </div>
              {!notif.read && <span className="unread-dot" />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}