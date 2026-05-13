import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import StarRating, { formatRating } from '../components/StarRating'
import './UserProfilePage.css'

export default function UserProfilePage() {
  const { id } = useParams()
  const { apiFetch } = useApi()
  const navigate = useNavigate()
  
  const [user, setUser] = useState(null)
  const [reviews, setReviews] = useState([])
  const [status, setStatus] = useState('Loading profile...')

  const loadData = useCallback(async () => {
    try {
      // Load user profile
      const userRes = await apiFetch(`/api/v1/users/${id}`)
      if (!userRes.ok) {
        setStatus('User not found.')
        return
      }
      const userData = await userRes.json()
      setUser(userData)

      // Load user reviews
      const reviewsRes = await apiFetch(`/api/v1/users/${id}/reviews`)
      if (reviewsRes.ok) {
        const reviewsData = await reviewsRes.json()
        setReviews(reviewsData.content || [])
        setStatus('')
      }
    } catch (e) {
      setStatus('Failed to load profile.')
    }
  }, [apiFetch, id])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (status && !user) {
    return <div className="user-profile-page"><div className="empty-state">{status}</div></div>
  }

  return (
    <div className="user-profile-page animate-fade-up">
      <button className="btn btn-ghost back-btn" onClick={() => navigate(-1)}>← Back</button>

      <div className="profile-header glass">
        <div className="profile-avatar">
          {user?.name?.charAt(0).toUpperCase()}
        </div>
        <div className="profile-info">
          <h1>{user?.name}</h1>
          <p>{user?.email}</p>
        </div>
      </div>

      <h2 className="section-heading">Reviews by {user?.name}</h2>

      <div className="user-reviews-list">
        {reviews.length === 0 && !status && (
          <div className="empty-state">This user hasn't written any approved reviews yet.</div>
        )}
        {reviews.map(r => (
          <div key={r.id} className="review-card glass">
            <div className="review-card-header">
              <Link to={`/spot/${r.spotId}`} className="reviewed-spot-link">
                {r.spotName}
              </Link>
              <StarRating value={r.rating} readonly size="1rem" />
            </div>
            <div className="reviewed-spot-meta">
              {r.spotType} · {r.spotAddress}
            </div>
            <p className="review-text">{r.body}</p>
            <p className="review-author">
              <span className={`badge ${r.reviewType === 'EXPERT' ? 'badge-active' : 'badge-pending'}`}>
                {r.reviewType === 'EXPERT' ? '👨‍🍳 Expert Review' : '👤 User Review'}
              </span>
              <span style={{ marginLeft: '1rem' }}>
                {new Date(r.createdAt).toLocaleDateString()}
              </span>
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
