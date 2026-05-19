import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'

const AuthContext = createContext(null)

function decodeToken(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return { email: payload.sub, role: (payload.role || 'USER').toUpperCase(), exp: payload.exp }
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [userId, setUserId] = useState(() => localStorage.getItem('userId'))
  const [role, setRole] = useState(() => {
    const stored = localStorage.getItem('role')
    if (stored) return stored.toUpperCase()
    const t = localStorage.getItem('token')
    if (t) { const d = decodeToken(t); return d?.role || 'USER' }
    return 'USER'
  })
  const [isExpert, setIsExpert] = useState(() => localStorage.getItem('isExpert') === 'true')
  const refreshTimer = useRef(null)

  const login = useCallback((data) => {
    localStorage.setItem('token', data.token)
    localStorage.setItem('userId', data.userId)
    localStorage.setItem('role', data.role || 'USER')
    localStorage.setItem('isExpert', data.isExpert ? 'true' : 'false')
    if (data.refreshToken) {
      localStorage.setItem('refreshToken', data.refreshToken)
    }
    document.cookie = `token=${encodeURIComponent(data.token)}; path=/; max-age=86400; SameSite=Strict`
    setToken(data.token)
    setUserId(data.userId)
    setRole((data.role || 'USER').toUpperCase())
    setIsExpert(!!data.isExpert)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('userId')
    localStorage.removeItem('role')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('isExpert')
    document.cookie = 'token=; path=/; max-age=0; SameSite=Strict'
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    setToken(null)
    setUserId(null)
    setRole('USER')
    setIsExpert(false)
  }, [])

  // Silently refresh the access token before it expires
  const scheduleRefresh = useCallback((accessToken) => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    const decoded = decodeToken(accessToken)
    if (!decoded?.exp) return

    // Refresh 60 seconds before expiry
    const msUntilExpiry = decoded.exp * 1000 - Date.now() - 60_000
    if (msUntilExpiry <= 0) {
      // Token already close to expiry — refresh immediately
      doRefresh()
      return
    }
    refreshTimer.current = setTimeout(doRefresh, msUntilExpiry)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const doRefresh = useCallback(async () => {
    const rt = localStorage.getItem('refreshToken')
    if (!rt) return
    try {
      const res = await fetch('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      })
      if (res.ok) {
        const data = await res.json()
        login(data)
        scheduleRefresh(data.token)
      } else {
        // Refresh token expired or invalid — log out
        logout()
      }
    } catch {
      // Network error — don't log out, just retry later
    }
  }, [login, logout, scheduleRefresh])

  // Schedule refresh on mount if we have a token
  useEffect(() => {
    if (token) scheduleRefresh(token)
    return () => { if (refreshTimer.current) clearTimeout(refreshTimer.current) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const isAuthenticated = !!token
  const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN'
  const isSuperAdmin = role === 'SUPER_ADMIN'

  return (
    <AuthContext.Provider value={{ token, userId, role, isAuthenticated, isAdmin, isSuperAdmin, isExpert, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
