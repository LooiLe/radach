import { useState, useEffect, useCallback } from 'react'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import SpotCard from '../components/SpotCard'
import './TrendingPage.css'

export default function TrendingPage() {
  const { apiFetch } = useApi()
  const { isAuthenticated } = useAuth()
  const [spots, setSpots] = useState([])
  const [status, setStatus] = useState('Loading trending spots...')
  const [activeTab, setActiveTab] = useState('global') // global, nearme, destination
  const [destinationQuery, setDestinationQuery] = useState('')
  const [trendingMode, setTrendingMode] = useState('personalized') // personalized, expert

  const fetchTrending = useCallback(async (lat, lng, radiusKm = 50) => {
    setStatus('Loading trending spots...')
    try {
      let url = '/api/v1/spots/trending'
      const params = new URLSearchParams()
      if (lat && lng) {
        params.append('lat', lat)
        params.append('lng', lng)
        params.append('radiusKm', radiusKm)
      }
      params.append('type', trendingMode)
      url += '?' + params.toString()
      const res = await apiFetch(url)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load trending.')
      setSpots(data)
      setStatus(`${data.length} trending spot${data.length === 1 ? '' : 's'}.`)
    } catch (e) {
      setStatus(e.message)
      setSpots([])
    }
  }, [apiFetch, trendingMode])

  useEffect(() => {
    if (activeTab === 'global') {
      fetchTrending()
    } else if (activeTab === 'nearme') {
      setStatus('Getting your location...')

      const fallbackToIpLocation = async (reason) => {
        setStatus(`HTML5 Geolocation unavailable (${reason}). Trying IP-based location...`)
        try {
          const res = await fetch('https://get.geojs.io/v1/ip/geo.json')
          const data = await res.json()
          if (data.latitude && data.longitude) {
            fetchTrending(parseFloat(data.latitude), parseFloat(data.longitude))
            setStatus(`Showing trending spots near ${data.city || 'your region'} (IP-based estimate).`)
          } else {
            throw new Error('Invalid IP data')
          }
        } catch (err) {
          setStatus('Unable to retrieve location. HTML5 Geolocation requires HTTPS, and IP fallback failed.')
          setSpots([])
        }
      }

      if (!navigator.geolocation) {
        fallbackToIpLocation('Requires HTTPS or localhost')
        return
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => fetchTrending(pos.coords.latitude, pos.coords.longitude),
        (err) => {
          fallbackToIpLocation(err.message || 'Permission denied')
        },
        { timeout: 5000, maximumAge: 60000 }
      )
    }
    // For 'destination', we wait for the user to search.
  }, [activeTab, fetchTrending])

  const handleDestinationSearch = async (e) => {
    e.preventDefault()
    if (!destinationQuery.trim()) return

    setStatus('Finding city...')
    setSpots([])
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(destinationQuery)}&format=json&limit=1`)
      const data = await res.json()

      if (data && data.length > 0) {
        const { lat, lon } = data[0]
        fetchTrending(lat, lon)
      } else {
        setStatus('City not found. Please try another name.')
      }
    } catch (e) {
      setStatus('Failed to search for city.')
    }
  }

  return (
    <div className="trending-page">
      <div className="trending-header animate-fade-up">
        <div>
          <h1 className="page-title"> Trending Spots</h1>
          <p className="text-sm text-secondary">
            {trendingMode === 'personalized'
              ? (isAuthenticated ? 'Personalized for you based on your friends' : 'Global trending spots')
              : 'Top spots based on expert reviews'}
          </p>
        </div>
      </div>

      <div className="mode-toggle animate-fade-up">
        <button
          className={`mode-btn ${trendingMode === 'personalized' ? 'active' : ''}`}
          onClick={() => setTrendingMode('personalized')}
        >
          Friends
        </button>
        <button
          className={`mode-btn ${trendingMode === 'expert' ? 'active' : ''}`}
          onClick={() => setTrendingMode('expert')}
        >
          Experts
        </button>
      </div>

      <div className="trending-controls animate-fade-up">
        <div className="trending-tabs">
          <button
            className={`tab-btn ${activeTab === 'global' ? 'active' : ''}`}
            onClick={() => setActiveTab('global')}
          >
            Global
          </button>
          <button
            className={`tab-btn ${activeTab === 'nearme' ? 'active' : ''}`}
            onClick={() => setActiveTab('nearme')}
          >
            Near me
          </button>
          <button
            className={`tab-btn ${activeTab === 'destination' ? 'active' : ''}`}
            onClick={() => { setActiveTab('destination'); setSpots([]); setStatus('Enter a destination to see local trends.') }}
          >
            ️ Destination
          </button>
        </div>

        {activeTab === 'destination' && (
          <form className="destination-search" onSubmit={handleDestinationSearch}>
            <input
              type="text"
              className="input"
              placeholder="e.g. Bangkok, Paris, Tokyo"
              value={destinationQuery}
              onChange={(e) => setDestinationQuery(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">Search</button>
          </form>
        )}
      </div>

      <p className="page-status animate-fade-in">{status}</p>

      <div className="trending-grid">
        {spots.map((s, i) => (
          <SpotCard key={s.id} spot={s} rank={i + 1} style={{ animationDelay: `${i * 0.05}s` }} />
        ))}
        {spots.length === 0 && !status.includes('Loading') && !status.includes('Getting') && !status.includes('Finding') && activeTab !== 'destination' && (
          <div className="empty-state" style={{ gridColumn: '1/-1' }}>No trending spots found here.</div>
        )}
      </div>
    </div>
  )
}
