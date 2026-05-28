import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import Lightbox from '../components/Lightbox'
import ReportModal from '../components/ReportModal'
import './EventDetailPage.css'

export default function EventDetailPage() {
  const { id } = useParams()
  const { apiFetch } = useApi()
  const { isAuthenticated, isAdmin, userId } = useAuth()
  const navigate = useNavigate()

  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [reportTarget, setReportTarget] = useState({ type: '', id: null })

  useEffect(() => {
    async function fetchEvent() {
      setLoading(true)
      try {
        const res = await apiFetch(`/api/v1/events/${id}`)
        if (res.ok) {
          setEvent(await res.json())
        } else {
          setError('Event not found.')
        }
      } catch {
        setError('Failed to load event.')
      }
      setLoading(false)
    }
    fetchEvent()
  }, [apiFetch, id])

  const toggleLike = async () => {
    if (!isAuthenticated || !event) return
    try {
      const res = await apiFetch(`/api/v1/events/${event.id}/like`, { method: 'POST' })
      if (res.ok) setEvent(await res.json())
    } catch { /* ignore */ }
  }

  const toggleCalendar = async () => {
    if (!isAuthenticated || !event) return
    try {
      const res = await apiFetch(`/api/v1/events/${event.id}/calendar`, { method: 'POST' })
      if (res.ok) setEvent(await res.json())
    } catch { /* ignore */ }
  }

  const deleteEvent = async () => {
    if (!event) return
    if (!window.confirm('Delete this event?')) return
    try {
      const endpoint = isAdmin ? `/api/v1/admin/events/${event.id}` : `/api/v1/events/${event.id}`
      const res = await apiFetch(endpoint, { method: 'DELETE' })
      if (res.ok) navigate('/events')
    } catch { /* ignore */ }
  }

  const formatDateFull = (iso) => {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatTime = (iso) => {
    if (!iso) return ''
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  const formatDateShort = (iso) => {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const isSameDay = (iso1, iso2) => {
    if (!iso1 || !iso2) return false
    const d1 = new Date(iso1)
    const d2 = new Date(iso2)
    return d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
  }

  const getRecurrenceLabel = (rule) => {
    if (!rule) return null
    if (rule === 'FREQ=DAILY') return 'Daily'
    if (rule === 'FREQ=WEEKLY') return 'Weekly'
    if (rule === 'FREQ=WEEKLY;INTERVAL=2') return 'Bi-weekly'
    if (rule === 'FREQ=MONTHLY') return 'Monthly'
    if (rule === 'FREQ=YEARLY') return 'Yearly'
    return 'Recurring'
  }

  const buildDateTimeDisplay = () => {
    if (!event) return null
    const startDate = formatDateFull(event.startTime)
    const startTime = formatTime(event.startTime)

    if (!event.endTime) {
      return (
        <div className="ed-datetime-display">
          <div className="ed-date-primary">{startDate}</div>
          <div className="ed-time-primary">{startTime}</div>
        </div>
      )
    }

    const endTime = formatTime(event.endTime)

    if (isSameDay(event.startTime, event.endTime)) {
      return (
        <div className="ed-datetime-display">
          <div className="ed-date-primary">{startDate}</div>
          <div className="ed-time-primary">{startTime} – {endTime}</div>
        </div>
      )
    }

    // Multi-day event
    const endDate = formatDateFull(event.endTime)
    return (
      <div className="ed-datetime-display">
        <div className="ed-date-range">
          <div className="ed-range-item">
            <span className="ed-range-label">From</span>
            <span className="ed-range-date">{formatDateShort(event.startTime)}</span>
            <span className="ed-range-time">{startTime}</span>
          </div>
          <div className="ed-range-divider">→</div>
          <div className="ed-range-item">
            <span className="ed-range-label">To</span>
            <span className="ed-range-date">{formatDateShort(event.endTime)}</span>
            <span className="ed-range-time">{endTime}</span>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="event-detail-page animate-fade-up">
        <div className="ed-loading">
          <div className="ed-loading-shimmer" style={{ height: 300 }} />
          <div className="ed-loading-shimmer" style={{ height: 30, width: '60%', marginTop: '1rem' }} />
          <div className="ed-loading-shimmer" style={{ height: 20, width: '40%', marginTop: '0.5rem' }} />
        </div>
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="event-detail-page animate-fade-up">
        <div className="ed-error">
          <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>😕</p>
          <p>{error || 'Event not found.'}</p>
          <Link to="/events" className="btn" style={{ marginTop: '1rem' }}>← Back to Events</Link>
        </div>
      </div>
    )
  }

  const canEdit = isAdmin || (userId && Number(event.submittedBy) === Number(userId))
  const recurrenceLabel = getRecurrenceLabel(event.recurrenceRule)

  return (
    <div className="event-detail-page animate-fade-up">
      {/* Back Navigation */}
      <Link to="/events" className="ed-back-link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
        </svg>
        Back to Events
      </Link>

      <div className="ed-container">
        {/* Hero Image */}
        {(event.imageUrls && event.imageUrls.length > 0) ? (
          <div className="ed-hero" style={{ cursor: 'pointer' }} onClick={() => { setLightboxIndex(0); setLightboxOpen(true); }}>
            <img src={event.imageUrls[0]} alt={event.title} className="ed-hero-img" />
            <div className="ed-hero-overlay" />
          </div>
        ) : event.imageUrl ? (
          <div className="ed-hero">
            <img src={event.imageUrl} alt={event.title} className="ed-hero-img" />
            <div className="ed-hero-overlay" />
          </div>
        ) : (
          <div className="ed-hero-placeholder">
            <span>🎉</span>
          </div>
        )}

        {/* Main Content */}
        <div className="ed-content">
          <h1 className="ed-title">{event.title}</h1>

          {/* Date/Time Section */}
          <div className="ed-info-section">
            <div className="ed-info-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            {buildDateTimeDisplay()}
          </div>

          {/* Recurrence */}
          {recurrenceLabel && (
            <div className="ed-info-section">
              <div className="ed-info-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              </div>
              <div className="ed-info-text">Repeats {recurrenceLabel}</div>
            </div>
          )}

          {/* Location */}
          {event.spotName && (
            <div className="ed-info-section">
              <div className="ed-info-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <div>
                <Link to={`/spot/${event.spotId}`} className="ed-spot-link">{event.spotName}</Link>
                {event.spotAddress && (
                  <div className="ed-spot-address">{event.spotAddress}</div>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="ed-description-section">
              <h2 className="ed-section-title">About this event</h2>
              <p className="ed-description">{event.description}</p>
            </div>
          )}

          {/* More Photos */}
          {event.imageUrls?.length > 1 && (
            <div className="ed-description-section" style={{ marginTop: '2rem' }}>
              <h2 className="ed-section-title">More Photos</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
                {event.imageUrls.slice(1).map((url, idx) => (
                  <img key={idx} src={url} alt={`Event photo ${idx + 2}`} style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer' }} onClick={() => { setLightboxIndex(idx + 1); setLightboxOpen(true); }} />
                ))}
              </div>
            </div>
          )}

          {/* Submitted by */}
          {event.submitterName && (
            <div className="ed-submitter">
              Submitted by <strong>{event.submitterName}</strong>
            </div>
          )}

          {/* Actions */}
          <div className="ed-actions">
            <button
              className={`ed-action-btn ed-like-btn ${event.likedByCurrentUser ? 'liked' : ''}`}
              onClick={toggleLike}
              disabled={!isAuthenticated}
            >
              {event.likedByCurrentUser ? '❤️' : '🤍'} {event.likeCount || 0} Like{event.likeCount !== 1 ? 's' : ''}
            </button>
            <button
              className={`ed-action-btn ed-calendar-btn ${event.addedToCalendar ? 'in-calendar' : ''}`}
              onClick={toggleCalendar}
              disabled={!isAuthenticated}
            >
              {event.addedToCalendar ? '✓ In Calendar' : '📅 Add to Calendar'}
            </button>
            {isAuthenticated && (
              <button
                className="ed-action-btn ed-report-btn"
                onClick={() => {
                  setReportTarget({ type: 'EVENT', id: event.id })
                  setReportModalOpen(true)
                }}
                style={{ color: 'var(--text-secondary)' }}
              >
                🚨 Report
              </button>
            )}
          </div>

          {/* Edit / Delete */}
          {canEdit && (
            <div className="ed-manage-actions">
              <button className="ed-manage-btn" onClick={() => navigate('/add-event', { state: { editEvent: event } })}>
                ✏️ Edit Event
              </button>
              <button className="ed-manage-btn ed-delete-btn" onClick={deleteEvent}>
                🗑️ Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {lightboxOpen && event.imageUrls?.length > 0 && (
        <Lightbox 
          images={event.imageUrls} 
          initialIndex={lightboxIndex} 
          onClose={() => setLightboxOpen(false)} 
        />
      )}
      {reportModalOpen && (
        <ReportModal 
          contentType={reportTarget.type} 
          contentId={reportTarget.id} 
          onClose={() => setReportModalOpen(false)}
          onSuccess={() => alert('Thank you. This event has been reported for review.')}
        />
      )}
    </div>
  )
}
