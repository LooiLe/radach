import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useToast } from '../components/ToastProvider'
import './MyItinerariesPage.css'

export default function MyItinerariesPage() {
  const { apiFetch } = useApi()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [itineraries, setItineraries] = useState([])
  const [credits, setCredits] = useState(0)
  const [subscription, setSubscription] = useState(null)
  const [pricing, setPricing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [calendarMessage, setCalendarMessage] = useState(null)
  const [addingCalendarId, setAddingCalendarId] = useState(null)
  const [cloningId, setCloningId] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [itResult, credResult, subResult, pricingResult] = await Promise.allSettled([
        apiFetch('/api/v1/itineraries'),
        apiFetch('/api/v1/stripe/my-credits'),
        apiFetch('/api/v1/stripe/my-subscription'),
        apiFetch('/api/v1/pricing')
      ])

      const itRes = itResult.status === 'fulfilled' ? itResult.value : null
      const credRes = credResult.status === 'fulfilled' ? credResult.value : null
      const subRes = subResult.status === 'fulfilled' ? subResult.value : null
      const pricingRes = pricingResult.status === 'fulfilled' ? pricingResult.value : null

      if (itRes?.ok) setItineraries(await itRes.json())
      if (credRes?.ok) {
        const d = await credRes.json()
        setCredits(d.balance)
      }
      if (subRes?.ok) setSubscription(await subRes.json())
      if (pricingRes?.ok) setPricing(await pricingRes.json())
    } catch (e) {
      console.error('Failed to load itinerary data', e)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id) {
    try {
      const res = await apiFetch(`/api/v1/itineraries/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setItineraries(prev => prev.filter(it => it.id !== id))
        setDeleteTarget(null)
      } else {
        toast.error('Failed to delete itinerary')
      }
    } catch (err) {
      console.error('Delete failed', err)
      toast.error('Failed to delete itinerary')
    }
  }

  async function handleClone(event, itinerary) {
    event.stopPropagation()
    setCloningId(itinerary.id)
    try {
      const res = await apiFetch(`/api/v1/itineraries/${itinerary.id}/clone`, { method: 'POST' })
      if (res.ok) {
        const cloned = await res.json()
        setItineraries(prev => [cloned, ...prev])
      } else {
        toast.error('Failed to duplicate itinerary')
      }
    } catch (err) {
      console.error('Clone failed', err)
      toast.error('Failed to duplicate itinerary')
    } finally {
      setCloningId(null)
    }
  }

  function makeLocalDateTime(dateValue, timeValue = '09:00') {
    const [year, month, day] = dateValue.split('-').map(Number)
    const [hour, minute] = timeValue.split(':').map(Number)
    return new Date(year, month - 1, day, hour || 0, minute || 0, 0, 0)
  }

  function getStopName(stop) {
    return stop.spot?.name || stop.spotName || 'Itinerary stop'
  }

  function getStopAddress(stop) {
    return stop.spot?.address || stop.spotAddress || ''
  }

  function getStopType(stop) {
    return stop.spot?.type || stop.spotType || ''
  }

  function getStopSpotId(stop) {
    return stop.spot?.id || stop.spotId || null
  }

  function getStopCalendarRange(dateValue, stop, fallbackStart) {
    const duration = Number(stop.durationMinutes) || 60
    const start = stop.startTime ? makeLocalDateTime(dateValue, stop.startTime) : fallbackStart
    let end = stop.endTime ? makeLocalDateTime(dateValue, stop.endTime) : new Date(start.getTime() + duration * 60000)

    if (end <= start) {
      end = new Date(start.getTime() + duration * 60000)
    }

    return { start, end }
  }

  function buildStopCalendarDescription(itinerary, stop, stopOrder) {
    const lines = [
      `From itinerary: ${itinerary.title}`,
      itinerary.description,
      getStopType(stop) && `Category: ${getStopType(stop)}`,
      getStopAddress(stop) && `Address: ${getStopAddress(stop)}`,
      stop.notes && `Notes: ${stop.notes}`,
      `Itinerary ID: ${itinerary.id}`,
      `Stop Order: ${stopOrder}`
    ]

    return lines.filter(Boolean).join('\n')
  }

  async function handleAddToCalendar(event, itinerarySummary) {
    event.stopPropagation()
    setCalendarMessage(null)
    setAddingCalendarId(itinerarySummary.id)

    try {
      const detailRes = await apiFetch(`/api/v1/itineraries/${itinerarySummary.id}`)
      if (!detailRes.ok) throw new Error('Could not load itinerary details')

      const itinerary = await detailRes.json()
      if (!itinerary.date) {
        setCalendarMessage({ type: 'error', text: 'Add a planned date to this itinerary before sending it to calendar.' })
        return
      }

      const dayStart = makeLocalDateTime(itinerary.date, '00:00')
      const dayEnd = makeLocalDateTime(itinerary.date, '23:59')
      const existingRes = await apiFetch(`/api/v1/calendar?start=${encodeURIComponent(dayStart.toISOString())}&end=${encodeURIComponent(dayEnd.toISOString())}`)
      const existingEntries = existingRes.ok ? await existingRes.json() : []
      const existingStopEntries = new Map()
      existingEntries.forEach(entry => {
        const description = entry.description || ''
        if (!description.includes(`Itinerary ID: ${itinerary.id}`)) return

        const match = description.match(/Stop Order: (\d+)/)
        if (match) existingStopEntries.set(match[1], entry)
      })

      const sortedStops = [...(itinerary.stops || [])].sort((a, b) => (a.stopOrder || 0) - (b.stopOrder || 0))

      if (sortedStops.length === 0) {
        setCalendarMessage({ type: 'error', text: 'Add at least one stop before sending this itinerary to calendar.' })
        return
      }

      const entriesToCreate = []
      const entriesToUpdate = []
      let fallbackStart = makeLocalDateTime(itinerary.date, '09:00')

      sortedStops.forEach((stop, index) => {
        const stopOrder = stop.stopOrder || index + 1
        const { start, end } = getStopCalendarRange(itinerary.date, stop, fallbackStart)
        const location = getStopAddress(stop) || null
        const spotId = getStopSpotId(stop)
        const description = buildStopCalendarDescription(itinerary, stop, stopOrder)
        fallbackStart = new Date(end.getTime() + 15 * 60000)

        const existingEntry = existingStopEntries.get(String(stopOrder))
        if (existingEntry) {
          const hasAddressLine = (existingEntry.description || '').includes('Address:')
          if ((location && !existingEntry.location) || (location && !hasAddressLine) || (spotId && !existingEntry.spotId)) {
            entriesToUpdate.push({
              ...existingEntry,
              description,
              location,
              spotId
            })
          }
          return
        }

        entriesToCreate.push({
          title: getStopName(stop),
          description,
          location,
          spotId,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          color: '#6b7280'
        })
      })

      if (entriesToCreate.length === 0 && entriesToUpdate.length === 0) {
        setCalendarMessage({ type: 'info', text: `All stops from "${itinerary.title}" are already in your calendar.` })
        return
      }

      const createResults = await Promise.all(entriesToCreate.map(entry =>
        apiFetch('/api/v1/calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry)
        })
      ))
      const updateResults = await Promise.all(entriesToUpdate.map(entry =>
        apiFetch(`/api/v1/calendar/${entry.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: entry.title,
            description: entry.description || null,
            location: entry.location,
            spotId: entry.spotId || null,
            startTime: entry.startTime,
            endTime: entry.endTime || null,
            recurrenceRule: entry.recurrenceRule || null,
            color: entry.color || '#6b7280'
          })
        })
      ))

      if ([...createResults, ...updateResults].some(res => !res.ok)) {
        throw new Error('One or more calendar entries could not be saved')
      }

      setCalendarMessage({
        type: 'success',
        text: `${entriesToCreate.length} stop${entriesToCreate.length === 1 ? '' : 's'} added and ${entriesToUpdate.length} location${entriesToUpdate.length === 1 ? '' : 's'} updated for "${itinerary.title}".`
      })
    } catch (err) {
      console.error('Add itinerary to calendar failed', err)
      setCalendarMessage({ type: 'error', text: 'Could not add this itinerary to calendar. Please try again.' })
    } finally {
      setAddingCalendarId(null)
    }
  }

  async function handlePurchaseCredits(packSize) {
    try {
      const res = await apiFetch('/api/v1/stripe/credits/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packSize, cancelUrl: window.location.href })
      })
      const data = await res.json()
      if (res.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      } else {
        toast.error(data.error || 'Payment checkout initialization failed')
      }
    } catch (e) {
      console.error(e)
      toast.error('Failed to connect to Stripe')
    }
  }

  async function handleSubscribe(tier) {
    try {
      const res = await apiFetch('/api/v1/stripe/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, cancelUrl: window.location.href })
      })
      const data = await res.json()
      if (res.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      } else {
        toast.error(data.error || 'Subscription checkout initialization failed')
      }
    } catch (e) {
      console.error(e)
      toast.error('Failed to connect to Stripe')
    }
  }

  if (loading) {
    return (
      <div className="itineraries-page">
        <div style={{ textAlign: 'center', padding: '4rem', color: '#999' }}>
          <div className="loading-spinner" />
          Loading itineraries...
        </div>
      </div>
    )
  }

  return (
    <div className="itineraries-page">
      <div className="itineraries-header">
        <div>
          <h1>My Itineraries</h1>
          <p className="page-subtitle">Plan your perfect day</p>
        </div>
        <Link to="/itineraries/plan" className="create-btn">
          Plan New Itinerary
        </Link>
      </div>

      {/* Account Status */}
      <div className="account-status">
        <div className="status-card">
          <div className="status-label">Credits</div>
          <div className="status-value credits">{credits}</div>
          <div className="status-actions">
            <button onClick={() => handlePurchaseCredits(pricing?.creditPackSmallQty || 5)}>
              Buy {pricing?.creditPackSmallQty || 5} (${pricing ? (pricing.creditPackSmallCents / 100).toFixed(2) : '7.99'})
            </button>
            <button onClick={() => handlePurchaseCredits(pricing?.creditPackLargeQty || 10)}>
              Buy {pricing?.creditPackLargeQty || 10} (${pricing ? (pricing.creditPackLargeCents / 100).toFixed(2) : '12.99'})
            </button>
          </div>
        </div>
        <div className="status-card">
          <div className="status-label">Subscription</div>
          <div className="status-value subscription">
            {subscription?.tier === 'NONE' ? 'Free' : subscription?.tier || 'Free'}
          </div>
          <div className="status-actions">
            {subscription?.tier && subscription.tier !== 'NONE' ? (
              subscription.tier !== 'UNLIMITED' && (
                <button onClick={() => handleSubscribe('UNLIMITED')}>
                  Upgrade to Unlimited
                </button>
              )
            ) : (
              <>
                <button onClick={() => handleSubscribe('PRO')}>
                  Pro $4.99/mo ({pricing?.proGenerationsLimit || 5} gens)
                </button>
                <button onClick={() => handleSubscribe('UNLIMITED')}>
                  Unlimited $9.99/mo
                </button>
              </>
            )}
          </div>
        </div>
        {subscription?.tier !== 'NONE' && subscription?.generationsLimit && (
          <div className="status-card">
            <div className="status-label">Generations This Month</div>
            <div className="status-value">
              {subscription.generationsUsed} / {subscription.generationsLimit === 2147483647 ? '∞' : subscription.generationsLimit}
            </div>
          </div>
        )}
      </div>

      {calendarMessage && (
        <div className={`calendar-message ${calendarMessage.type}`}>
          <span>{calendarMessage.text}</span>
          <button onClick={() => setCalendarMessage(null)} aria-label="Dismiss calendar message">Close</button>
        </div>
      )}

      {/* Itinerary List */}
      {itineraries.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🗺️</div>
          <h3>No itineraries yet</h3>
          <p>Create your first itinerary — plan it yourself for free, or let us generate one for you!</p>
          <Link to="/itineraries/plan" className="create-btn">
            Get Started
          </Link>
        </div>
      ) : (
        <div className="itineraries-grid">
          {itineraries.map(it => (
            <div
              key={it.id}
              className="itinerary-card"
              onClick={() => navigate(`/itineraries/${it.id}`)}
            >
              <div className={`card-icon ${it.source === 'GENERATED' ? 'generated' : 'manual'}`}>
                {it.source === 'GENERATED' ? '🤖' : '📝'}
              </div>
              <div className="card-body">
                <div className="card-title">{it.title}</div>
                <div className="card-meta">
                  <span>{it.date || 'No date'}</span>
                  <span>{it.stopCount} stop{it.stopCount !== 1 ? 's' : ''}</span>
                  <span className={`source-badge ${it.source === 'GENERATED' ? 'generated' : 'manual'}`}>
                    {it.source === 'GENERATED' ? '⚡ Generated' : 'Manual'}
                  </span>
                </div>
              </div>
              <div className="card-actions">
                <button
                  className="calendar-btn"
                  disabled={addingCalendarId === it.id}
                  onClick={(e) => handleAddToCalendar(e, it)}
                >
                  {addingCalendarId === it.id ? 'Adding...' : 'Add to calendar'}
                </button>
                <button
                  className="clone-btn"
                  disabled={cloningId === it.id}
                  onClick={(e) => handleClone(e, it)}
                >
                  {cloningId === it.id ? 'Cloning...' : 'Duplicate'}
                </button>
                <button
                  className="delete-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteTarget(it)
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* My Saved Spots link */}
      <Link to="/saved" className="my-saved-spots-link">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path>
        </svg>
        My Saved Spots
      </Link>

      {deleteTarget && (
        <div className="confirm-lightbox" role="dialog" aria-modal="true" aria-labelledby="delete-itinerary-title">
          <div className="confirm-dialog">
            <h3 id="delete-itinerary-title">Delete itinerary?</h3>
            <p>
              This will permanently remove "{deleteTarget.title}" and its timeline stops.
            </p>
            <div className="confirm-actions">
              <button className="confirm-secondary" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button className="confirm-danger" onClick={() => handleDelete(deleteTarget.id)}>
                Delete itinerary
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
