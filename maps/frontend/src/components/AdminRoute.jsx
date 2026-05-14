import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AdminRoute({ children, superOnly = false }) {
  const { isAuthenticated, isAdmin, isSuperAdmin, role } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (superOnly && !isSuperAdmin) return <AccessDenied role={role} />
  if (!isAdmin) return <AccessDenied role={role} />
  return children
}

function AccessDenied({ role }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'80vh' }}>
      <div style={{ textAlign:'center', maxWidth: 420, padding: '2rem' }}>
        <h1 style={{ fontFamily:'var(--font-display)', fontSize:'2rem', marginBottom:'1rem' }}> Access Denied</h1>
        <p style={{ color:'var(--text-secondary)', lineHeight:1.6, marginBottom:'1.5rem' }}>
          This page requires <strong>ADMIN</strong> or <strong>SUPER_ADMIN</strong> role.<br/>
          Your current role: <span className="badge badge-role">{role || 'USER'}</span>
        </p>
        <p style={{ color:'var(--text-muted)', fontSize:'0.85rem', marginBottom:'1.5rem' }}>
          If you were recently upgraded, <strong>sign out and sign back in</strong> to get a new token.
        </p>
      </div>
    </div>
  )
}
