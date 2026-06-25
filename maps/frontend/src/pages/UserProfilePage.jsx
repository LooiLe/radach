import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/ToastProvider'
import StarRating, { formatRating } from '../components/StarRating'
import '../components/ReportModal.css'
import './UserProfilePage.css'
import './OnboardingPage.css'

export default function UserProfilePage() {
  const { id } = useParams()
  const { apiFetch } = useApi()
  const { userId, isExpert: authIsExpert, logout } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  
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
  const profileTabs = ['all', 'posts', 'reviews', 'spots', 'events', 'journeys']
  const initialFeedTab = profileTabs.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'all'
  const [feedTab, setFeedTab] = useState(initialFeedTab)
  const [friendCount, setFriendCount] = useState(0)
  
  // Submitted items state
  const [submittedSpots, setSubmittedSpots] = useState([])
  const [submittedEvents, setSubmittedEvents] = useState([])
  const [submittedJourneys, setSubmittedJourneys] = useState([])
  const [submittedLoading, setSubmittedLoading] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)

  const INTERESTS = [
    { label: 'Coffee', emoji: '☕', value: 'coffee' },
    { label: 'Photography', emoji: '📷', value: 'photography' },
    { label: 'Food', emoji: '🍽️', value: 'food' },
    { label: 'Alcohol', emoji: '🍷', value: 'alcohol' },
    { label: 'Exquisite Food', emoji: '🥘', value: 'exquisite food' },
    { label: 'Travelling', emoji: '✈️', value: 'travelling' },
    { label: 'Hiking', emoji: '🏔️', value: 'hiking' },
    { label: 'Beach', emoji: '🏖️', value: 'beach' },
    { label: 'Museum', emoji: '🏛️', value: 'museum' },
    { label: 'Nightlife', emoji: '🌃', value: 'nightlife' },
    { label: 'Shopping', emoji: '🛍️', value: 'shopping' },
    { label: 'Fitness', emoji: '🏋️', value: 'fitness' },
  ]

  // Expert application form
  const [showApplyForm, setShowApplyForm] = useState(false)
  const [applyForm, setApplyForm] = useState({
    professionalTitle: '', organization: '', yearsExperience: '', specializations: '', portfolioUrl: '', justification: ''
  })
  const [applyMsg, setApplyMsg] = useState({ type: '', text: '' })
  const [myApplications, setMyApplications] = useState([])

  // Edit profile form (for experts and users)
  // Friend request state
  const [friendRequestStatus, setFriendRequestStatus] = useState(null)
  const [friendshipId, setFriendshipId] = useState(null)
  const friendshipIdRef = useRef(null)
  friendshipIdRef.current = friendshipId

   const handleFriendAction = useCallback(async () => {
     if (friendRequestStatus === 'sent') {
       // Cancel
       const fid = friendshipIdRef.current
       if (fid) {
         try {
           const res = await apiFetch(`/api/v1/friends/${fid}`, { method: 'DELETE' })
           if (res.ok) {
             setFriendRequestStatus(null)
             setFriendshipId(null)
           } else {
             console.error('Failed to cancel friend request:', res.status, res.statusText)
           }
         } catch (error) {
           console.error('Failed to cancel friend request:', error)
         }
       }
     } else {
       // Send
       try {
         const res = await apiFetch(`/api/v1/friends/request/${id}`, { method: 'POST' })
         if (res.ok) {
           const data = await res.json()
           setFriendshipId(data.id)
           setFriendRequestStatus('sent')
         } else {
           console.error('Failed to send friend request:', res.status, res.statusText)
         }
       } catch (error) {
         console.error('Failed to send friend request:', error)
       }
     }
   }, [friendRequestStatus, apiFetch, id])

  // Collapsible likes/comments on posts
  const [showPostLikes, setShowPostLikes] = useState({})
  const [showPostComments, setShowPostComments] = useState({})

  const [showEditForm, setShowEditForm] = useState(false)
  const [showInterestsForm, setShowInterestsForm] = useState(false)
  const [selectedInterests, setSelectedInterests] = useState([])
  const [savingInterests, setSavingInterests] = useState(false)
  const [editForm, setEditForm] = useState({
    bio: '', privateAccount: false, professionalTitle: '', organization: '', yearsExperience: '', specializations: '', portfolioUrl: '', profilePicture: ''
  })
  const [editMsg, setEditMsg] = useState({ type: '', text: '' })
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmPassword, setDeleteConfirmPassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)

  const handleDeleteAccount = async (e) => {
    e.preventDefault()
    setDeletingAccount(true)
    setDeleteError('')
    try {
      const res = await apiFetch('/api/v1/users/me', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deleteConfirmPassword })
      })
      if (res.ok) {
        logout()
        navigate('/login')
        toast.success('Your account has been deleted successfully.')
      } else {
        const data = await res.json()
        setDeleteError(data.error || 'Failed to delete account.')
      }
    } catch {
      setDeleteError('Network error. Please try again.')
    } finally {
      setDeletingAccount(false)
    }
  }

  const loadData = useCallback(async () => {
    try {
      const userRes = await apiFetch(`/api/v1/users/${id}`)
      if (!userRes.ok) {
        setStatus('User not found.')
        return
      }
      const userData = await userRes.json()
      setUser(userData)

      // Pre-fill interests
      setSelectedInterests(userData.interests || [])

      // Pre-fill edit form
      setEditForm({
        bio: userData.bio || '',
        privateAccount: userData.privateAccount || false,
        professionalTitle: userData.professionalTitle || '',
        organization: userData.organization || '',
        yearsExperience: userData.yearsExperience || '',
        specializations: userData.specializations || '',
        portfolioUrl: userData.portfolioUrl || '',
        profilePicture: userData.profilePicture || ''
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

  const loadSubmittedItems = useCallback(async () => {
    setSubmittedLoading(true)
    try {
      const [spotsRes, eventsRes, journeysRes] = await Promise.all([
        apiFetch(`/api/v1/users/${id}/submitted-spots`),
        apiFetch(`/api/v1/users/${id}/submitted-events`),
        apiFetch(`/api/v1/users/${id}/submitted-journeys`)
      ])
      if (spotsRes.ok) setSubmittedSpots(await spotsRes.json())
      if (eventsRes.ok) setSubmittedEvents(await eventsRes.json())
      if (journeysRes.ok) setSubmittedJourneys(await journeysRes.json())
    } catch { /* ignore */ }
    setSubmittedLoading(false)
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

  const loadFollowInfo = useCallback(async () => {
    if (!id || !userId) return
    try {
      const res = await apiFetch(`/api/v1/follows/check/${id}`)
      if (res.ok) {
        const data = await res.json()
        setIsFollowing(data.following)
        setFollowerCount(data.followerCount)
      }
    } catch { /* ignore */ }
  }, [apiFetch, id, userId, isOwnProfile])

  const handleFollowToggle = useCallback(async () => {
    try {
      if (isFollowing) {
        const res = await apiFetch(`/api/v1/follows/${id}`, { method: 'DELETE' })
        if (res.ok) {
          setIsFollowing(false)
          setFollowerCount(prev => Math.max(0, prev - 1))
        }
      } else {
        const res = await apiFetch(`/api/v1/follows/${id}`, { method: 'POST' })
        if (res.ok) {
          setIsFollowing(true)
          setFollowerCount(prev => prev + 1)
        }
      }
    } catch { /* ignore */ }
  }, [apiFetch, id, isFollowing])

  useEffect(() => {
    loadData()
    loadMyApplications()
    loadPersonalFeed()
    loadFriendCount()
    loadFollowInfo()
    loadSubmittedItems()
  }, [loadData, loadMyApplications, loadPersonalFeed, loadFriendCount, loadFollowInfo, loadSubmittedItems])

  useEffect(() => {
    const nextTab = profileTabs.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'all'
    setFeedTab(nextTab)
  }, [searchParams])

  const changeFeedTab = (nextTab) => {
    setFeedTab(nextTab)
    setSearchParams(nextTab === 'all' ? {} : { tab: nextTab })
  }

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
        window.dispatchEvent(new CustomEvent('profilePictureUpdated', { detail: data.profilePicture }))
      } else {
        setEditMsg({ type: 'error', text: 'Failed to update profile.' })
      }
    } catch { setEditMsg({ type: 'error', text: 'Server error.' }) }
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
        {!isOwnProfile && user && (
          <div className="profile-friend-action" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {user?.isExpert && (
              <button
                className={`btn ${isFollowing ? 'btn-outline' : 'btn-primary'} btn-sm`}
                onClick={handleFollowToggle}
              >
                {isFollowing ? 'Followed ✓' : 'Follow'}
              </button>
            )}
            {user.isFriend ? (
              <span className="badge badge-ghost">Friends</span>
            ) : (
              <button
                className={`btn ${friendRequestStatus === 'sent' ? 'btn-outline' : 'btn-primary'} btn-sm`}
                onClick={handleFriendAction}
              >
                {friendRequestStatus === 'sent' ? 'Sent ✓' : 'Add Friend'}
              </button>
            )}
          </div>
        )}
        {isOwnProfile && (
          <button className="btn btn-ghost" onClick={handleLogout} style={{ color: 'var(--text-error)' }}>Sign out</button>
        )}
      </div>

      <div className="profile-header glass">
        <div className="profile-avatar" style={{ position: 'relative', overflow: 'hidden' }}>
          {user?.profilePicture ? (
            <img src={user.profilePicture} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            user?.name?.charAt(0).toUpperCase()
          )}
        </div>
        <div className="profile-info">
          <h1>
            {isOwnProfile ? 'You' : user?.name}
            {user?.isExpert && <span className="badge badge-active" style={{ marginLeft: '0.75rem', fontSize: '0.8rem', verticalAlign: 'middle' }}>Expert</span>}
            {(user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') && <span className="badge badge-role" style={{ marginLeft: '0.5rem', fontSize: '0.8rem', verticalAlign: 'middle' }}>Admin</span>}
          </h1>
          <p>{user?.email}</p>
          {isOwnProfile && (
            <p style={{ marginTop: '0.5rem' }}>
              {user?.isExpert && (
                <span style={{ marginRight: '1rem' }}>
                  <strong>{followerCount}</strong> follower{followerCount !== 1 ? 's' : ''}
                </span>
              )}
              <Link to="/friends" className="friends-count-link" onClick={(e) => { e.stopPropagation(); }}>
                <strong>{friendCount}</strong> friend{friendCount !== 1 ? 's' : ''}
              </Link>
            </p>
          )}
          {!isOwnProfile && user?.isExpert && (
            <p style={{ marginTop: '0.5rem' }}>
              <span style={{ marginRight: '1rem' }}>
                <strong>{followerCount}</strong> follower{followerCount !== 1 ? 's' : ''}
              </span>
              <span>
                <strong>{friendCount}</strong> friend{friendCount !== 1 ? 's' : ''}
              </span>
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
                <button className="btn btn-primary" onClick={() => {
                  setEditForm({
                    bio: user?.bio || '',
                    privateAccount: user?.privateAccount || false,
                    professionalTitle: user?.professionalTitle || '',
                    organization: user?.organization || '',
                    yearsExperience: user?.yearsExperience || '',
                    specializations: user?.specializations || '',
                    portfolioUrl: user?.portfolioUrl || '',
                    profilePicture: user?.profilePicture || ''
                  })
                  setShowEditForm(true)
                }}>Edit Profile</button>
              ) : (
                <div className="glass" style={{ padding: '1.5rem' }}>
                  <h3 style={{ marginBottom: '1rem' }}>Edit Your Profile</h3>
                  <div className="edit-profile-grid">
                    <div className="field" style={{ gridColumn: '1 / -1' }}>
                      <label className="label">Profile Picture</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ width: '60px', height: '60px', borderRadius: '50%', overflow: 'hidden', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', color: 'var(--text-primary)', flexShrink: 0, border: '1px solid var(--border)' }}>
                          {(editForm.profilePicture || (editForm.profilePicture === '' ? false : user?.profilePicture)) ? <img src={editForm.profilePicture || user?.profilePicture} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="Avatar" /> : user?.name?.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <label className="btn btn-secondary" style={{ cursor: 'pointer', margin: 0, padding: '0.5rem 1rem' }}>
                            Upload New Photo
                            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                              const file = e.target.files[0];
                              if (!file) return;
                              const formData = new FormData();
                              formData.append('file', file);
                              try {
                                const uploadRes = await apiFetch('/api/v1/upload', { method: 'POST', body: formData });
                                if (!uploadRes.ok) throw new Error('Upload failed');
                                const { url } = await uploadRes.json();
                                setEditForm({ ...editForm, profilePicture: url });
                              } catch (err) { toast.error('Failed to upload picture.'); }
                            }} />
                          </label>
                          {(editForm.profilePicture || (editForm.profilePicture === '' ? false : user?.profilePicture)) && (
                            <button type="button" className="btn btn-ghost" style={{ color: 'var(--error)', fontSize: '0.85rem' }} onClick={() => {
                              setEditForm({ ...editForm, profilePicture: '' });
                            }}>Remove</button>
                          )}
                        </div>
                      </div>
                    </div>
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
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-primary" onClick={saveProfile}>Save</button>
                      <button className="btn btn-ghost" onClick={() => setShowEditForm(false)}>Cancel</button>
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setShowDeleteModal(true); setDeleteConfirmPassword(''); setDeleteError(''); }} style={{ color: 'var(--text-error)', border: '1px solid var(--text-error)', background: 'transparent' }}>
                      Delete Account
                    </button>
                  </div>
                  {editMsg.text && <div className={`msg msg-${editMsg.type}`} style={{ marginTop: '0.5rem' }}>{editMsg.text}</div>}
                </div>
              )}

          {/* Edit Interests */}
          {!showInterestsForm ? (
            <button className="btn btn-primary" style={{ marginLeft: '0.5rem' }} onClick={() => setShowInterestsForm(true)}>Edit Interests</button>
          ) : (
            <div className="glass" style={{ padding: '1.5rem', marginTop: '1rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>Edit Your Interests</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                Your interests personalize the Discover page. Select what you love!
              </p>
              <div className="interests-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                {INTERESTS.map(interest => (
                  <button
                    key={interest.value}
                    className={`interest-chip ${selectedInterests.includes(interest.value) ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedInterests(prev =>
                        prev.includes(interest.value) ? prev.filter(i => i !== interest.value) : [...prev, interest.value]
                      )
                    }}
                  >
                    {interest.emoji} {interest.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-primary" disabled={savingInterests} onClick={async () => {
                  setSavingInterests(true)
                  try {
                    const res = await apiFetch('/api/v1/users/me/interests', {
                      method: 'PUT',
                      body: JSON.stringify({ interests: selectedInterests })
                    })
                    if (res.ok) {
                      localStorage.setItem('interests', selectedInterests.join(','))
                      toast.success('Interests updated!')
                      setShowInterestsForm(false)
                    } else {
                      toast.error('Failed to update interests.')
                    }
                  } catch { toast.error('Server error.') }
                  finally { setSavingInterests(false) }
                }}>
                  {savingInterests ? 'Saving...' : 'Save Interests'}
                </button>
                <button className="btn btn-ghost" onClick={() => {
                  setSelectedInterests(user?.interests || [])
                  setShowInterestsForm(false)
                }}>Cancel</button>
              </div>
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
        {profileTabs.map(tab => (
          <div
            key={tab}
            className={`profile-feed-tab ${feedTab === tab ? 'active' : ''}`}
            onClick={() => changeFeedTab(tab)}
          >
            {tab === 'spots' ? 'My Spots' : tab === 'events' ? 'My Events' : tab === 'journeys' ? 'My Journeys' : tab.charAt(0).toUpperCase() + tab.slice(1)}
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
            let filteredFeed = personalFeed.filter(item => item.activityType !== 'VIEW')
            if (feedTab === 'posts') {
              filteredFeed = filteredFeed.filter(item => item.activityType === 'POST')
            } else if (feedTab === 'reviews') {
              filteredFeed = filteredFeed.filter(item => item.activityType === 'REVIEW')
            } else if (feedTab === 'spots' || feedTab === 'events' || feedTab === 'journeys') {
              // These tabs have their own content below
              return null
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
                    {(item.linkedSpots || (item.spotId ? [{id: item.spotId, name: item.spotName}] : [])).map(s => (
                      <Link key={s.id} to={`/spot/${s.id}`} className="profile-feed-item-spot-link">
                        📍 {s.name || 'Linked spot'}
                      </Link>
                    ))}
                    {(item.linkedEvents || (item.eventId ? [{id: item.eventId, title: item.eventName}] : [])).map(e => (
                      <Link key={e.id} to={`/event/${e.id}`} className="profile-feed-item-spot-link">
                        📅 {e.title || 'Linked event'}
                      </Link>
                    ))}
                    {(item.linkedJourneys || (item.journeyId ? [{id: item.journeyId, name: item.journeyName}] : [])).map(j => (
                      <Link key={j.id} to={`/journey/${j.id}`} className="profile-feed-item-spot-link">
                        🥾 {j.name || 'Linked journey'}
                      </Link>
                    ))}
                <div className="feed-item-footer">
                      <span
                        className={`feed-action-btn ${showPostLikes[item.postId] ? 'active' : ''}`}
                        onClick={() => setShowPostLikes({ ...showPostLikes, [item.postId]: !showPostLikes[item.postId] })}
                        style={{ cursor: 'pointer' }}
                      >
                        {item.hasLiked ? '❤️' : '🤍'} {item.likeCount} Likes
                      </span>
                      <span
                        className={`feed-action-btn ${showPostComments[item.postId] ? 'active' : ''}`}
                        onClick={() => setShowPostComments({ ...showPostComments, [item.postId]: !showPostComments[item.postId] })}
                        style={{ cursor: 'pointer' }}
                      >
                        💬 {item.comments?.length || 0} Comments
                      </span>
                    </div>
                    {showPostLikes[item.postId] && item.likers && item.likers.length > 0 && (
                      <div className="profile-feed-likers">
                        {item.likers.map(liker => (
                          <Link key={liker.userId} to={`/user/${liker.userId}`} className="liker-name">
                            {liker.userName}
                          </Link>
                        ))}
                      </div>
                    )}
                    {showPostComments[item.postId] && item.comments && item.comments.length > 0 && (
                      <div className="profile-feed-comments">
                        {item.comments.map(c => (
                          <div key={c.id} className="profile-comment-item">
                            <Link to={`/user/${c.authorId}`} className="comment-author">{c.authorName}</Link>
                            <span>{c.content}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {item.description !== 'viewed' && item.description !== 'saved' && item.description !== 'liked' && (
                      <p className="profile-feed-item-content">{item.description}</p>
                    )}
                    {item.mediaUrls && item.mediaUrls.length > 0 && (
                      <div className="profile-feed-item-images" style={{ marginBottom: '0.5rem' }}>
                        {item.mediaUrls.map(url => (
                          <img key={url} src={url} alt="Review media" />
                        ))}
                      </div>
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

        {/* Submitted Items Tabs */}
        {feedTab === 'spots' && (
          <div className="profile-submitted-list">
            {submittedLoading ? (
              <div className="feed-loading"><div className="spinner" /><p>Loading spots...</p></div>
            ) : submittedSpots.length === 0 ? (
              <div className="empty-state">No spots submitted yet.</div>
            ) : (
              submittedSpots.map(spot => (
                <Link key={spot.id} to={`/spot/${spot.id}`} className="profile-submitted-item glass">
                  <div className="profile-submitted-item-info">
                    <span className="profile-submitted-item-name">📍 {spot.name}</span>
                    <span className="profile-submitted-item-meta">{spot.type} {spot.address ? `· ${spot.address}` : ''}</span>
                  </div>
                  <span className={`profile-submitted-item-status status-${spot.status?.toLowerCase()}`}>{spot.status}</span>
                </Link>
              ))
            )}
          </div>
        )}

        {feedTab === 'events' && (
          <div className="profile-submitted-list">
            {submittedLoading ? (
              <div className="feed-loading"><div className="spinner" /><p>Loading events...</p></div>
            ) : submittedEvents.length === 0 ? (
              <div className="empty-state">No events submitted yet.</div>
            ) : (
              submittedEvents.map(evt => (
                <Link key={evt.id} to={`/event/${evt.id}`} className="profile-submitted-item glass">
                  <div className="profile-submitted-item-info">
                    <span className="profile-submitted-item-name">📅 {evt.title}</span>
                  </div>
                  <span className={`profile-submitted-item-status status-${evt.status?.toLowerCase()}`}>{evt.status}</span>
                </Link>
              ))
            )}
          </div>
        )}

        {feedTab === 'journeys' && (
          <div className="profile-submitted-list">
            {submittedLoading ? (
              <div className="feed-loading"><div className="spinner" /><p>Loading journeys...</p></div>
            ) : submittedJourneys.length === 0 ? (
              <div className="empty-state">No journeys submitted yet.</div>
            ) : (
              submittedJourneys.map(journey => (
                <Link key={journey.id} to={`/journey/${journey.id}`} className="profile-submitted-item glass">
                  <div className="profile-submitted-item-info">
                    <span className="profile-submitted-item-name">🥾 {journey.name}</span>
                  </div>
                  <span className={`profile-submitted-item-status status-${journey.status?.toLowerCase()}`}>{journey.status}</span>
                </Link>
              ))
            )}
          </div>
        )}
      </div>

      {showDeleteModal && (
        <div className="report-modal-overlay" onClick={() => { if (!deletingAccount) setShowDeleteModal(false); }}>
          <div className="report-modal-content glass animate-fade-up" onClick={(e) => e.stopPropagation()}>
            <button className="report-modal-close" onClick={() => { if (!deletingAccount) setShowDeleteModal(false); }}>✕</button>
            <h2 className="report-modal-title" style={{ color: 'var(--text-error)' }}>⚠️ Delete Account</h2>
            <p className="report-modal-sub">
              This action will permanently delete your personal profile details. All your friendships, likes, notifications, and saves will be deleted. Any reviews or trail paths you created will remain but will be anonymized under "Deleted User".
            </p>
            {deleteError && <div className="msg msg-error" style={{ marginBottom: '1rem' }}>{deleteError}</div>}
            <form onSubmit={handleDeleteAccount} className="report-modal-form">
              <div className="field">
                <label className="label">Please enter your password to confirm:</label>
                <input 
                  type="password"
                  className="input" 
                  value={deleteConfirmPassword}
                  onChange={e => setDeleteConfirmPassword(e.target.value)}
                  placeholder="Your password..."
                  required
                  disabled={deletingAccount}
                />
              </div>
              <div className="report-modal-actions">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deletingAccount}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-danger btn-report-submit" 
                  disabled={deletingAccount || !deleteConfirmPassword}
                >
                  {deletingAccount ? 'Deleting Account...' : 'Confirm Delete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
