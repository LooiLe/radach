import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import StarRating, { formatRating } from '../components/StarRating'
import './UserProfilePage.css'

export default function UserProfilePage() {
  const { id } = useParams()
  const { apiFetch } = useApi()
  const { userId, isExpert: authIsExpert, logout } = useAuth()
const navigate = useNavigate()
  
  const handleLogout = () => {
    logout()
    navigate('/login')
  }
   
  const [user, setUser] = useState(null)
  const [reviews, setReviews] = useState([])
  const [status, setStatus] = useState('Loading profile...')
  const isOwnProfile = userId && String(userId) === String(id)
  
  // Personal feed state
  const [personalFeed, setPersonalFeed] = useState([])
  const [feedLoading, setFeedLoading] = useState(false)
  const [feedTab, setFeedTab] = useState('all') // 'all' shows posts + reviews, 'posts' shows only posts, 'reviews' shows only reviews
  const [friendCount, setFriendCount] = useState(0)

  // Expert application form
  const [showApplyForm, setShowApplyForm] = useState(false)
  const [applyForm, setApplyForm] = useState({
    professionalTitle: '', organization: '', yearsExperience: '', specializations: '', portfolioUrl: '', justification: ''
  })
  const [applyMsg, setApplyMsg] = useState({ type: '', text: '' })
  const [myApplications, setMyApplications] = useState([])

  // Edit profile form (for experts and users)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editForm, setEditForm] = useState({
    bio: '', privateAccount: false, professionalTitle: '', organization: '', yearsExperience: '', specializations: '', portfolioUrl: ''
  })
  const [editMsg, setEditMsg] = useState({ type: '', text: '' })

  const loadData = useCallback(async () => {
    try {
      const userRes = await apiFetch(`/api/v1/users/${id}`)
      if (!userRes.ok) {
        setStatus('User not found.')
        return
      }
      const userData = await userRes.json()
      setUser(userData)

      // Pre-fill edit form
      setEditForm({
        bio: userData.bio || '',
        privateAccount: userData.privateAccount || false,
        professionalTitle: userData.professionalTitle || '',
        organization: userData.organization || '',
        yearsExperience: userData.yearsExperience || '',
        specializations: userData.specializations || '',
        portfolioUrl: userData.portfolioUrl || ''
      })

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

  const loadMyApplications = useCallback(async () => {
    if (!isOwnProfile) return
    try {
      const res = await apiFetch('/api/v1/expert-applications/me')
      if (res.ok) {
        const data = await res.json()
        setMyApplications(data)
      }
    } catch { /* ignore */ }
  }, [apiFetch, isOwnProfile])

  // Load personal feed for the profile user
  const loadPersonalFeed = useCallback(async () => {
    setFeedLoading(true)
    try {
      const res = await apiFetch(`/api/v1/feed?filter=user&targetUserId=${id}&limit=50`)
      if (res.ok) {
        setPersonalFeed(await res.json())
      }
    } catch { /* ignore */ }
    setFeedLoading(false)
  }, [apiFetch, id])

  const loadFriendCount = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v1/friends')
      if (res.ok) {
        const data = await res.json()
        setFriendCount(data.length)
      }
    } catch { /* ignore */ }
  }, [apiFetch])

  useEffect(() => {
    loadData()
    loadMyApplications()
    loadPersonalFeed()
    loadFriendCount()
  }, [loadData, loadMyApplications, loadPersonalFeed, loadFriendCount])

  const submitApplication = async () => {
    setApplyMsg({ type: '', text: '' })
    if (!applyForm.professionalTitle.trim() || !applyForm.justification.trim()) {
      setApplyMsg({ type: 'error', text: 'Title and justification are required.' })
      return
    }
    try {
      const res = await apiFetch('/api/v1/expert-applications', {
        method: 'POST',
        body: JSON.stringify({
          ...applyForm,
          yearsExperience: parseInt(applyForm.yearsExperience) || 0
        })
      })
      const data = await res.json()
      if (res.ok) {
        setApplyMsg({ type: 'success', text: 'Application submitted! An admin will review it.' })
        setShowApplyForm(false)
        loadMyApplications()
      } else {
        setApplyMsg({ type: 'error', text: data.message || data.error || 'Failed to submit.' })
      }
    } catch { setApplyMsg({ type: 'error', text: 'Server error.' }) }
  }

  const saveProfile = async () => {
    setEditMsg({ type: '', text: '' })
    try {
      const res = await apiFetch('/api/v1/users/me/profile', {
        method: 'PUT',
        body: JSON.stringify({
          ...editForm,
          yearsExperience: editForm.yearsExperience ? parseInt(editForm.yearsExperience) : null
        })
      })
      if (res.ok) {
        const data = await res.json()
        setUser(data)
        setEditMsg({ type: 'success', text: 'Profile updated!' })
        setShowEditForm(false)
      } else {
        setEditMsg({ type: 'error', text: 'Failed to update profile.' })
      }
    } catch { setEditMsg({ type: 'error', text: 'Server error.' }) }
  }

  if (status && !user) {
    return <div className="user-profile-page"><div className="empty-state">{status}</div></div>
  }

  const hasPendingApp = myApplications.some(a => a.status === 'PENDING')

  const timeAgo = (timestamp) => {
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
    <div className="user-profile-page animate-fade-up">
      <div className="profile-actions-row">
        <button className="btn btn-ghost back-btn" onClick={() => navigate(-1)}>← Back</button>
        {isOwnProfile && (
          <button className="btn btn-ghost" onClick={handleLogout} style={{ color: 'var(--text-error)' }}>Sign out</button>
        )}
      </div>

      <div className="profile-header glass">
        <div className="profile-avatar">
          {user?.name?.charAt(0).toUpperCase()}
        </div>
        <div className="profile-info">
          <h1>
            {isOwnProfile ? 'You' : user?.name}
            {user?.isExpert && <span className="badge badge-active" style={{ marginLeft: '0.75rem', fontSize: '0.8rem', verticalAlign: 'middle' }}>Expert</span>}
          </h1>
          <p>{user?.email}</p>
          {isOwnProfile && (
            <p style={{ marginTop: '0.5rem' }}>
              <Link to="/friends" className="friends-count-link" onClick={(e) => { e.stopPropagation(); }}>
                <strong>{friendCount}</strong> friend{friendCount !== 1 ? 's' : ''}
              </Link>
            </p>
          )}
          {user?.isExpert && user?.professionalTitle && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
              {user.professionalTitle}{user.organization ? ` at ${user.organization}` : ''}
            </p>
          )}
          {(user?.bio || isOwnProfile) && (
            <p style={{ marginTop: '1rem', lineHeight: 1.5, color: 'var(--text-primary)' }}>
              {user?.bio ? user.bio : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>(You haven't written a bio yet)</span>}
            </p>
          )}
        </div>
      </div>

      {/* Expert CV Section */}
      {user?.isExpert && (user?.specializations || user?.yearsExperience || user?.portfolioUrl) && (
        <div className="expert-cv glass" style={{ marginTop: '1.5rem', padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--primary)' }}>About this Expert</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            {user.yearsExperience != null && (
              <div className="cv-field">
                <span className="cv-label">Experience</span>
                <span className="cv-value">{user.yearsExperience} years</span>
              </div>
            )}
            {user.specializations && (
              <div className="cv-field">
                <span className="cv-label">Specializations</span>
                <span className="cv-value">{user.specializations}</span>
              </div>
            )}
            {user.portfolioUrl && (
              <div className="cv-field">
                <span className="cv-label">Portfolio</span>
                <a href={user.portfolioUrl} target="_blank" rel="noopener noreferrer" className="cv-value" style={{ color: 'var(--primary)' }}>
                  {user.portfolioUrl}
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Own Profile Actions */}
      {isOwnProfile && (
        <div style={{ marginTop: '1.5rem' }}>
          {/* Edit Profile (Bio for all, + CV for experts) */}
          {!showEditForm ? (
                <button className="btn btn-primary" onClick={() => setShowEditForm(true)}>Edit Profile</button>
              ) : (
                <div className="glass" style={{ padding: '1.5rem' }}>
                  <h3 style={{ marginBottom: '1rem' }}>Edit Your Profile</h3>
                  <div className="edit-profile-grid">
                    <div className="field" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <input 
                        type="checkbox" 
                        id="privateAccountToggle"
                        checked={editForm.privateAccount}
                        onChange={e => setEditForm({ ...editForm, privateAccount: e.target.checked })} 
                        style={{ marginTop: '0.15rem' }}
                      />
                      <label htmlFor="privateAccountToggle" style={{ margin: 0, fontWeight: 500 }}>
                        Private Account
                        <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400, marginTop: '0.1rem' }}>
                          Hide posts and activity from non-friends
                        </span>
                      </label>
                    </div>
                    <div className="field" style={{ gridColumn: '1 / -1' }}>
                      <label className="label">Bio</label>
                      <textarea className="textarea" value={editForm.bio} onChange={e => setEditForm({ ...editForm, bio: e.target.value })} maxLength={500} placeholder="Write something about yourself..." />
                    </div>
                    {user?.isExpert && (
                      <>
                        <div className="field">
                          <label className="label">Professional Title</label>
                          <input className="input" value={editForm.professionalTitle} onChange={e => setEditForm({ ...editForm, professionalTitle: e.target.value })} />
                        </div>
                        <div className="field">
                          <label className="label">Organization</label>
                          <input className="input" value={editForm.organization} onChange={e => setEditForm({ ...editForm, organization: e.target.value })} />
                        </div>
                        <div className="field">
                          <label className="label">Years of Experience</label>
                          <input className="input" type="number" value={editForm.yearsExperience} onChange={e => setEditForm({ ...editForm, yearsExperience: e.target.value })} />
                        </div>
                        <div className="field">
                          <label className="label">Specializations</label>
                          <input className="input" value={editForm.specializations} onChange={e => setEditForm({ ...editForm, specializations: e.target.value })} placeholder="e.g. Thai Cuisine, Street Food" />
                        </div>
                        <div className="field">
                          <label className="label">Portfolio / Social Link</label>
                          <input className="input" value={editForm.portfolioUrl} onChange={e => setEditForm({ ...editForm, portfolioUrl: e.target.value })} placeholder="https://..." />
                        </div>
                      </>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                    <button className="btn btn-primary" onClick={saveProfile}>Save</button>
                    <button className="btn btn-ghost" onClick={() => setShowEditForm(false)}>Cancel</button>
                  </div>
                  {editMsg.text && <div className={`msg msg-${editMsg.type}`} style={{ marginTop: '0.5rem' }}>{editMsg.text}</div>}
                </div>
              )}

          {/* Non-expert: Apply to become expert */}
          {!user?.isExpert && (
            <>
              {applyMsg.text && <div className={`msg msg-${applyMsg.type}`} style={{ marginBottom: '1rem' }}>{applyMsg.text}</div>}

              {hasPendingApp ? (
                <div className="glass" style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Your expert application is pending review.
                </div>
              ) : !showApplyForm ? (
                <button className="btn btn-primary" onClick={() => setShowApplyForm(true)}>Apply to become an Expert</button>
              ) : (
                <div className="glass" style={{ padding: '1.5rem' }}>
                  <h3 style={{ marginBottom: '1rem' }}>Expert Application</h3>
                  <div className="edit-profile-grid">
                    <div className="field">
                      <label className="label">Professional Title *</label>
                      <input className="input" value={applyForm.professionalTitle} onChange={e => setApplyForm({ ...applyForm, professionalTitle: e.target.value })} placeholder="e.g. Food Critic, Chef" />
                    </div>
                    <div className="field">
                      <label className="label">Organization</label>
                      <input className="input" value={applyForm.organization} onChange={e => setApplyForm({ ...applyForm, organization: e.target.value })} placeholder="e.g. Bangkok Post, Freelance" />
                    </div>
                    <div className="field">
                      <label className="label">Years of Experience *</label>
                      <input className="input" type="number" min="0" value={applyForm.yearsExperience} onChange={e => setApplyForm({ ...applyForm, yearsExperience: e.target.value })} />
                    </div>
                    <div className="field">
                      <label className="label">Specializations</label>
                      <input className="input" value={applyForm.specializations} onChange={e => setApplyForm({ ...applyForm, specializations: e.target.value })} placeholder="e.g. Thai Cuisine, Street Food" />
                    </div>
                    <div className="field">
                      <label className="label">Portfolio / Social Link</label>
                      <input className="input" value={applyForm.portfolioUrl} onChange={e => setApplyForm({ ...applyForm, portfolioUrl: e.target.value })} placeholder="https://..." />
                    </div>
                    <div className="field" style={{ gridColumn: '1 / -1' }}>
                      <label className="label">Why should you be an expert? *</label>
                      <textarea className="textarea" value={applyForm.justification} onChange={e => setApplyForm({ ...applyForm, justification: e.target.value })} maxLength={500} placeholder="Describe your credentials and why your reviews should carry expert weight..." />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                    <button className="btn btn-primary" onClick={submitApplication}>Submit Application</button>
                    <button className="btn btn-ghost" onClick={() => setShowApplyForm(false)}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Show past applications */}
              {myApplications.length > 0 && !hasPendingApp && (
                <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {myApplications.filter(a => a.status === 'REJECTED').length > 0 && (
                    <p>Your previous application was not approved. You may apply again.</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Personal Feed Section - replaces the separate reviews section */}
      <h2 className="section-heading">{isOwnProfile ? 'My Activity' : `${user?.name}'s Activity`}</h2>

      <div className="profile-feed-tabs">
        {['all', 'posts', 'reviews'].map(tab => (
          <div
            key={tab}
            className={`profile-feed-tab ${feedTab === tab ? 'active' : ''}`}
            onClick={() => setFeedTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </div>
        ))}
      </div>

      <div className="profile-feed-list">
        {feedLoading ? (
          <div className="feed-loading">
            <div className="spinner" />
            <p>Loading activity...</p>
          </div>
        ) : personalFeed.length === 0 ? (
          <div className="empty-state">No activity yet.</div>
        ) : (
          (() => {
            let filteredFeed = personalFeed
            if (feedTab === 'posts') {
              filteredFeed = filteredFeed.filter(item => item.activityType === 'POST')
            } else if (feedTab === 'reviews') {
              filteredFeed = filteredFeed.filter(item => item.activityType === 'REVIEW')
            }
            if (filteredFeed.length === 0) {
              return <div className="empty-state">No {feedTab === 'posts' ? 'posts' : feedTab === 'reviews' ? 'reviews' : 'activity'} yet.</div>
            }
            return filteredFeed.map((item, i) => (
              <div key={`${item.activityType}-${item.postId || item.spotId}-${i}`} className="profile-feed-item glass">
                <div className="profile-feed-item-header">
                  <span className="profile-feed-item-tag">
                    {item.activityType === 'POST' ? '📝 Post' : item.activityType === 'REVIEW' ? '⭐ Review' : item.activityType === 'LIKE' ? '❤️ Liked' : item.activityType === 'SAVE' ? '🔖 Saved' : '👁️ Viewed'}
                  </span>
                  <span className="profile-feed-item-time">{timeAgo(item.timestamp)}</span>
                </div>

                {item.activityType === 'POST' ? (
                  <>
                    {item.description && <p className="profile-feed-item-content">{item.description}</p>}
                    {item.mediaUrls && item.mediaUrls.length > 0 && (
                      <div className="profile-feed-item-images">
                        {item.mediaUrls.map(url => (
                          <img key={url} src={url} alt="Post media" />
                        ))}
                      </div>
                    )}
                    {item.spotId && (
                      <Link to={`/spot/${item.spotId}`} className="profile-feed-item-spot-link">
                        📍 {item.spotName || 'Linked spot'}
                      </Link>
                    )}
                    <div className="feed-item-footer">
                      <span className="feed-action-btn" style={{ cursor: 'default' }}>
                        {item.hasLiked ? '❤️' : '🤍'} {item.likeCount} Likes
                      </span>
                      <span className="feed-action-btn" style={{ cursor: 'default' }}>
                        💬 {item.comments?.length || 0} Comments
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    {item.description !== 'viewed' && item.description !== 'saved' && item.description !== 'liked' && (
                      <p className="profile-feed-item-content">{item.description}</p>
                    )}
                    <Link to={`/spot/${item.spotId}`} className="profile-feed-item-spot-link">
                      📍 {item.spotName} {item.spotAddress ? `· ${item.spotAddress}` : ''}
                    </Link>
                  </>
                )}
              </div>
            ))
          })()
        )}
      </div>

    </div>
  )
}
