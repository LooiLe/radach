import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatRating } from './StarRating'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import PortalPopover from './PortalPopover'
import './SpotCard.css'

export default function SpotCard({ spot, rank, style }) {
  const navigate = useNavigate()
  const { apiFetch } = useApi()
  const { isAuthenticated } = useAuth()
  
  const [isLiked, setIsLiked] = useState(spot.isLiked || spot.liked || false)
  const [isSaved, setIsSaved] = useState(spot.isSaved || spot.saved || false)
  const [friendLikeCount, setFriendLikeCount] = useState(spot.friendLikeCount || 0)
  const [showFriendLikes, setShowFriendLikes] = useState(false)
  const [friendLikes, setFriendLikes] = useState([])
  const [loadingFriendLikes, setLoadingFriendLikes] = useState(false)
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 })
  const popoverRef = useRef(null)

  // Close popover on outside click using a ref-based approach
  useEffect(() => {
    if (!showFriendLikes) return

    const handleOutsideClick = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setShowFriendLikes(false)
      }
    }

    // Defer adding listener so the current click doesn't close it
    const timer = setTimeout(() => {
      document.addEventListener('click', handleOutsideClick)
    }, 0)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('click', handleOutsideClick)
    }
  }, [showFriendLikes])

  const handleLike = useCallback(async (e) => {
    e.stopPropagation()
    if (!isAuthenticated) return navigate('/login')
    const original = isLiked
    const originalCount = friendLikeCount
    setIsLiked(!original)
    try {
      await apiFetch(`/api/v1/spots/${spot.id}/like`, { method: 'POST' })
      if (isAuthenticated) {
        const res = await apiFetch(`/api/v1/spots/${spot.id}/friend-likes`, { method: 'GET' })
        if (res.ok) {
          const data = await res.json()
          setFriendLikes(data)
          setFriendLikeCount(data.length)
        }
      }
    } catch {
      setIsLiked(original)
      setFriendLikeCount(originalCount)
    }
  }, [isAuthenticated, apiFetch, spot.id, navigate, isLiked, friendLikeCount])

  const handleSave = useCallback(async (e) => {
    e.stopPropagation()
    if (!isAuthenticated) return navigate('/login')
    const original = isSaved || spot.saved
    setIsSaved(!original)
    try {
      const res = await apiFetch(`/api/v1/spots/${spot.id}/save`, { method: 'POST' })
      const data = await res.json()
      console.log('SAVE RESPONSE:', data)
    } catch {
      setIsSaved(original)
    }
  }, [isAuthenticated, apiFetch, spot.id, navigate, isSaved, spot.saved])

  const handleFriendLikesClick = useCallback(async (e) => {
    e.stopPropagation()
    if (!isAuthenticated || friendLikeCount === 0) return
    
    if (showFriendLikes) {
      setShowFriendLikes(false)
      return
    }
    
    // Capture button rect synchronously
    const rect = e.currentTarget.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const popoverHeight = 200
    const top = spaceBelow >= popoverHeight + 4
      ? rect.bottom + 4
      : rect.top - popoverHeight - 4
    setPopoverPos({
      top: Math.max(4, Math.min(top, window.innerHeight - popoverHeight - 4)),
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 208)),
    })
    
    setLoadingFriendLikes(true)
    setShowFriendLikes(true)
    try {
      const res = await apiFetch(`/api/v1/spots/${spot.id}/friend-likes`, { method: 'GET' })
      if (res.ok) {
        const data = await res.json()
        setFriendLikes(data)
      }
    } catch {
      // ignore
    } finally {
      setLoadingFriendLikes(false)
    }
  }, [isAuthenticated, friendLikeCount, showFriendLikes, apiFetch, spot.id])

  const categoryIcons = {
    Restaurant: '/icons/material-symbols-light--chef-hat-outline.svg',
    Bar: '/icons/guidance--bar.svg',
    Hotel: '/icons/material-symbols-light--bed-outline-rounded.svg',
    Stay: '/icons/material-symbols-light--bed-outline-rounded.svg',
    Beach: '/icons/fluent--beach-48-regular.svg',
    Café: '/icons/carbon--cafe.svg',
    Cafe: '/icons/carbon--cafe.svg',
    Activities: '/icons/material-symbols-light--attractions-outline-rounded.svg',
    Children: '/icons/material-symbols-light--child-hat-outline.svg',
    Market: '/icons/healthicons--market-stall-outline.svg',
    Viewpoint: '/icons/material-symbols-light--mountain-flag-outline.svg',
    Other: '/icons/stash--pin-location-light.svg',
    Others: '/icons/stash--pin-location-light.svg',
    Default: '/icons/stash--pin-location-light.svg',
  }
  const categoryIcon = categoryIcons[spot.type] || categoryIcons.Default

  return (
    <article
      className="spot-card glass"
      style={style}
      onClick={() => navigate(`/spot/${spot.id}`)}
    >
      <div className="spot-card-header">
        <div className="spot-card-title">
          {categoryIcon && (
            <img src={categoryIcon} alt={`${spot.type} icon`} className="spot-card-type-icon" />
          )}
          <div>
            <h3 className="spot-card-name">{spot.name}</h3>
            <p className="spot-card-meta">{spot.type} · {spot.address}</p>
          </div>
        </div>
      </div>
      <div className="spot-card-footer">
        <div className="spot-card-footer-top">
          <div className="spot-card-footer-left">
          <span className="spot-card-rating">{formatRating(spot.averageRating)}</span>
          {rank != null && (
            <span className={`rank-badge rank-${rank <= 3 ? rank : 'other'}`}>{rank}</span>
          )}
          {isAuthenticated && friendLikeCount > 0 && (
            <>
              <span className="spot-card-footer-divider">·</span>
              <button
                className="spot-card-friend-likes-btn"
                onClick={handleFriendLikesClick}
              >
                Liked by {friendLikeCount} {friendLikeCount === 1 ? 'friend' : 'friends'}
              </button>
            </>
          )}
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
        {spot.vibeTags?.length > 0 && (
          <div className="spot-card-tags">
            {spot.vibeTags.slice(0, 3).map(vt => (
              <span key={vt.id} className="spot-tag">
                {vt.emoji && <span style={{ marginRight: '0.15rem' }}>{vt.emoji}</span>}
                {vt.name}
              </span>
            ))}
          </div>
        )}
        {spot.tags?.length > 0 && (
          <div className="spot-card-tags">
            {spot.tags.slice(0, 3).map(t => <span key={t} className="spot-tag">{t}</span>)}
          </div>
        )}
        {showFriendLikes && (
          <PortalPopover
            ref={popoverRef}
            style={{ top: popoverPos.top, left: popoverPos.left }}
            onClick={e => e.stopPropagation()}
          >
            {loadingFriendLikes ? (
              <div className="spot-card-friend-likes-loading">Loading...</div>
            ) : friendLikes.length === 0 ? (
              <div className="spot-card-friend-likes-loading">No friends yet</div>
            ) : (
              <div className="spot-card-friend-likes-list">
                {friendLikes.map(friend => (
                  <div
                    key={friend.userId}
                    className="spot-card-friend-like-item"
                    onClick={() => navigate(`/profile/${friend.userId}`)}
                  >
                    <div className="spot-card-friend-like-avatar">
                      {friend.profilePicture ? (
                        <img src={friend.profilePicture} alt={friend.name} />
                      ) : (
                        <span>{friend.name?.charAt(0)?.toUpperCase() || '?'}</span>
                      )}
                    </div>
                    <span className="spot-card-friend-like-name">{friend.name}</span>
                  </div>
                ))}
              </div>
            )}
          </PortalPopover>
        )}
      </div>
    </article>
  )
}