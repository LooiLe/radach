import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo)
    this.setState({ errorInfo })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '3rem', maxWidth: '800px', margin: '2rem auto', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', fontFamily: 'sans-serif' }}>
          <h2 style={{ margin: '0 0 1rem 0' }}>🚨 React Rendering Crash</h2>
          <p style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)' }}>The page crashed during rendering. Below is the error details:</p>
          <div style={{ background: '#1e1e1e', color: '#f8f8f2', padding: '1rem', borderRadius: '6px', overflowX: 'auto', fontSize: '0.9rem', lineHeight: '1.4' }}>
            <strong>Error:</strong> {this.state.error && this.state.error.toString()}
          </div>
          {this.state.errorInfo && (
            <details style={{ marginTop: '1.5rem', cursor: 'pointer' }}>
              <summary style={{ fontWeight: 600, color: '#3b82f6' }}>Component Stack Trace</summary>
              <pre style={{ background: '#1e1e1e', color: '#f8f8f2', padding: '1rem', borderRadius: '6px', marginTop: '0.5rem', fontSize: '0.8rem', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
          <button 
            onClick={() => window.location.reload()} 
            style={{ marginTop: '1.5rem', padding: '0.5rem 1rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
          >
            Reload Page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
