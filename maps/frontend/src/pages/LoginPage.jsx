import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './AuthPage.css'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/spots'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email || !password) { setError('Please fill in all fields.'); return }
    setError(''); setLoading(true)
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      })
      const data = await res.json()
      if (res.ok) { login(data); navigate(from, { replace: true }) }
      else { setError(data.error || 'Invalid email or password.') }
    } catch { setError('Could not reach the server.') }
    finally { setLoading(false) }
  }

  return (
    <div className="auth-page">
      <div className="auth-panel-left">
        <div className="auth-panel-glow" />
        <blockquote className="auth-quote">
          “Discover places through people you trust.”
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
        <form className="auth-form animate-fade-up" onSubmit={handleSubmit}>
          <p className="auth-eyebrow">Welcome back</p>
          <h1 className="auth-title">Sign in</h1>
          <p className="auth-subtitle">No account yet? <Link to="/register">Create one free</Link></p>

          <div className="field">
            <label className="label" htmlFor="login-email">Email address</label>
            <input className="input" id="login-email" type="email" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
          </div>
          <div className="field">
            <label className="label" htmlFor="login-password">Password</label>
            <input className="input" id="login-password" type="password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
          </div>

          <button className="btn btn-primary auth-submit" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          {error && <div className="msg msg-error">{error}</div>}
        </form>
      </div>
    </div>
  )
}
