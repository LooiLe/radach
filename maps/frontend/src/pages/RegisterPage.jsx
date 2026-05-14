import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './AuthPage.css'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1) // 1 = form, 2 = OTP verification
  const [countdown, setCountdown] = useState(0) // resend cooldown in seconds
  const [expiryCountdown, setExpiryCountdown] = useState(0) // OTP expiry timer
  const { login } = useAuth()
  const navigate = useNavigate()

  // Resend cooldown timer
  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  // OTP expiry timer
  useEffect(() => {
    if (expiryCountdown <= 0) return
    const timer = setTimeout(() => setExpiryCountdown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [expiryCountdown])

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // Step 1: Send OTP
  const handleSendOtp = useCallback(async (e) => {
    if (e) e.preventDefault()
    if (!name || !email || !password) { setError('Please fill in all fields.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setError(''); setLoading(true)
    try {
      const res = await fetch('/api/v1/auth/register/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      })
      const data = await res.json()
      if (res.ok) {
        setStep(2)
        setCountdown(60) // 60s cooldown before allowing resend
        setExpiryCountdown(300) // 5-minute OTP expiry
      } else {
        setError(data.error || data.message || 'Failed to send verification code.')
      }
    } catch { setError('Could not reach the server.') }
    finally { setLoading(false) }
  }, [name, email, password])

  // Step 2: Verify OTP & create account
  const handleVerify = async (e) => {
    e.preventDefault()
    if (!otp || otp.length !== 6) { setError('Please enter the 6-digit code.'); return }
    setError(''); setLoading(true)
    try {
      const res = await fetch('/api/v1/auth/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, name: name.trim(), otp })
      })
      const data = await res.json()
      if (res.ok) { login(data); navigate('/spots') }
      else { setError(data.error || data.message || 'Verification failed.') }
    } catch { setError('Could not reach the server.') }
    finally { setLoading(false) }
  }

  // Resend OTP
  const handleResend = async () => {
    if (countdown > 0) return
    setError(''); setLoading(true)
    try {
      const res = await fetch('/api/v1/auth/register/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      })
      const data = await res.json()
      if (res.ok) {
        setCountdown(60)
        setExpiryCountdown(300)
        setOtp('')
      } else {
        setError(data.error || data.message || 'Failed to resend code.')
      }
    } catch { setError('Could not reach the server.') }
    finally { setLoading(false) }
  }

  return (
    <div className="auth-page">
      <div className="auth-panel-left">
        <div className="auth-panel-glow" />
        <blockquote className="auth-quote">
          "Discover hidden gems <em>recommended by people</em> you trust."
        </blockquote>
        <div className="auth-mini-spots">
          {[
            { icon: '', name: 'Central Market Bangkok', tag: 'Food Hall · Chef reviewed', score: '4.9' },
            { icon: '', name: 'Roots Coffee Roaster', tag: 'Café · Trending', score: '4.8' },
            { icon: '', name: 'Baan Ying', tag: 'Restaurant · Popular', score: '4.7' },
          ].map((s, i) => (
            <div className="auth-mini-spot glass" key={i}>
              <span className="auth-mini-icon">{s.icon}</span>
              <div className="auth-mini-info">
                <span className="auth-mini-name">{s.name}</span>
                <span className="auth-mini-tag">{s.tag}</span>
              </div>
              <span className="auth-mini-score"> {s.score}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="auth-panel-right">
        {step === 1 ? (
          <form className="auth-form animate-fade-up" onSubmit={handleSendOtp}>
            <p className="auth-eyebrow">Join the community</p>
            <h1 className="auth-title">Create account</h1>
            <p className="auth-subtitle">Already have an account? <Link to="/login">Sign in</Link></p>

            <div className="field">
              <label className="label" htmlFor="reg-name">Your name</label>
              <input className="input" id="reg-name" type="text" placeholder="John Doe"
                value={name} onChange={e => setName(e.target.value)} autoComplete="name" />
            </div>
            <div className="field">
              <label className="label" htmlFor="reg-email">Email address</label>
              <input className="input" id="reg-email" type="email" placeholder="you@example.com"
                value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div className="field">
              <label className="label" htmlFor="reg-password">Password</label>
              <input className="input" id="reg-password" type="password" placeholder="At least 8 characters"
                value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
            </div>

            <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>
              {loading ? 'Sending code…' : 'Send verification code'}
            </button>

            {error && <div className="msg msg-error">{error}</div>}
          </form>
        ) : (
          <form className="auth-form animate-fade-up" onSubmit={handleVerify}>
            <p className="auth-eyebrow">Almost there</p>
            <h1 className="auth-title">Verify your email</h1>
            <p className="auth-subtitle">
              We sent a 6-digit code to <strong>{email}</strong>
            </p>

            <div className="field">
              <label className="label" htmlFor="reg-otp">Verification code</label>
              <input
                className="input otp-input"
                id="reg-otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoComplete="one-time-code"
                autoFocus
                style={{ letterSpacing: '0.5em', fontSize: '1.5rem', textAlign: 'center', fontWeight: 600 }}
              />
            </div>

            {expiryCountdown > 0 && (
              <p className="otp-timer" style={{ color: expiryCountdown <= 60 ? '#e74c3c' : 'var(--text-muted)', fontSize: '0.85rem', margin: '0.5rem 0' }}>
                Code expires in {formatTime(expiryCountdown)}
              </p>
            )}
            {expiryCountdown === 0 && step === 2 && (
              <p className="otp-timer" style={{ color: '#e74c3c', fontSize: '0.85rem', margin: '0.5rem 0' }}>
                Code expired. Please request a new one.
              </p>
            )}

            <button className="btn btn-primary auth-submit" type="submit" disabled={loading || expiryCountdown === 0}>
              {loading ? 'Verifying…' : 'Verify & create account'}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.75rem' }}>
              <button
                type="button"
                className="btn-link"
                onClick={() => { setStep(1); setOtp(''); setError('') }}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.85rem', padding: 0 }}
              >
                ← Back
              </button>
              <button
                type="button"
                className="btn-link"
                onClick={handleResend}
                disabled={countdown > 0 || loading}
                style={{ background: 'none', border: 'none', color: countdown > 0 ? 'var(--text-muted)' : 'var(--accent)', cursor: countdown > 0 ? 'default' : 'pointer', fontSize: '0.85rem', padding: 0 }}
              >
                {countdown > 0 ? `Resend in ${countdown}s` : 'Resend code'}
              </button>
            </div>

            {error && <div className="msg msg-error">{error}</div>}
          </form>
        )}
      </div>
    </div>
  )
}
