import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import SpotCard from '../components/SpotCard'
import './SearchPage.css'

export default function SearchPage() {
  const { apiFetch } = useApi()
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [searchType, setSearchType] = useState('spots') // 'spots' or 'users'
  const [spots, setSpots] = useState([])
  const [users, setUsers] = useState([])
  const [status, setStatus] = useState('Enter a query above to search.')
  const [autocomplete, setAutocomplete] = useState([])
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const timer = useRef(null)
  const navigate = useNavigate()

  const doSearch = useCallback(async (q, type = searchType) => {
    setStatus(`Searching for "${q}"...`)
    setAutocomplete([])
    try {
      if (type === 'spots') {
        const res = await apiFetch(`/api/v1/spots/search?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Search failed.')
        setSpots(data)
        setStatus(`${data.length} result${data.length === 1 ? '' : 's'} for "${q}".`)
      } else {
        const res = await apiFetch(`/api/v1/friends/search-users?query=${encodeURIComponent(q)}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'User search failed.')
        setUsers(data)
        setStatus(`${data.length} user${data.length === 1 ? '' : 's'} found for "${q}".`)
      }
    } catch (e) { setStatus(e.message) }
  }, [apiFetch, searchType])

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) { setQuery(q); doSearch(q) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleInput = (q) => {
    setQuery(q)
    clearTimeout(timer.current)
    setHighlightIdx(-1)
    if (q.length < 1) { setAutocomplete([]); return }
    if (searchType === 'users') { setAutocomplete([]); return } // No autocomplete for users yet
    timer.current = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/v1/spots/search?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        if (res.ok) setAutocomplete((data || []).slice(0, 6))
      } catch { /* ignore */ }
    }, 200)
  }

  const handleKeyDown = (e) => {
    if (!autocomplete.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx(i => Math.min(i + 1, autocomplete.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && highlightIdx >= 0) { e.preventDefault(); selectItem(autocomplete[highlightIdx]) }
    else if (e.key === 'Escape') setAutocomplete([])
  }

  const selectItem = (item) => { setQuery(item.name); setAutocomplete([]); doSearch(item.name) }

  const handleSubmit = (e) => { e.preventDefault(); if (query.trim()) doSearch(query.trim()); setAutocomplete([]) }

  return (
    <div className="search-page">
      <div className="search-header animate-fade-up">
        <div className="search-tabs" style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <button className={`btn ${searchType === 'spots' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setSearchType('spots'); setSpots([]); setUsers([]); setStatus('Enter a query to find spots.') }}> Search Spots</button>
          <button className={`btn ${searchType === 'users' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setSearchType('users'); setSpots([]); setUsers([]); setStatus('Enter a name or email to find users.') }}> Search Users</button>
        </div>
        <form className="search-bar" onSubmit={handleSubmit}>
          <input className="input search-input" value={query} onChange={e => handleInput(e.target.value)}
            onKeyDown={handleKeyDown} onBlur={() => setTimeout(() => setAutocomplete([]), 180)}
            placeholder={searchType === 'users' ? "Search users by name or email..." : "Search spots by name or tag..."} autoFocus />
          <button className="btn btn-primary" type="submit">Search</button>
        </form>
        {autocomplete.length > 0 && (
          <div className="autocomplete-list">
            {autocomplete.map((s, i) => (
              <div key={s.id} className={`autocomplete-item ${i === highlightIdx ? 'highlighted' : ''}`}
                onClick={() => selectItem(s)}>
                <div className="ac-info">
                  <span className="ac-name">{s.name}</span>
                  <span className="ac-meta">{s.type} · {s.address}</span>
                </div>
                <span className="ac-pill">{s.type}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <p className="page-status">{status}</p>
      <div className="search-grid">
        {searchType === 'spots' ? (
          <>
            {spots.map((s, i) => <SpotCard key={s.id} spot={s} style={{ animationDelay: `${i * 0.04}s` }} />)}
            {spots.length === 0 && !status.includes('Loading') && !status.includes('Searching') && !status.includes('Enter') && (
              <div className="empty-state" style={{ gridColumn: '1/-1' }}>Try a different search term.</div>
            )}
          </>
        ) : (
          <div className="users-list" style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {users.map((u, i) => (
              <div key={u.id} className="user-card glass animate-fade-up" style={{ animationDelay: `${i * 0.04}s`, padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }} onClick={() => navigate(`/user/${u.id}`)}>
                <div className="profile-avatar" style={{ width: '50px', height: '50px', fontSize: '1.5rem', margin: 0 }}>
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ margin: '0 0 0.25rem 0' }}>{u.name}</h3>
                  <p style={{ margin: 0, color: 'var(--text-muted)' }}>{u.email}</p>
                </div>
              </div>
            ))}
            {users.length === 0 && !status.includes('Loading') && !status.includes('Searching') && !status.includes('Enter') && (
              <div className="empty-state">No users found.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
