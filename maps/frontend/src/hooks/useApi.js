import { useAuth } from '../context/AuthContext'
import { useCallback } from 'react'

const API_BASE = ''

export function useApi() {
  const { token, logout } = useAuth()

  const apiFetch = useCallback(async (path, options = {}) => {
    const isFormData = options.body instanceof FormData
    const headers = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    }
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers })

    if (res.status === 401) {
      // Try silent refresh before logging out
      const refreshToken = localStorage.getItem('refreshToken')
      if (refreshToken) {
        try {
          const refreshRes = await fetch('/api/v1/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          })
          if (refreshRes.ok) {
            const data = await refreshRes.json()
            // Store new tokens
            localStorage.setItem('token', data.token)
            localStorage.setItem('refreshToken', data.refreshToken)
            document.cookie = `token=${encodeURIComponent(data.token)}; path=/; max-age=86400; SameSite=Strict`
            // Retry the original request with the new token
            const retryHeaders = {
              ...headers,
              Authorization: `Bearer ${data.token}`,
            }
            return fetch(`${API_BASE}${path}`, { ...options, headers: retryHeaders })
          }
        } catch { /* fall through to logout */ }
      }
      logout()
      throw new Error('Session expired')
    }
    if (res.status === 403) {
      logout()
      throw new Error('Session expired')
    }
    if (res.status === 429) {
      throw new Error('Too many requests. Please slow down.')
    }
    return res
  }, [token, logout])

  return { apiFetch }
}
