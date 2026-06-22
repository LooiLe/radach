import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './AuthPage.css'

export default function MobileHandoffPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const { login } = useAuth()
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function consumeHandoff() {
      try {
        const res = await fetch(`/api/v1/auth/mobile-handoff/${encodeURIComponent(token)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'This phone handoff link is invalid or expired.')
        if (cancelled) return

        login(data.auth)
        navigate(data.targetPath || '/', { replace: true, state: { fromMobileHandoff: true } })
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Could not continue on this phone.')
        }
      }
    }

    consumeHandoff()
    return () => {
      cancelled = true
    }
  }, [login, navigate, token])

  return (
    <div className="auth-page">
      <div className="auth-panel-right" style={{ margin: '0 auto' }}>
        <div className="auth-form animate-fade-up">
          <p className="auth-eyebrow">AR Explorer</p>
          <h1 className="auth-title">Opening on phone</h1>
          <p className="auth-subtitle">
            {error ? 'The handoff link could not be used.' : 'Signing you in and continuing to AR...'}
          </p>
          {error && (
            <>
              <div className="msg msg-error">{error}</div>
              <Link to="/login" className="btn btn-primary auth-submit">Sign in manually</Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
