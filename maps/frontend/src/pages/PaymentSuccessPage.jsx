import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useApi } from '../hooks/useApi'

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { apiFetch } = useApi()

  const genId = searchParams.get('gen')
  
  // States
  const [status, setStatus] = useState('PROCESSING') // PROCESSING, COMPLETED, FAILED, GENERAL_SUCCESS
  const [errorMsg, setErrorMsg] = useState('')
  const [itineraryId, setItineraryId] = useState(null)

  useEffect(() => {
    if (!genId) {
      // General success for credits or subscriptions
      setStatus('GENERAL_SUCCESS')
      return
    }

    let intervalId
    let attempts = 0
    const maxAttempts = 30 // 30 seconds max polling

    async function checkStatus() {
      try {
        const res = await apiFetch(`/api/v1/itineraries/generations/${genId}`)
        if (res.ok) {
          const data = await res.json()
          
          if (data.status === 'COMPLETED') {
            setStatus('COMPLETED')
            setItineraryId(data.itineraryId)
            clearInterval(intervalId)
            
            // Auto redirect after 1.5 seconds
            setTimeout(() => {
              navigate(`/itineraries/${data.itineraryId}`)
            }, 1500)
          } else if (data.status === 'FAILED') {
            setStatus('FAILED')
            setErrorMsg('AI generation encountered an error. Please try again.')
            clearInterval(intervalId)
          }
        }
      } catch (err) {
        console.error('Failed to check generation status', err)
      }

      attempts++
      if (attempts >= maxAttempts) {
        setStatus('FAILED')
        setErrorMsg('Generation timed out. Please check Itineraries history.')
        clearInterval(intervalId)
      }
    }

    // Check immediately, then poll every 1 second
    checkStatus()
    intervalId = setInterval(checkStatus, 1000)

    return () => clearInterval(intervalId)
  }, [genId, apiFetch, navigate])

  return (
    <div className="payment-success-page" style={styles.container}>
      <div className="success-card glass" style={styles.card}>
        
        {status === 'PROCESSING' && (
          <div style={styles.content}>
            <div className="spinner" style={styles.spinner}></div>
            <h2 style={styles.title}>Creating Your Perfect Route...</h2>
            <p style={styles.subtitle}>
              Our AI algorithm is selecting the best personalized review recommendations and optimizing the geographical path. This will take just a moment.
            </p>
          </div>
        )}

        {status === 'COMPLETED' && (
          <div style={styles.content}>
            <div style={styles.iconContainer}>✨</div>
            <h2 style={{ ...styles.title, color: '#10b981' }}>Generation Complete!</h2>
            <p style={styles.subtitle}>
              Your itinerary has been generated successfully. Redirecting you to the route details...
            </p>
            <Link to={`/itineraries/${itineraryId}`} className="btn btn-primary" style={styles.button}>
              View Itinerary
            </Link>
          </div>
        )}

        {status === 'FAILED' && (
          <div style={styles.content}>
            <div style={{ ...styles.iconContainer, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>⚠️</div>
            <h2 style={{ ...styles.title, color: '#ef4444' }}>Generation Failed</h2>
            <p style={styles.subtitle}>{errorMsg || 'An error occurred during itinerary generation.'}</p>
            <div style={styles.actions}>
              <Link to="/itineraries/plan" className="btn btn-outline" style={{ ...styles.button, marginRight: '0.5rem' }}>
                Try Again
              </Link>
              <Link to="/itineraries" className="btn btn-ghost" style={styles.button}>
                My Itineraries
              </Link>
            </div>
          </div>
        )}

        {status === 'GENERAL_SUCCESS' && (
          <div style={styles.content}>
            <div style={styles.iconContainer}>🎉</div>
            <h2 style={{ ...styles.title, color: '#8b5cf6' }}>Payment Successful!</h2>
            <p style={styles.subtitle}>
              Thank you for your purchase. Your credits or subscription tier has been credited to your account.
            </p>
            <div style={styles.actions}>
              <Link to="/itineraries/plan" className="btn btn-primary" style={styles.button}>
                ✨ Plan New Itinerary
              </Link>
              <Link to="/itineraries" className="btn btn-ghost" style={{ ...styles.button, marginLeft: '0.5rem' }}>
                Go to Dashboard
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: 'calc(100vh - 64px)',
    background: 'var(--bg-primary, #0f0f16)',
    fontFamily: 'var(--font-body, sans-serif)',
    padding: '1.5rem'
  },
  card: {
    maxWidth: '500px',
    width: '100%',
    background: 'var(--bg-surface, #151521)',
    border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
    borderRadius: '16px',
    padding: '3rem 2rem',
    textAlign: 'center',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)'
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem'
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '3px solid rgba(139, 92, 246, 0.1)',
    borderLeftColor: '#8b5cf6',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  title: {
    fontSize: '1.4rem',
    fontWeight: '700',
    color: '#fff',
    marginTop: '0.5rem'
  },
  subtitle: {
    fontSize: '0.9rem',
    color: 'var(--text-secondary, #999)',
    lineHeight: '1.5',
    marginBottom: '1rem'
  },
  iconContainer: {
    width: '70px',
    height: '70px',
    borderRadius: '50%',
    background: 'rgba(16, 185, 129, 0.1)',
    color: '#10b981',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '2rem',
    marginBottom: '0.5rem'
  },
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.65rem 1.5rem',
    fontSize: '0.9rem',
    fontWeight: '600',
    borderRadius: '10px',
    textDecoration: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  actions: {
    display: 'flex',
    justifyContent: 'center',
    width: '100%'
  }
}

// Add simple CSS animation style inject for spinner
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.innerHTML = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `
  document.head.appendChild(style)
}
