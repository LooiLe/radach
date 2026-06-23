import { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import StatusBadge from '../components/StatusBadge'
import ConfirmDialog from '../components/ConfirmDialog'
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

const ENTRY_COLORS = ['#4f8cff', '#e11d48', '#16a34a', '#d97706', '#6b7280', '#0891b2', '#ec4899']

export default function EventsPage() {
  const { apiFetch } = useApi()
  const { isAuthenticated, isAdmin, userId } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialView = ['events', 'calendar', 'submissions'].includes(searchParams.get('view'))
    ? searchParams.get('view')
    : 'events'
  const [view, setView] = useState(initialView) // 'events' | 'calendar' | 'submissions'

  // ---- Submissions State ----
  const [submissions, setSubmissions] = useState([])
  const [submissionsLoading, setSubmissionsLoading] = useState(false)

  // ---- Events List State ----
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [cityFilter, setCityFilter] = useState('')
  const [monthFilter, setMonthFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')
  const [sortBy, setSortBy] = useState('date')

  // ---- Event Category Filter State ----
  const [eventCategoriesList, setEventCategoriesList] = useState([])
  const [selectedEventCategories, setSelectedEventCategories] = useState({})
  const [allEventCategoriesSelected, setAllEventCategoriesSelected] = useState(false)
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false)

  // ---- Temporary Staging State for Filters ----
  const [tempCityFilter, setTempCityFilter] = useState('')
  const [tempMonthFilter, setTempMonthFilter] = useState('')
  const [tempYearFilter, setTempYearFilter] = useState('')
  const [tempSortBy, setTempSortBy] = useState('date')
  const [tempSelectedEventCategories, setTempSelectedEventCategories] = useState({})
  const [tempAllEventCategoriesSelected, setTempAllEventCategoriesSelected] = useState(false)

  const filterPopoverRef = useRef(null)

  // Sync temp states with active states on popover open
  const handleOpenFilters = () => {
    setTempCityFilter(cityFilter)
    setTempMonthFilter(monthFilter)
    setTempYearFilter(yearFilter)
    setTempSortBy(sortBy)
    setTempSelectedEventCategories({ ...selectedEventCategories })
    
    const allSelected = eventCategoriesList.length > 0 && eventCategoriesList.every(c => selectedEventCategories[c.id])
    setTempAllEventCategoriesSelected(allSelected)
    setFilterDropdownOpen(true)
  }

  const handleCloseFilters = () => {
    setFilterDropdownOpen(false)
  }

  const handleApplyFilters = () => {
    setCityFilter(tempCityFilter)
    setMonthFilter(tempMonthFilter)
    setYearFilter(tempYearFilter)
    setSortBy(tempSortBy)
    setSelectedEventCategories({ ...tempSelectedEventCategories })
    
    const allSelected = eventCategoriesList.length > 0 && eventCategoriesList.every(c => tempSelectedEventCategories[c.id])
    setAllEventCategoriesSelected(allSelected)
    setFilterDropdownOpen(false)
  }

  const handleClearFilters = () => {
    setTempCityFilter('')
    setTempMonthFilter('')
    setTempYearFilter('')
    setTempSortBy('date')
    setTempSelectedEventCategories({})
    setTempAllEventCategoriesSelected(false)

    setCityFilter('')
    setMonthFilter('')
    setYearFilter('')
    setSortBy('date')
    setSelectedEventCategories({})
    setAllEventCategoriesSelected(false)
    setFilterDropdownOpen(false)
  }

  const toggleTempAllEventCategories = () => {
    const allSelected = eventCategoriesList.length > 0 && eventCategoriesList.every(c => tempSelectedEventCategories[c.id])
    const newState = {}
    eventCategoriesList.forEach(c => { newState[c.id] = !allSelected })
    setTempSelectedEventCategories(newState)
    setTempAllEventCategoriesSelected(!allSelected)
  }

  const toggleTempEventCategory = (categoryId) => {
    setTempSelectedEventCategories(prev => {
      const next = { ...prev, [categoryId]: !prev[categoryId] }
      const allNowSelected = eventCategoriesList.length > 0 && eventCategoriesList.every(c => next[c.id])
      setTempAllEventCategoriesSelected(allNowSelected)
      return next
    })
  }

  const getActiveFiltersCount = () => {
    let count = 0
    if (cityFilter) count++
    if (monthFilter) count++
    if (yearFilter) count++
    if (sortBy !== 'date') count++
    const selectedCount = eventCategoriesList.filter(c => selectedEventCategories[c.id]).length
    if (selectedCount > 0 && selectedCount < eventCategoriesList.length) {
      count++
    }
    return count
  }

  // Close category dropdown on click outside
  useEffect(() => {
    if (!filterDropdownOpen) return
    const handleOutsideClick = (e) => {
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(e.target)) {
        setFilterDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [filterDropdownOpen])

  // ---- Calendar State ----
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [calendarEntries, setCalendarEntries] = useState([])
  const [calendarLoading, setCalendarLoading] = useState(false)

  // ---- Modal State ----
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState('create') // 'create' | 'edit' | 'view'
  const [modalEntry, setModalEntry] = useState(null)
  const [clickedDate, setClickedDate] = useState(null)
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(null)
  const [showDeleteOptions, setShowDeleteOptions] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState(null)
  const [modalForm, setModalForm] = useState({
    title: '', description: '', location: '', startTime: '', endTime: '', recurrenceRule: '', color: '#4f8cff'
  })

  // ---- Load Events ----
  const loadEvents = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (cityFilter) params.set('city', cityFilter)
      if (monthFilter) params.set('month', monthFilter)
      if (yearFilter) params.set('year', yearFilter)
      if (sortBy) params.set('sortBy', sortBy)
      // Category filter — pass selected category name if exactly one is selected,
      // otherwise filter client-side for multi-select
      const selectedCatNames = eventCategoriesList
        .filter(c => selectedEventCategories[c.id])
        .map(c => c.name)
      if (selectedCatNames.length === 1) {
        params.set('category', selectedCatNames[0])
      }
      const qs = params.toString() ? `?${params.toString()}` : ''
      const res = await apiFetch(`/api/v1/events${qs}`)
      if (res.ok) {
        let data = await res.json()
        // Client-side multi-category filter
        if (selectedCatNames.length > 1) {
          const catSet = new Set(selectedCatNames.map(n => n.toLowerCase()))
          data = data.filter(e => e.category && catSet.has(e.category.toLowerCase()))
        }
        setEvents(data)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [apiFetch, cityFilter, monthFilter, yearFilter, sortBy, eventCategoriesList, selectedEventCategories])

  useEffect(() => { loadEvents() }, [loadEvents])

  // ---- Load Event Categories ----
  useEffect(() => {
    async function fetchEventCategories() {
      try {
        const res = await apiFetch('/api/v1/event-categories')
        if (res.ok) {
          const data = await res.json()
          const sorted = data.sort((a, b) => {
            if (a.name.toLowerCase() === 'other') return 1;
            if (b.name.toLowerCase() === 'other') return -1;
            return a.name.localeCompare(b.name);
          });
          setEventCategoriesList(sorted)
        }
      } catch { /* ignore */ }
    }
    fetchEventCategories()
  }, [apiFetch])

  // Helper togglers and button text getters are now unified and handled in temp state handlers.

  useEffect(() => {
    const nextView = ['events', 'calendar', 'submissions'].includes(searchParams.get('view'))
      ? searchParams.get('view')
      : 'events'
    setView(nextView)
  }, [searchParams])

  const changeView = (nextView) => {
    setView(nextView)
    setSearchParams(nextView === 'events' ? {} : { view: nextView })
  }

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

  // ---- Load Submissions ----
  const loadSubmissions = useCallback(async () => {
    if (!isAuthenticated) return
    setSubmissionsLoading(true)
    try {
      const res = await apiFetch('/api/v1/events/my-submissions')
      if (res.ok) setSubmissions(await res.json())
    } catch { /* ignore */ }
    setSubmissionsLoading(false)
  }, [apiFetch, isAuthenticated])

  useEffect(() => {
    if (view === 'submissions') loadSubmissions()
  }, [view, loadSubmissions])

  // ---- Event Actions ----
  const toggleLike = async (eventId) => {
    if (!isAuthenticated) return
    try {
      const res = await apiFetch(`/api/v1/events/${eventId}/like`, { method: 'POST' })
      if (res.ok) {
        const updated = await res.json()
        setEvents(prev => prev.map(e => e.id === updated.id ? updated : e))
        setSubmissions(prev => prev.map(e => e.id === updated.id ? updated : e))
      }
    } catch { /* ignore */ }
  }

  const toggleCalendar = async (eventId) => {
    if (!isAuthenticated) return
    try {
      const res = await apiFetch(`/api/v1/events/${eventId}/calendar`, { method: 'POST' })
      if (res.ok) {
        const updated = await res.json()
        setEvents(prev => prev.map(e => e.id === eventId ? updated : e))
        setSubmissions(prev => prev.map(e => e.id === eventId ? updated : e))
        if (view === 'calendar') loadCalendarEntries()
      }
    } catch { /* ignore */ }
  }

  const deleteAdminEvent = async (eventId) => {
    try {
      const res = await apiFetch(`/api/v1/admin/events/${eventId}`, { method: 'DELETE' })
      if (res.ok) {
        setEvents(prev => prev.filter(e => e.id !== eventId))
        setSubmissions(prev => prev.filter(e => e.id !== eventId))
      }
    } catch { /* ignore */ }
  }

  const deleteMySubmission = async (eventId) => {
    try {
      const res = await apiFetch(`/api/v1/events/${eventId}`, { method: 'DELETE' })
      if (res.ok) {
        setEvents(prev => prev.filter(e => e.id !== eventId))
        setSubmissions(prev => prev.filter(e => e.id !== eventId))
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
      
      // Exact match for the original date
      if (entryDate.getFullYear() === date.getFullYear()
        && entryDate.getMonth() === date.getMonth()
        && entryDate.getDate() === date.getDate()) {
        return true
      }
      
      // Handle recurrence
      if (entry.recurrenceRule && entryDate <= date) {
        let rule = entry.recurrenceRule
        let exdates = []
        let until = null
        if (rule.includes('EXDATE=')) {
          const match = rule.match(/EXDATE=([^;]+)/)
          if (match) exdates = match[1].split(',')
        }
        if (rule.includes('UNTIL=')) {
          const match = rule.match(/UNTIL=([^;]+)/)
          if (match) until = match[1]
        }
        
        const pad = n => String(n).padStart(2, '0')
        const dateStr = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T000000Z`
        
        if (exdates.includes(dateStr)) return false
        if (until && dateStr >= until) return false

        if (entry.recurrenceRule.includes('FREQ=DAILY')) {
          return true
        }
        if (entry.recurrenceRule.includes('FREQ=WEEKLY') && !entry.recurrenceRule.includes('INTERVAL=2')) {
          return entryDate.getDay() === date.getDay()
        }
        if (entry.recurrenceRule.includes('FREQ=WEEKLY;INTERVAL=2')) {
          const msInWeek = 7 * 24 * 60 * 60 * 1000
          const entryWeekStart = new Date(entryDate)
          entryWeekStart.setHours(0,0,0,0)
          entryWeekStart.setDate(entryWeekStart.getDate() - entryWeekStart.getDay())
          
          const targetWeekStart = new Date(date)
          targetWeekStart.setHours(0,0,0,0)
          targetWeekStart.setDate(targetWeekStart.getDate() - targetWeekStart.getDay())
          
          const weeksDiff = Math.round((targetWeekStart - entryWeekStart) / msInWeek)
          
          return entryDate.getDay() === date.getDay() && weeksDiff % 2 === 0
        }
        if (entry.recurrenceRule.includes('FREQ=MONTHLY')) {
          return entryDate.getDate() === date.getDate()
        }
        if (entry.recurrenceRule.includes('FREQ=YEARLY')) {
          return entryDate.getDate() === date.getDate() && entryDate.getMonth() === date.getMonth()
        }
      }
      return false
    })
  }

  const isToday = (date) => {
    const now = new Date()
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
  }

  const navigateMonth = (delta) => {
    setCalendarDate(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))
  }

  const openDayAgenda = (date) => {
    if (!isAuthenticated) return
    setSelectedCalendarDay(new Date(date))
  }

  const handleCalendarDayClick = (date, dayEntries) => {
    if (!isAuthenticated) return
    if (dayEntries.length > 0) {
      openDayAgenda(date)
    } else {
      openCreateModal(date)
    }
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
      location: '',
      startTime: toLocalDatetimeString(d),
      endTime: toLocalDatetimeString(new Date(d.getTime() + 3600000)),
      recurrenceRule: '',
      color: '#4f8cff'
    })
    setModalOpen(true)
  }

  const openEditModal = (entry, clickedDateObj) => {
    setModalMode('edit')
    setModalEntry(entry)
    setClickedDate(clickedDateObj)
    setShowDeleteOptions(false)
    setModalForm({
      title: entry.title,
      description: entry.description || '',
      location: getEntryLocation(entry),
      startTime: toLocalDatetimeString(new Date(entry.startTime)),
      endTime: entry.endTime ? toLocalDatetimeString(new Date(entry.endTime)) : '',
      recurrenceRule: entry.recurrenceRule || '',
      color: entry.color || '#4f8cff'
    })
    setModalOpen(true)
  }

  const openViewModal = (entry, clickedDateObj) => {
    setModalMode('view')
    setModalEntry(entry)
    setClickedDate(clickedDateObj)
    setShowDeleteOptions(false)
    setModalForm({
      title: entry.title,
      description: entry.description || '',
      location: getEntryLocation(entry),
      startTime: toLocalDatetimeString(new Date(entry.startTime)),
      endTime: entry.endTime ? toLocalDatetimeString(new Date(entry.endTime)) : '',
      recurrenceRule: entry.recurrenceRule || '',
      color: entry.color || '#4f8cff'
    })
    setModalOpen(true)
  }

  const switchToEditMode = () => {
    if (!modalEntry) return
    openEditModal(modalEntry, clickedDate)
  }

  const saveEntry = async () => {
    if (!modalForm.title.trim() || !modalForm.startTime) return
    const payload = {
      title: modalForm.title.trim(),
      description: modalForm.description.trim() || null,
      location: modalForm.location.trim() || null,
      spotId: modalEntry?.spotId || null,
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

  const confirmDelete = async (mode) => {
    if (!modalEntry) return
    try {
      let qs = ''
      if (mode !== 'all' && clickedDate) {
        const pad = n => String(n).padStart(2, '0')
        const dateStr = `${clickedDate.getFullYear()}${pad(clickedDate.getMonth() + 1)}${pad(clickedDate.getDate())}T000000Z`
        qs = `?mode=${mode}&date=${dateStr}`
      }
      const res = await apiFetch(`/api/v1/calendar/${modalEntry.id}${qs}`, { method: 'DELETE' })
      if (res.ok) {
        setModalOpen(false)
        setShowDeleteOptions(false)
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

  const formatDayHeading = (date) => {
    if (!date) return ''
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }

  const getEntryLocation = (entry) => {
    if (entry?.location) return entry.location
    const match = (entry?.description || '').match(/^Address:\s*(.+)$/m)
    return match ? match[1].trim() : ''
  }

  const isSameDay = (iso1, iso2) => {
    if (!iso1 || !iso2) return false
    const d1 = new Date(iso1)
    const d2 = new Date(iso2)
    return d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
  }

  const formatDateRange = (event) => {
    let result = formatDate(event.startTime)
    if (event.startTime) result += ` · ${formatTime(event.startTime)}`
    if (event.endTime) {
      if (isSameDay(event.startTime, event.endTime)) {
        result += ` – ${formatTime(event.endTime)}`
      } else {
        result += ` – ${formatDate(event.endTime)} · ${formatTime(event.endTime)}`
      }
    }
    return result
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
        <button className={`events-view-tab ${view === 'events' ? 'active' : ''}`} onClick={() => changeView('events')}>
          Events
        </button>
        {isAuthenticated && (
          <button className={`events-view-tab ${view === 'submissions' ? 'active' : ''}`} onClick={() => changeView('submissions')}>
            My Submissions
          </button>
        )}
        <button className={`events-view-tab ${view === 'calendar' ? 'active' : ''}`} onClick={() => changeView('calendar')}>
          My Calendar
        </button>
      </div>

      {/* ============ EVENTS LIST VIEW ============ */}
      {view === 'events' && (
        <>
          <div className="events-filter-header-row">
            <div className="events-search-box-wrapper">
              <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                className="input search-input"
                placeholder="Search events by city..."
                value={tempCityFilter}
                onChange={e => setTempCityFilter(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleApplyFilters()}
              />
            </div>

            <div className="filter-popover-container" ref={filterPopoverRef}>
              <button
                type="button"
                className={`btn btn-filter-trigger ${filterDropdownOpen ? 'active' : ''}`}
                onClick={filterDropdownOpen ? handleCloseFilters : handleOpenFilters}
              >
                <svg className="filter-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
                <span>Filters</span>
                {getActiveFiltersCount() > 0 && (
                  <span className="filter-badge">{getActiveFiltersCount()}</span>
                )}
              </button>

              {filterDropdownOpen && (
                <div className="filter-popover-card">
                  <div className="filter-popover-header">
                    <h3>Filters</h3>
                    <button type="button" className="btn-close-popover" onClick={handleCloseFilters}>&times;</button>
                  </div>

                  <div className="filter-popover-body">
                    {/* Date Grid */}
                    <div className="filter-section">
                      <label className="filter-label">Date</label>
                      <div className="filter-date-grid">
                        <select className="input select" value={tempMonthFilter} onChange={e => setTempMonthFilter(e.target.value)}>
                          <option value="">All months</option>
                          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                        </select>
                        <select className="input select" value={tempYearFilter} onChange={e => setTempYearFilter(e.target.value ? Number(e.target.value) : '')}>
                          <option value="">This & following years</option>
                          {Array.from({ length: 4 }, (_, i) => new Date().getFullYear() + i).map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Sort By Radio Group */}
                    <div className="filter-section">
                      <label className="filter-label">Sort By</label>
                      <div className="filter-radio-group">
                        <label className="radio-label">
                          <input
                            type="radio"
                            name="sortBy"
                            value="date"
                            checked={tempSortBy === 'date'}
                            onChange={() => setTempSortBy('date')}
                          />
                          <span>Date (Ascending)</span>
                        </label>
                        <label className="radio-label">
                          <input
                            type="radio"
                            name="sortBy"
                            value="trending"
                            checked={tempSortBy === 'trending'}
                            onChange={() => setTempSortBy('trending')}
                          />
                          <span>Trending</span>
                        </label>
                      </div>
                    </div>

                    {/* Categories Checklist Grid */}
                    <div className="filter-section">
                      <div className="filter-section-header">
                        <label className="filter-label">Categories</label>
                        <button type="button" className="btn-text-link" onClick={toggleTempAllEventCategories}>
                          {eventCategoriesList.length > 0 && eventCategoriesList.every(c => tempSelectedEventCategories[c.id]) ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                        {eventCategoriesList.map(cat => (
                          <label key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-primary)' }}>
                            <input
                              type="checkbox"
                              checked={!!tempSelectedEventCategories[cat.id]}
                              onChange={() => toggleTempEventCategory(cat.id)}
                              style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: 'var(--text-primary)' }}
                            />
                            <img src={cat.iconUrl || '/icons/stash--pin-location-light.svg'} alt="" style={{ width: 16, height: 16, objectFit: 'contain' }} />
                            <span>{cat.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="filter-popover-footer">
                    <button type="button" className="btn btn-text btn-clear" onClick={handleClearFilters}>
                      Clear All
                    </button>
                    <div className="footer-right-buttons">
                      <button type="button" className="btn btn-primary btn-apply" onClick={handleApplyFilters}>
                        Apply Filters
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button className="btn btn-primary btn-search-trigger" onClick={handleApplyFilters}>
              Search
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading events...</div>
          ) : events.length === 0 ? (
            <div className="empty-state">
              <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}></p>
              <p>No upcoming events found.</p>
              <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Try adjusting your filters or check back later.</p>
            </div>
          ) : (
            <div className="events-grid">
              {events.map((event, idx) => (
                <div key={event.id} className="event-card" style={{ animationDelay: `${idx * 0.05}s`, cursor: 'pointer' }} onClick={() => navigate(`/event/${event.id}`)}>
                  {(event.imageUrls && event.imageUrls.length > 0) ? (
                    <div className="event-card-image-wrapper">
                      <img src={event.imageUrls[0]} alt={event.title} className="event-card-image" />
                    </div>
                  ) : event.imageUrl ? (
                    <div className="event-card-image-wrapper">
                      <img src={event.imageUrl} alt={event.title} className="event-card-image" />
                    </div>
                  ) : (
                    <div className="event-card-image-placeholder">Event</div>
                  )}

                  <div className="event-card-body">
                    <div className="event-card-title">{event.title}</div>

                    {event.category && (
                      <div style={{
                        display: 'inline-block',
                        background: 'var(--primary-alpha, rgba(79, 140, 255, 0.15))',
                        color: 'var(--primary)',
                        padding: '0.15rem 0.6rem',
                        borderRadius: '999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        marginBottom: '0.5rem'
                      }}>
                        {event.category}
                      </div>
                    )}

                    <div className="event-card-meta">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      {formatDateRange(event)}
                    </div>

                    {event.recurrenceRule && (
                      <div className="event-card-meta">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="23 4 23 10 17 10" />
                          <polyline points="1 20 1 14 7 14" />
                          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                        </svg>
                        Repeats: {
                          event.recurrenceRule === 'FREQ=DAILY' ? 'Daily' :
                          event.recurrenceRule === 'FREQ=WEEKLY' ? 'Weekly' :
                          event.recurrenceRule === 'FREQ=WEEKLY;INTERVAL=2' ? 'Bi-weekly' :
                          event.recurrenceRule === 'FREQ=MONTHLY' ? 'Monthly' :
                          event.recurrenceRule === 'FREQ=YEARLY' ? 'Yearly' :
                          'Recurring'
                        }
                      </div>
                    )}

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

                  <div className="event-card-actions" onClick={e => e.stopPropagation()}>
                    <button
                      className={`event-action-btn ${event.likedByCurrentUser ? 'liked' : ''}`}
                      onClick={() => toggleLike(event.id)}
                      disabled={!isAuthenticated}
                    >
                      {event.likedByCurrentUser ? '♥' : '♡'} {event.likeCount || 0}
                    </button>
                    <button
                      className={`event-action-btn ${event.addedToCalendar ? 'in-calendar' : ''}`}
                      onClick={() => toggleCalendar(event.id)}
                      disabled={!isAuthenticated}
                    >
                      {event.addedToCalendar ? 'In Calendar' : 'Add to Calendar'}
                    </button>
                    {(isAdmin || (userId && Number(event.submittedBy) === Number(userId))) && (
                      <>
                        <button className="event-action-btn" onClick={() => navigate('/add-event', { state: { editEvent: event } })}>Edit</button>
                        <button
                          className="event-action-btn"
                          onClick={() => setConfirmDialog({
                            title: isAdmin ? 'Delete public event?' : 'Delete your submitted event?',
                            message: isAdmin ? 'This will remove it for everyone.' : 'This will permanently remove your submission.',
                            confirmLabel: 'Delete event',
                            onConfirm: () => isAdmin ? deleteAdminEvent(event.id) : deleteMySubmission(event.id)
                          })}
                          style={{ color: 'var(--danger)' }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ============ SUBMISSIONS VIEW ============ */}
      {view === 'submissions' && (
        <>
          {submissionsLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading submissions...</div>
          ) : submissions.length === 0 ? (
            <div className="empty-state">
              <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}></p>
              <p>You haven't submitted any events yet.</p>
              <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>Any events you submit will appear here.</p>
            </div>
          ) : (
            <div className="events-grid">
              {submissions.map((event, idx) => (
                <div key={event.id} className="event-card" style={{ animationDelay: `${idx * 0.05}s`, cursor: 'pointer' }} onClick={() => navigate(`/event/${event.id}`)}>
                  <div style={{ position: 'relative' }}>
                    {(event.imageUrls && event.imageUrls.length > 0) ? (
                      <div className="event-card-image-wrapper">
                        <img src={event.imageUrls[0]} alt={event.title} className="event-card-image" />
                      </div>
                    ) : event.imageUrl ? (
                      <div className="event-card-image-wrapper">
                        <img src={event.imageUrl} alt={event.title} className="event-card-image" />
                      </div>
                    ) : (
                      <div className="event-card-image-placeholder">Event</div>
                    )}
                    <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10 }}>
                      <StatusBadge status={event.status} />
                    </div>
                  </div>

                  <div className="event-card-body">
                    <div className="event-card-title">{event.title}</div>

                    <div className="event-card-meta">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      {formatDateRange(event)}
                    </div>

                    {event.recurrenceRule && (
                      <div className="event-card-meta">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="23 4 23 10 17 10" />
                          <polyline points="1 20 1 14 7 14" />
                          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                        </svg>
                        Repeats: {
                          event.recurrenceRule === 'FREQ=DAILY' ? 'Daily' :
                          event.recurrenceRule === 'FREQ=WEEKLY' ? 'Weekly' :
                          event.recurrenceRule === 'FREQ=WEEKLY;INTERVAL=2' ? 'Bi-weekly' :
                          event.recurrenceRule === 'FREQ=MONTHLY' ? 'Monthly' :
                          event.recurrenceRule === 'FREQ=YEARLY' ? 'Yearly' :
                          'Recurring'
                        }
                      </div>
                    )}

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

                  <div className="event-card-actions" onClick={e => e.stopPropagation()}>
                    {event.status === 'ACTIVE' && (
                      <>
                        <button
                          className={`event-action-btn ${event.likedByCurrentUser ? 'liked' : ''}`}
                          onClick={() => toggleLike(event.id)}
                          disabled={!isAuthenticated}
                        >
                          {event.likedByCurrentUser ? '♥' : '♡'} {event.likeCount || 0}
                        </button>
                        <button
                          className={`event-action-btn ${event.addedToCalendar ? 'in-calendar' : ''}`}
                          onClick={() => toggleCalendar(event.id)}
                          disabled={!isAuthenticated}
                        >
                          {event.addedToCalendar ? 'In Calendar' : 'Add to Calendar'}
                        </button>
                      </>
                    )}
                    <button className="event-action-btn" onClick={() => navigate('/add-event', { state: { editEvent: event } })}>Edit</button>
                    <button
                      className="event-action-btn"
                      onClick={() => setConfirmDialog({
                        title: 'Delete your submitted event?',
                        message: 'This will permanently remove your submission.',
                        confirmLabel: 'Delete event',
                        onConfirm: () => deleteMySubmission(event.id)
                      })}
                      style={{ color: 'var(--danger)' }}
                    >
                      Delete
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
                <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'center' }}>
                  <select
                    style={{ padding: '0.2rem', fontSize: '1.2rem', fontWeight: 'bold', width: 'auto', background: 'transparent', border: '1px solid transparent', borderRadius: '4px', cursor: 'pointer', outline: 'none', color: 'inherit' }}
                    value={calendarDate.getMonth()}
                    onChange={(e) => {
                      const newDate = new Date(calendarDate)
                      newDate.setMonth(parseInt(e.target.value))
                      setCalendarDate(newDate)
                    }}
                  >
                    {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                  </select>
                  <select
                    style={{ padding: '0.2rem', fontSize: '1.2rem', fontWeight: 'bold', width: 'auto', background: 'transparent', border: '1px solid transparent', borderRadius: '4px', cursor: 'pointer', outline: 'none', color: 'inherit' }}
                    value={calendarDate.getFullYear()}
                    onChange={(e) => {
                      const newDate = new Date(calendarDate)
                      newDate.setFullYear(parseInt(e.target.value))
                      setCalendarDate(newDate)
                    }}
                  >
                    {Array.from({ length: 21 }, (_, i) => new Date().getFullYear() - 10 + i).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
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
                    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
                  return (
                    <div
                      key={idx}
                      className={`calendar-day ${!day.currentMonth ? 'other-month' : ''} ${isToday(day.date) ? 'today' : ''}`}
                      onClick={() => day.currentMonth && handleCalendarDayClick(day.date, dayEntries)}
                    >
                      <div className="calendar-day-number">{day.day}</div>
                      {dayEntries.slice(0, 3).map(entry => (
                        <div
                          key={entry.id}
                          className="calendar-event-pill"
                          style={{ background: `${entry.color || '#4f8cff'}22`, color: entry.color || '#4f8cff' }}
                          onClick={(e) => { e.stopPropagation(); openViewModal(entry, day.date) }}
                          title={entry.title}
                        >
                          {entry.title}
                        </div>
                      ))}
                      {dayEntries.length > 3 && (
                        <button
                          className="calendar-more-pill"
                          onClick={(e) => { e.stopPropagation(); openDayAgenda(day.date) }}
                        >
                          +{dayEntries.length - 3} more
                        </button>
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

      {selectedCalendarDay && (
        <div className="calendar-modal-overlay" onClick={() => setSelectedCalendarDay(null)}>
          <div className="calendar-modal calendar-day-modal" onClick={e => e.stopPropagation()}>
            <div className="calendar-modal-header">
              <div>
                <h3>{formatDayHeading(selectedCalendarDay)}</h3>
                <p className="calendar-day-modal-subtitle">
                  {getEntriesForDay(selectedCalendarDay).length} activit{getEntriesForDay(selectedCalendarDay).length === 1 ? 'y' : 'ies'}
                </p>
              </div>
              <button className="calendar-modal-close" onClick={() => setSelectedCalendarDay(null)}>×</button>
            </div>
            <div className="calendar-day-agenda">
              {getEntriesForDay(selectedCalendarDay)
                .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
                .map(entry => (
                  <button
                    key={entry.id}
                    className="calendar-agenda-item"
                    onClick={() => {
                      setSelectedCalendarDay(null)
                      openViewModal(entry, selectedCalendarDay)
                    }}
                  >
                    <span className="calendar-agenda-color" style={{ background: entry.color || '#4f8cff' }} />
                    <span className="calendar-agenda-time">
                      {formatTime(entry.startTime)}
                      {entry.endTime && ` - ${formatTime(entry.endTime)}`}
                    </span>
                    <span className="calendar-agenda-title">{entry.title}</span>
                    {getEntryLocation(entry) && <span className="calendar-agenda-location">{getEntryLocation(entry)}</span>}
                  </button>
                ))}
            </div>
            <div className="calendar-modal-footer">
              <button className="btn" onClick={() => setSelectedCalendarDay(null)}>Close</button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const date = selectedCalendarDay
                  setSelectedCalendarDay(null)
                  openCreateModal(date)
                }}
              >
                + New Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ MODAL ============ */}
      {modalOpen && (
        <div className="calendar-modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="calendar-modal" onClick={e => e.stopPropagation()}>
            <div className="calendar-modal-header">
              <h3>
                {modalMode === 'view' ? 'Calendar Details' : modalMode === 'edit' ? 'Edit Entry' : 'New Calendar Entry'}
              </h3>
              <button className="calendar-modal-close" onClick={() => setModalOpen(false)}>✕</button>
            </div>
            {modalMode === 'view' ? (
              <div className="calendar-modal-body calendar-details-body">
                <div className="calendar-detail-title-row">
                  <span className="calendar-detail-color" style={{ background: modalForm.color }} />
                  <h4>{modalForm.title}</h4>
                </div>
                <div className="calendar-detail-block">
                  <span className="calendar-detail-label">Time</span>
                  <span className="calendar-detail-value">
                    {formatDate(modalEntry.startTime)}
                    {modalEntry.endTime && ` - ${formatTime(modalEntry.endTime)}`}
                  </span>
                </div>
                {modalForm.location && (
                  <div className="calendar-detail-block">
                    <span className="calendar-detail-label">Location</span>
                    <p className="calendar-detail-description">{modalForm.location}</p>
                  </div>
                )}
                {modalForm.description && (
                  <div className="calendar-detail-block">
                    <span className="calendar-detail-label">Description</span>
                    <p className="calendar-detail-description">{modalForm.description}</p>
                  </div>
                )}
                {modalEntry.recurrenceRule && (
                  <div className="calendar-detail-block">
                    <span className="calendar-detail-label">Repeat</span>
                    <span className="calendar-detail-value">
                      {modalEntry.recurrenceRule === 'FREQ=DAILY' ? 'Daily' :
                        modalEntry.recurrenceRule === 'FREQ=WEEKLY' ? 'Weekly' :
                        modalEntry.recurrenceRule === 'FREQ=WEEKLY;INTERVAL=2' ? 'Bi-weekly' :
                        modalEntry.recurrenceRule === 'FREQ=MONTHLY' ? 'Monthly' :
                        modalEntry.recurrenceRule === 'FREQ=YEARLY' ? 'Yearly' :
                        'Recurring'}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="calendar-modal-body">
                <div className="field">
                  <label className="label">Title</label>
                  <input className="input" value={modalForm.title} onChange={e => setModalForm(f => ({ ...f, title: e.target.value }))} placeholder="Event title..." />
                </div>
                <div className="field">
                  <label className="label">Description</label>
                  <textarea className="input textarea" value={modalForm.description} onChange={e => setModalForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description..." rows={2} />
                </div>
                <div className="field">
                  <label className="label">Location</label>
                  <input className="input" value={modalForm.location} onChange={e => setModalForm(f => ({ ...f, location: e.target.value }))} placeholder="Optional place or address..." />
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
            )}
            {showDeleteOptions ? (
              <div className="calendar-modal-footer" style={{ flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>Delete recurring event</p>
                <button className="btn btn-danger" onClick={() => confirmDelete('thisEvent')} style={{ width: '100%' }}>Only this event</button>
                <button className="btn btn-danger" onClick={() => confirmDelete('thisAndFuture')} style={{ width: '100%' }}>This and following events</button>
                <button className="btn btn-danger" onClick={() => confirmDelete('all')} style={{ width: '100%' }}>All events</button>
                <button className="btn" onClick={() => setShowDeleteOptions(false)} style={{ width: '100%', marginTop: '0.5rem' }}>Cancel</button>
              </div>
            ) : (
              <div className="calendar-modal-footer">
                {modalMode === 'edit' && (
                  <button className="btn btn-danger" onClick={() => {
                    if (modalEntry.recurrenceRule) setShowDeleteOptions(true)
                    else setConfirmDialog({
                      title: 'Delete calendar entry?',
                      message: 'This will permanently remove this calendar entry.',
                      confirmLabel: 'Delete entry',
                      onConfirm: () => confirmDelete('all')
                    })
                  }} style={{ marginRight: 'auto' }}>Delete</button>
                )}
                <button className="btn" onClick={() => setModalOpen(false)}>Cancel</button>
                {modalMode === 'view' ? (
                  <>
                    {modalEntry?.eventId && (
                      <button className="btn btn-primary" onClick={() => navigate(`/event/${modalEntry.eventId}`)}>
                        View Event
                      </button>
                    )}
                    {modalEntry?.spotId && (
                      <button className="btn btn-primary" onClick={() => navigate(`/spot/${modalEntry.spotId}`)}>
                        View Spot
                      </button>
                    )}
                    <button className="btn btn-primary" onClick={switchToEditMode}>Edit</button>
                  </>
                ) : (
                  <button className="btn btn-primary" onClick={saveEntry}>
                    {modalMode === 'edit' ? 'Save Changes' : 'Create Entry'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      <ConfirmDialog
        open={!!confirmDialog}
        title={confirmDialog?.title}
        message={confirmDialog?.message}
        confirmLabel={confirmDialog?.confirmLabel}
        onCancel={() => setConfirmDialog(null)}
        onConfirm={async () => {
          const action = confirmDialog?.onConfirm
          setConfirmDialog(null)
          await action?.()
        }}
      />
    </div>
  )
}
