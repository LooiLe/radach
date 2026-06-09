import { createContext, useContext, useState, useCallback } from 'react'
import './ToastProvider.css'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9)
    setToasts((prev) => [...prev, { id, message, type, duration }])

    setTimeout(() => {
      removeToast(id)
    }, duration)
  }, [removeToast])

  const toast = {
    success: (msg, dur) => showToast(msg, 'success', dur),
    error: (msg, dur) => showToast(msg, 'error', dur),
    warning: (msg, dur) => showToast(msg, 'warning', dur),
    info: (msg, dur) => showToast(msg, 'info', dur),
  }

  // Helper icons
  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return '✨'
      case 'error':
        return '💥'
      case 'warning':
        return '⚠️'
      case 'info':
      default:
        return 'ℹ️'
    }
  }

  return (
    <ToastContext.Provider value={{ showToast, toast }}>
      {children}
      <div className="toast-container" role="live" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast-item toast-${t.type} glass`}
            onClick={() => removeToast(t.id)}
            style={{ '--duration': `${t.duration}ms` }}
          >
            <div className="toast-icon">{getIcon(t.type)}</div>
            <div className="toast-content">{t.message}</div>
            <button className="toast-close-btn" aria-label="Close toast">✕</button>
            <div className="toast-progress-bar" />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
