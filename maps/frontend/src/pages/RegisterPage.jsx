import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './AuthPage.css'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name || !email || !password) { setError('Please fill in all fields.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setError(''); setLoading(true)
    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password })
      })
      const data = await res.json()
      if (res.ok) { login(data); navigate('/spots') }
      else { setError(data.error || 'Registration failed.') }
    } catch { setError('Could not reach the server.') }
    finally { setLoading(false) }
  }

  return (
    <div className="auth-page">
      <div className="auth-panel-left">
        <div className="auth-panel-glow" />
        <blockquote className="auth-quote">
          “Discover hidden gems <em>recommended by people</em> you trust.”
        </blockquote>
        <div className="auth-mini-spots">
          {[
            { icon: '🍜', name: 'Central Market Bangkok', tag: 'Food Hall · Chef reviewed', score: '4.9' },
            { icon: '☕', name: 'Roots Coffee Roaster', tag: 'Café · Trending', score: '4.8' },
            { icon: '🥘', name: 'Baan Ying', tag: 'Restaurant · Popular', score: '4.7' },
          ].map((s, i) => (
            <div className="auth-mini-spot glass" key={i}>
              <span className="auth-mini-icon">{s.icon}</span>
              <div className="auth-mini-info">
                <span className="auth-mini-name">{s.name}</span>
                <span className="auth-mini-tag">{s.tag}</span>
              </div>
              <span className="auth-mini-score">★ {s.score}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="auth-panel-right">
        <form className="auth-form animate-fade-up" onSubmit={handleSubmit}>
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
            {loading ? 'Creating account…' : 'Create account'}
          </button>

          {error && <div className="msg msg-error">{error}</div>}
        </form>
      </div>
    </div>
  )
}
