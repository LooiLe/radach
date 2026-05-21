import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import './EventsPage.css'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const RECURRENCE_OPTIONS = [
  { label: 'None', value: '' },
  { label: 'Daily', value: 'FREQ=DAILY' },
  { label: 'Weekly', value: 'FREQ=WEEKLY' },
  { label: 'Bi-weekly', value: 'FREQ=WEEKLY;INTERVAL=2' },
  { label: 'Monthly', value: 'FREQ=MONTHLY' },
  { label: 'Yearly', value: 'FREQ=YEARLY' },
]

const ENTRY_COLORS = ['#4f8cff', '#e11d48', '#16a34a', '#d97706', '#8b5cf6', '#0891b2', '#ec4899']

export default function EventsPage() {
  const { apiFetch } = useApi()
  const { isAuthenticated } = useAuth()
  const [view, setView] = useState('events') // 'events' | 'calendar'

  // ---- Events List State ----
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [cityFilter, setCityFilter] = useState('')
  const [monthFilter, setMonthFilter] = useState('')
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear())

  // ---- Calendar State ----
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [calendarEntries, setCalendarEntries] = useState([])
  const [calendarLoading, setCalendarLoading] = useState(false)

  // ---- Modal State ----
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('create') // 'create' | 'edit' | 'view'
  const [modalEntry, setModalEntry] = useState(null)
  const [modalForm, setModalForm] = useState({
    title: '', description: '', startTime: '', endTime: '', recurrenceRule: '', color: '#4f8cff'
  })

  // ---- Load Events ----
  const loadEvents = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (cityFilter) params.set('city', cityFilter)
      if (monthFilter) params.set('month', monthFilter)
      if (yearFilter) params.set('year', yearFilter)
      const qs = params.toString() ? `?${params.toString()}` : ''
      const res = await apiFetch(`/api/v1/events${qs}`)
      if (res.ok) setEvents(await res.json())
    } catch { /* ignore */ }
    setLoading(false)
  }, [apiFetch, cityFilter, monthFilter, yearFilter])

  useEffect(() => { loadEvents() }, [loadEvents])

  // ---- Load Calendar Entries ----
  const loadCalendarEntries = useCallback(async () => {
    if (!isAuthenticated) return
    setCalendarLoading(true)
    try {
      const year = calendarDate.getFullYear()
      const month = calendarDate.getMonth()
      const start = new Date(year, month - 1, 1).toISOString()
      const end = new Date(year, month + 2, 0).toISOString()
      const res = await apiFetch(`/api/v1/calendar?start=${start}&end=${end}`)
      if (res.ok) setCalendarEntries(await res.json())
    } catch { /* ignore */ }
    setCalendarLoading(false)
  }, [apiFetch, calendarDate, isAuthenticated])

  useEffect(() => {
    if (view === 'calendar') loadCalendarEntries()
  }, [view, loadCalendarEntries])

  // ---- Event Actions ----
  const toggleLike = async (eventId) => {
    if (!isAuthenticated) return
    try {
      const res = await apiFetch(`/api/v1/events/${eventId}/like`, { method: 'POST' })
      if (res.ok) {
        const updated = await res.json()
        setEvents(prev => prev.map(e => e.id === updated.id ? updated : e))
      }
    } catch { /* ignore */ }
  }

  const addToCalendar = async (eventId) => {
    if (!isAuthenticated) return
    try {
      const res = await apiFetch(`/api/v1/events/${eventId}/calendar`, { method: 'POST' })
      if (res.ok) {
        setEvents(prev => prev.map(e => e.id === eventId ? { ...e, addedToCalendar: true } : e))
      }
    } catch { /* ignore */ }
  }

  // ---- Calendar Helpers ----
  const getCalendarDays = () => {
    const year = calendarDate.getFullYear()
    const month = calendarDate.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const daysInPrevMonth = new Date(year, month, 0).getDate()
    const days = []

    // Previous month fill
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ day: daysInPrevMonth - i, currentMonth: false, date: new Date(year, month - 1, daysInPrevMonth - i) })
    }
    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, currentMonth: true, date: new Date(year, month, i) })
    }
    // Next month fill
    const remaining = 42 - days.length
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, currentMonth: false, date: new Date(year, month + 1, i) })
    }
    return days
  }

  const getEntriesForDay = (date) => {
    return calendarEntries.filter(entry => {
      const entryDate = new Date(entry.startTime)
      return entryDate.getFullYear() === date.getFullYear()
        && entryDate.getMonth() === date.getMonth()
        && entryDate.getDate() === date.getDate()
    })
  }

  const isToday = (date) => {
    const now = new Date()
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
  }

  const navigateMonth = (delta) => {
    setCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))
  }

  // ---- Calendar Entry CRUD ----
  const openCreateModal = (date) => {
    if (!isAuthenticated) return
    const d = new Date(date)
    d.setHours(12, 0, 0, 0)
    setModalMode('create')
    setModalEntry(null)
    setModalForm({
      title: '',
      description: '',
      startTime: toLocalDatetimeString(d),
      endTime: toLocalDatetimeString(new Date(d.getTime() + 3600000)),
      recurrenceRule: '',
      color: '#4f8cff'
    })
    setModalOpen(true)
  }

  const openEditModal = (entry) => {
    setModalMode('edit')
    setModalEntry(entry)
    setModalForm({
      title: entry.title,
      description: entry.description || '',
      startTime: toLocalDatetimeString(new Date(entry.startTime)),
      endTime: entry.endTime ? toLocalDatetimeString(new Date(entry.endTime)) : '',
      recurrenceRule: entry.recurrenceRule || '',
      color: entry.color || '#4f8cff'
    })
    setModalOpen(true)
  }

  const saveEntry = async () => {
    if (!modalForm.title.trim() || !modalForm.startTime) return
    const payload = {
      title: modalForm.title.trim(),
      description: modalForm.description.trim() || null,
      startTime: new Date(modalForm.startTime).toISOString(),
      endTime: modalForm.endTime ? new Date(modalForm.endTime).toISOString() : null,
      recurrenceRule: modalForm.recurrenceRule || null,
      color: modalForm.color
    }
    try {
      let res
      if (modalMode === 'edit' && modalEntry) {
        res = await apiFetch(`/api/v1/calendar/${modalEntry.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        })
      } else {
        res = await apiFetch('/api/v1/calendar', {
          method: 'POST',
          body: JSON.stringify(payload)
        })
      }
      if (res.ok) {
        setModalOpen(false)
        loadCalendarEntries()
      }
    } catch { /* ignore */ }
  }

  const deleteEntry = async () => {
    if (!modalEntry) return
    if (!window.confirm('Delete this calendar entry?')) return
    try {
      const res = await apiFetch(`/api/v1/calendar/${modalEntry.id}`, { method: 'DELETE' })
      if (res.ok) {
        setModalOpen(false)
        loadCalendarEntries()
      }
    } catch { /* ignore */ }
  }

  // ---- Helpers ----
  const formatDate = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  }

  const formatTime = (iso) => {
    if (!iso) return ''
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  const toLocalDatetimeString = (d) => {
    const pad = n => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  return (
    <div className="events-page animate-fade-up">
      <h1 className="page-title" style={{ marginTop: 0, textAlign: 'center', marginBottom: '1.5rem' }}>Events</h1>

      {/* View Toggle */}
      <div className="events-view-tabs">
        <button className={`events-view-tab ${view === 'events' ? 'active' : ''}`} onClick={() => setView('events')}>
          📋 Events
        </button>
        <button className={`events-view-tab ${view === 'calendar' ? 'active' : ''}`} onClick={() => setView('calendar')}>
          📅 My Calendar
        </button>
      </div>

      {/* ============ EVENTS LIST VIEW ============ */}
      {view === 'events' && (
        <>
          <div className="events-filter-bar">
            <div className="field">
              <label className="label">City / Location</label>
              <input
                className="input"
                placeholder="Filter by city..."
                value={cityFilter}
                onChange={e => setCityFilter(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && loadEvents()}
              />
            </div>
            <div className="field">
              <label className="label">Month</label>
              <select className="input select" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
                <option value="">All months</option>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label">Year</label>
              <select className="input select" value={yearFilter} onChange={e => setYearFilter(Number(e.target.value))}>
                {[2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button className="btn" onClick={loadEvents} style={{ alignSelf: 'flex-end', marginBottom: '1px' }}>
              Search
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading events...</div>
          ) : events.length === 0 ? (
            <div className="empty-state">
              <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🎭</p>
              <p>No upcoming events found.</p>
              <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Try adjusting your filters or check back later.</p>
            </div>
          ) : (
            <div className="events-grid">
              {events.map((event, idx) => (
                <div key={event.id} className="event-card" style={{ animationDelay: `${idx * 0.05}s` }}>
                  {event.imageUrl ? (
                    <img src={event.imageUrl} alt={event.title} className="event-card-image" />
                  ) : (
                    <div className="event-card-image-placeholder">🎉</div>
                  )}

                  <div className="event-card-body">
                    <div className="event-card-title">{event.title}</div>

                    <div className="event-card-meta">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      {formatDate(event.startTime)}
                      {event.startTime && ` · ${formatTime(event.startTime)}`}
                      {event.endTime && ` – ${formatTime(event.endTime)}`}
                    </div>

                    {event.spotAddress && (
                      <div className="event-card-meta">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                          <circle cx="12" cy="10" r="3" />
                        </svg>
                        {event.spotAddress.split(',').slice(0, 2).join(',')}
                      </div>
                    )}

                    {event.description && (
                      <div className="event-card-description">{event.description}</div>
                    )}

                    {event.spotName && (
                      <div className="event-card-spot">
                        at <Link to={`/spot/${event.spotId}`}>{event.spotName}</Link>
                      </div>
                    )}
                  </div>

                  <div className="event-card-actions">
                    <button
                      className={`event-action-btn ${event.likedByCurrentUser ? 'liked' : ''}`}
                      onClick={() => toggleLike(event.id)}
                      disabled={!isAuthenticated}
                    >
                      {event.likedByCurrentUser ? '❤️' : '🤍'} {event.likeCount || 0}
                    </button>
                    <button
                      className={`event-action-btn ${event.addedToCalendar ? 'in-calendar' : ''}`}
                      onClick={() => addToCalendar(event.id)}
                      disabled={!isAuthenticated || event.addedToCalendar}
                    >
                      {event.addedToCalendar ? '✓ In Calendar' : '📅 Add to Calendar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ============ CALENDAR VIEW ============ */}
      {view === 'calendar' && (
        <>
          {!isAuthenticated ? (
            <div className="empty-state">
              <p>Please sign in to view your calendar.</p>
            </div>
          ) : (
            <div className="calendar-container">
              <div className="calendar-header">
                <div className="calendar-nav">
                  <button className="calendar-nav-btn" onClick={() => navigateMonth(-1)}>‹</button>
                  <button className="calendar-nav-btn" onClick={() => setCalendarDate(new Date())} style={{ fontSize: '0.7rem', width: 'auto', padding: '0 0.5rem' }}>Today</button>
                  <button className="calendar-nav-btn" onClick={() => navigateMonth(1)}>›</button>
                </div>
                <h2>{MONTHS[calendarDate.getMonth()]} {calendarDate.getFullYear()}</h2>
                <button className="btn" onClick={() => openCreateModal(new Date())} style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                  + New Entry
                </button>
              </div>

              <div className="calendar-grid">
                {DAY_NAMES.map(d => (
                  <div key={d} className="calendar-day-header">{d}</div>
                ))}
                {getCalendarDays().map((day, idx) => {
                  const dayEntries = getEntriesForDay(day.date)
                  return (
                    <div
                      key={idx}
                      className={`calendar-day ${!day.currentMonth ? 'other-month' : ''} ${isToday(day.date) ? 'today' : ''}`}
                      onClick={() => day.currentMonth && openCreateModal(day.date)}
                    >
                      <div className="calendar-day-number">{day.day}</div>
                      {dayEntries.slice(0, 3).map(entry => (
                        <div
                          key={entry.id}
                          className="calendar-event-pill"
                          style={{ background: `${entry.color || '#4f8cff'}22`, color: entry.color || '#4f8cff' }}
                          onClick={(e) => { e.stopPropagation(); openEditModal(entry) }}
                          title={entry.title}
                        >
                          {entry.title}
                        </div>
                      ))}
                      {dayEntries.length > 3 && (
                        <div className="calendar-event-pill" style={{ color: 'var(--text-muted)', fontSize: '0.62rem' }}>
                          +{dayEntries.length - 3} more
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {calendarLoading && (
                <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading...</div>
              )}
            </div>
          )}
        </>
      )}

      {/* ============ MODAL ============ */}
      {modalOpen && (
        <div className="calendar-modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="calendar-modal" onClick={e => e.stopPropagation()}>
            <div className="calendar-modal-header">
              <h3>{modalMode === 'edit' ? 'Edit Entry' : 'New Calendar Entry'}</h3>
              <button className="calendar-modal-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <div className="calendar-modal-body">
              <div className="field">
                <label className="label">Title</label>
                <input className="input" value={modalForm.title} onChange={e => setModalForm(f => ({ ...f, title: e.target.value }))} placeholder="Event title..." />
              </div>
              <div className="field">
                <label className="label">Description</label>
                <textarea className="input textarea" value={modalForm.description} onChange={e => setModalForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description..." rows={2} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="field">
                  <label className="label">Start</label>
                  <input type="datetime-local" className="input" value={modalForm.startTime} onChange={e => setModalForm(f => ({ ...f, startTime: e.target.value }))} />
                </div>
                <div className="field">
                  <label className="label">End</label>
                  <input type="datetime-local" className="input" value={modalForm.endTime} onChange={e => setModalForm(f => ({ ...f, endTime: e.target.value }))} />
                </div>
              </div>
              <div className="field">
                <label className="label">Repeat</label>
                <div className="recurrence-options">
                  {RECURRENCE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      className={`recurrence-option ${modalForm.recurrenceRule === opt.value ? 'active' : ''}`}
                      onClick={() => setModalForm(f => ({ ...f, recurrenceRule: opt.value }))}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label className="label">Color</label>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {ENTRY_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setModalForm(f => ({ ...f, color: c }))}
                      style={{
                        width: 28, height: 28, borderRadius: '50%', border: modalForm.color === c ? '2px solid var(--text-primary)' : '2px solid transparent',
                        background: c, cursor: 'pointer', transition: 'all 0.15s'
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="calendar-modal-footer">
              {modalMode === 'edit' && (
                <button className="btn btn-danger" onClick={deleteEntry} style={{ marginRight: 'auto' }}>Delete</button>
              )}
              <button className="btn" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveEntry}>
                {modalMode === 'edit' ? 'Save Changes' : 'Create Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
