import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import StarRating, { formatRating } from '../components/StarRating'
import './UserProfilePage.css'

export default function UserProfilePage() {
  const { id } = useParams()
  const { apiFetch } = useApi()
  const { userId, isExpert: authIsExpert } = useAuth()
  const navigate = useNavigate()
  
  const [user, setUser] = useState(null)
  const [reviews, setReviews] = useState([])
  const [status, setStatus] = useState('Loading profile...')
  const isOwnProfile = userId && String(userId) === String(id)

  // Expert application form
  const [showApplyForm, setShowApplyForm] = useState(false)
  const [applyForm, setApplyForm] = useState({
    professionalTitle: '', organization: '', yearsExperience: '', specializations: '', portfolioUrl: '', justification: ''
  })
  const [applyMsg, setApplyMsg] = useState({ type: '', text: '' })
  const [myApplications, setMyApplications] = useState([])

  // Edit profile form (for experts)
  const [showEditForm, setShowEditForm] = useState(false)
  const [editForm, setEditForm] = useState({
    bio: '', professionalTitle: '', organization: '', yearsExperience: '', specializations: '', portfolioUrl: ''
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

  useEffect(() => {
    loadData()
    loadMyApplications()
  }, [loadData, loadMyApplications])

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

  return (
    <div className="user-profile-page animate-fade-up">
      <button className="btn btn-ghost back-btn" onClick={() => navigate(-1)}>← Back</button>

      <div className="profile-header glass">
        <div className="profile-avatar">
          {user?.name?.charAt(0).toUpperCase()}
        </div>
        <div className="profile-info">
          <h1>
            {user?.name}
            {user?.isExpert && <span className="badge badge-active" style={{ marginLeft: '0.75rem', fontSize: '0.8rem', verticalAlign: 'middle' }}>Expert</span>}
          </h1>
          <p>{user?.email}</p>
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
                    <div className="field">
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
                {r.reviewType === 'EXPERT' ? 'Expert Review' : 'User Review'}
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
