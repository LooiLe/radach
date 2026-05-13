import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import StatusBadge from './StatusBadge'
import { formatRating } from './StarRating'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import './SpotCard.css'

export default function SpotCard({ spot, rank, style }) {
  const navigate = useNavigate()
  const { apiFetch } = useApi()
  const { isAuthenticated } = useAuth()
  
  const [isLiked, setIsLiked] = useState(spot.isLiked || spot.liked || false)
  const [isSaved, setIsSaved] = useState(spot.isSaved || spot.saved || false)

  const handleLike = async (e) => {
    e.stopPropagation()
    if (!isAuthenticated) return navigate('/login')
    const original = isLiked
    setIsLiked(!original)
    try {
      await apiFetch(`/api/v1/spots/${spot.id}/like`, { method: 'POST' })
    } catch (err) {
      setIsLiked(original)
    }
  }

  const handleSave = async (e) => {
    e.stopPropagation()
    if (!isAuthenticated) return navigate('/login')
    const original = isSaved || spot.saved
    setIsSaved(!original)
    try {
      const res = await apiFetch(`/api/v1/spots/${spot.id}/save`, { method: 'POST' })
      const data = await res.json()
      console.log('SAVE RESPONSE:', data)
    } catch (err) {
      setIsSaved(original)
    }
  }

  return (
    <article
      className="spot-card glass"
      style={style}
      onClick={() => navigate(`/spot/${spot.id}`)}
    >
      <div className="spot-card-header">
        <div>
          <h3 className="spot-card-name">{spot.name}</h3>
          <p className="spot-card-meta">{spot.type} · {spot.address}</p>
        </div>
        <div className="spot-card-actions">
          <button className={`action-btn ${isLiked ? 'active' : ''}`} onClick={handleLike} aria-label="Like spot">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={isLiked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
          </button>
          <button className={`action-btn ${isSaved ? 'active' : ''}`} onClick={handleSave} aria-label="Save spot">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path>
            </svg>
          </button>
        </div>
      </div>
      <div className="spot-card-footer">
        <div className="spot-card-footer-left">
          <span className="spot-card-rating">{formatRating(spot.averageRating)}</span>
          {rank != null ? (
            <span className={`rank-badge rank-${rank <= 3 ? rank : 'other'}`}>{rank}</span>
          ) : (
            <StatusBadge status={spot.status} />
          )}
        </div>
        {spot.tags?.length > 0 && (
          <div className="spot-card-tags">
            {spot.tags.slice(0, 3).map(t => <span key={t} className="spot-tag">{t}</span>)}
          </div>
        )}
      </div>
    </article>
  )
}
