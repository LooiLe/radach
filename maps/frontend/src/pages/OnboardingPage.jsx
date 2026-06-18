import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useApi } from '../hooks/useApi'
import './OnboardingPage.css'

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

const TOTAL_STEPS = 6

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [selectedInterests, setSelectedInterests] = useState([])
  const [experts, setExperts] = useState([])
  const [followedExperts, setFollowedExperts] = useState(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [sentRequests, setSentRequests] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [completing, setCompleting] = useState(false)
  const { apiFetch } = useApi()
  const { login } = useAuth()
  const navigate = useNavigate()

  // Redirect if already completed onboarding
  useEffect(() => {
    const onboardingDone = localStorage.getItem('onboardingCompleted') === 'true'
    if (onboardingDone) {
      navigate('/', { replace: true })
    }
  }, [navigate])

  // Fetch experts when interests change (step 4)
  const fetchExperts = useCallback(async (interests) => {
    try {
      const params = interests.length > 0 ? `?interests=${interests.join(',')}` : ''
      const res = await apiFetch(`/api/v1/onboarding/experts${params}`)
      if (res.ok) {
        setExperts(await res.json())
      }
    } catch (e) {
      console.error('Failed to fetch experts', e)
    }
  }, [apiFetch])

  // Search users for friend-finding
  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    try {
      const res = await apiFetch(`/api/v1/onboarding/users?q=${encodeURIComponent(searchQuery.trim())}`)
      if (res.ok) {
        setSearchResults(await res.json())
      }
    } catch (e) {
      console.error('Failed to search users', e)
    }
  }

  // Follow an expert
  const handleFollowExpert = async (expertId) => {
    try {
      const res = await apiFetch(`/api/v1/follows/${expertId}`, { method: 'POST' })
      if (res.ok) {
        setFollowedExperts(prev => new Set([...prev, expertId]))
      }
    } catch (e) {
      console.error('Failed to follow expert', e)
    }
  }

  // Send friend request
  const handleSendRequest = async (userId) => {
    try {
      const res = await apiFetch(`/api/v1/friends/request/${userId}`, { method: 'POST' })
      if (res.ok) {
        setSentRequests(prev => new Set([...prev, userId]))
      }
    } catch (e) {
      console.error('Failed to send friend request', e)
    }
  }

  // Toggle interest selection
  const toggleInterest = (value) => {
    setSelectedInterests(prev =>
      prev.includes(value) ? prev.filter(i => i !== value) : [...prev, value]
    )
  }

  // Complete onboarding
  const handleComplete = async () => {
    setCompleting(true)
    try {
      const res = await apiFetch('/api/v1/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interests: selectedInterests }),
      })
      if (res.ok) {
        // Update auth context to reflect onboarding completed
        const token = localStorage.getItem('token')
        const userId = localStorage.getItem('userId')
        const role = localStorage.getItem('role')
        const isExpert = localStorage.getItem('isExpert') === 'true'
        login({ token, userId, role, isExpert, onboardingCompleted: true })
        navigate('/', { replace: true })
      }
    } catch (e) {
      console.error('Failed to complete onboarding', e)
    } finally {
      setCompleting(false)
    }
  }

  // Load experts when entering step 4
  useEffect(() => {
    if (step === 4) {
      fetchExperts(selectedInterests)
    }
  }, [step, selectedInterests, fetchExperts])

  const nextStep = () => {
    if (step < TOTAL_STEPS) setStep(s => s + 1)
  }

  const prevStep = () => {
    if (step > 1) setStep(s => s - 1)
  }

  const renderProgressDots = () => (
    <div className="onboarding-progress">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <div
          key={i}
          className={`onboarding-dot ${i + 1 === step ? 'active' : ''} ${i + 1 < step ? 'completed' : ''}`}
        />
      ))}
    </div>
  )

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="onboarding-content animate-fade-up">
            <span className="onboarding-icon">👋</span>
            <h1 className="onboarding-title">Welcome to Unlike</h1>
            <p className="onboarding-subtitle">
              Discover hidden gems recommended by people you trust. 
              Let's get you set up for the best experience.
            </p>
            <button className="btn btn-primary" onClick={nextStep}>
              Get Started
            </button>
          </div>
        )

      case 2:
        return (
          <div className="onboarding-content animate-fade-up">
            <span className="onboarding-icon">🧠</span>
            <h1 className="onboarding-title">Build Your Taste Graph</h1>
            <p className="onboarding-subtitle">
              Tell us what you love, and we'll curate the app just for you. 
              The more we know about your tastes, the better recommendations 
              you'll get — from hidden cafes to the best local spots.
            </p>
            <button className="btn btn-primary" onClick={nextStep}>
              Next
            </button>
          </div>
        )

      case 3:
        return (
          <div className="onboarding-content animate-fade-up">
            <span className="onboarding-icon">🎯</span>
            <h1 className="onboarding-title">What are you into?</h1>
            <p className="onboarding-subtitle">
              Pick your interests so we can personalize your experience.
            </p>
            <div className="interests-grid">
              {INTERESTS.map(interest => (
                <button
                  key={interest.value}
                  className={`interest-chip ${selectedInterests.includes(interest.value) ? 'selected' : ''}`}
                  onClick={() => toggleInterest(interest.value)}
                >
                  {interest.emoji} {interest.label}
                </button>
              ))}
            </div>
            <div className="onboarding-actions">
              <button
                className="btn btn-primary"
                onClick={nextStep}
                disabled={selectedInterests.length === 0}
              >
                Next
              </button>
            </div>
          </div>
        )

      case 4:
        return (
          <div className="onboarding-content animate-fade-up">
            <span className="onboarding-icon">⭐</span>
            <h1 className="onboarding-title">Follow Experts</h1>
            <p className="onboarding-subtitle">
              Here are some experts you might want to follow based on your interests.
            </p>
            {experts.length === 0 ? (
              <div className="onboarding-empty">
                No experts found for your interests yet. You can always find them later!
              </div>
            ) : (
              <div className="experts-list">
                {experts.map(expert => (
                  <div key={expert.id} className="expert-card">
                    {expert.profilePicture ? (
                      <img src={expert.profilePicture} alt={expert.name} className="expert-avatar" />
                    ) : (
                      <div className="expert-avatar-placeholder">
                        {expert.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="expert-info">
                      <div className="expert-name">{expert.name}</div>
                      <div className="expert-specs">{expert.specializations}</div>
                    </div>
                    <button
                      className={`expert-follow-btn ${followedExperts.has(expert.id) ? 'following' : ''}`}
                      onClick={() => handleFollowExpert(expert.id)}
                      disabled={followedExperts.has(expert.id)}
                    >
                      {followedExperts.has(expert.id) ? 'Following' : 'Follow'}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="onboarding-actions">
              <button className="btn btn-primary" onClick={nextStep}>
                Next
              </button>
            </div>
          </div>
        )

      case 5:
        return (
          <div className="onboarding-content animate-fade-up">
            <span className="onboarding-icon">👥</span>
            <h1 className="onboarding-title">Add Your Friends</h1>
            <p className="onboarding-subtitle">
              Were you referred here? Search for your friends and connect with them!
            </p>
            <form className="onboarding-search" onSubmit={handleSearch}>
              <input
                type="text"
                className="input"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="btn btn-primary">Search</button>
            </form>
            {searchResults.length > 0 ? (
              <div className="onboarding-search-results">
                {searchResults.map(user => (
                  <div key={user.id} className="onboarding-user-item">
                    <div className="onboarding-user-info">
                      <div className="onboarding-user-name">{user.name}</div>
                      <div className="onboarding-user-email">{user.email}</div>
                    </div>
                    <button
                      className={`onboarding-add-btn ${sentRequests.has(user.id) ? 'added' : ''}`}
                      onClick={() => handleSendRequest(user.id)}
                      disabled={sentRequests.has(user.id)}
                    >
                      {sentRequests.has(user.id) ? 'Sent' : 'Add'}
                    </button>
                  </div>
                ))}
              </div>
            ) : searchQuery && (
              <div className="onboarding-empty">No users found.</div>
            )}
            <div className="onboarding-actions">
              <button className="btn btn-primary" onClick={nextStep}>
                {searchResults.length > 0 ? 'Next' : 'Skip'}
              </button>
            </div>
          </div>
        )

      case 6:
        return (
          <div className="onboarding-content animate-fade-up">
            <span className="onboarding-done-icon">🎉</span>
            <h1 className="onboarding-title">All Done!</h1>
            <p className="onboarding-subtitle">
              You're all set! Your taste graph is ready, and we've personalized 
              your experience. Start exploring and discovering amazing places 
              recommended by people you trust.
            </p>
            <button
              className="btn btn-primary"
              onClick={handleComplete}
              disabled={completing}
            >
              {completing ? 'Setting up…' : 'Start Discovering'}
            </button>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="onboarding-page">
      <div className="onboarding-container">
        {renderProgressDots()}
        {renderStep()}
      </div>
    </div>
  )
}