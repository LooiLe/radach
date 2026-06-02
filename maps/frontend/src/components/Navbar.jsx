import { useState, useEffect, useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useApi } from '../hooks/useApi'
import './Navbar.css'

export default function Navbar() {
  const { isAuthenticated, isAdmin, isSuperAdmin, role, userId, isExpert, logout } = useAuth()
  const { apiFetch } = useApi()
  const [menuOpen, setMenuOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [pendingAdminCount, setPendingAdminCount] = useState(0)
  const location = useLocation()
  const navigate = useNavigate()
  const [profilePicture, setProfilePicture] = useState(null)

  useEffect(() => {
    if (isAuthenticated) {
      apiFetch('/api/v1/users/me/profile')
        .then(res => { if (res.ok) return res.json(); throw new Error(); })
        .then(data => setProfilePicture(data.profilePicture))
        .catch(() => {})
    }
  }, [isAuthenticated, apiFetch])

  useEffect(() => {
    const handler = (e) => setProfilePicture(e.detail)
    window.addEventListener('profilePictureUpdated', handler)
    return () => window.removeEventListener('profilePictureUpdated', handler)
  }, [])

  const loadUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const res = await apiFetch('/api/v1/notifications/unread-count')
      if (res.ok) {
        const data = await res.json()
        setUnreadCount(data.count)
      }
      
      if (isAdmin || isSuperAdmin) {
        const adminRes = await apiFetch('/api/v1/admin/dashboard/pending-count')
        if (adminRes.ok) {
          const adminData = await adminRes.json()
          setPendingAdminCount(adminData.count)
        }
      }
    } catch { /* ignore */ }
  }, [apiFetch, isAuthenticated, isAdmin, isSuperAdmin])

  useEffect(() => {
    loadUnreadCount()
  }, [loadUnreadCount])

  // Refresh when navigating (especially after reading notifications)
  useEffect(() => {
    loadUnreadCount()
  }, [location.pathname, loadUnreadCount])

  // Refresh when notifications are marked as read manually
  useEffect(() => {
    const handler = () => loadUnreadCount()
    window.addEventListener('notificationsRead', handler)
    return () => window.removeEventListener('notificationsRead', handler)
  }, [loadUnreadCount])

  // Poll every 15 seconds
  useEffect(() => {
    const interval = setInterval(loadUnreadCount, 15000)
    return () => clearInterval(interval)
  }, [loadUnreadCount])

  const handleLogout = () => {
    logout()
    setMenuOpen(false)
    navigate('/login')
  }

  const isActive = (path) => location.pathname === path

  return (
    <>
      <nav className="navbar">
        <div className="navbar-left">
          {!['/', '/login', '/register'].includes(location.pathname) && (
            <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
              <span className={`hamburger-icon ${menuOpen ? 'open' : ''}`}>
                <span /><span /><span />
              </span>
            </button>
          )}
          <Link to="/" className="navbar-logo">
            <img src="/images/radach_logo.jpg" alt="Radach" className="navbar-logo-img" />
          </Link>
        </div>

        <div className="navbar-right">
          {isAuthenticated && isExpert && (
            <span className="badge badge-active" style={{ fontWeight: 700 }}>Expert</span>
          )}
          {role && role !== 'USER' && isAuthenticated && (
            <span className="badge badge-role"> {role}</span>
          )}
          {isAuthenticated ? (
            <Link to={`/user/${userId}`} className="btn btn-ghost btn-pill" aria-label="Profile" style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {profilePicture ? (
                <img src={profilePicture} alt="Profile" style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <img src="/icons/iconamoon--profile-thin.svg" alt="Profile" style={{ width: '26px', height: '26px' }} />
              )}
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-pill">Sign in</Link>
              <Link to="/register" className="btn btn-primary btn-pill">Get started</Link>
            </>
          )}
        </div>
      </nav>

      {/* Slide-out menu */}
      {menuOpen && <div className="menu-overlay" onClick={() => setMenuOpen(false)} />}
      <div className={`menu-drawer ${menuOpen ? 'open' : ''}`}>
        <Link to="/spots" className={`menu-item ${isActive('/spots') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
          <span className="menu-icon"></span> Spots
        </Link>
        <Link to="/itineraries" className={`menu-item ${isActive('/itineraries') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
          <span className="menu-icon"></span> Itineraries
        </Link>
        <Link to="/events" className={`menu-item ${isActive('/events') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
          <span className="menu-icon"></span> Events
        </Link>
        <Link to="/feed" className={`menu-item ${isActive('/feed') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
          <span className="menu-icon"></span> Feed
        </Link>
         <Link to="/search" className={`menu-item ${isActive('/search') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
           <span className="menu-icon"></span> User Directory
         </Link>
          <Link to="/notifications" className={`menu-item ${isActive('/notifications') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
           <span className="menu-icon"></span> Notifications
           {unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </Link>
        <Link to="/saved" className={`menu-item ${isActive('/saved') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
          <span className="menu-icon"></span> Saved Spots
        </Link>
        {isAuthenticated && (
          <Link to={`/user/${userId}`} className={`menu-item ${isActive(`/user/${userId}`) ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
            <span className="menu-icon"></span> My Profile
          </Link>
        )}

        {isAdmin && (
          <>
            <div className="menu-divider" />
            <Link to="/admin" className={`menu-item ${isActive('/admin') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
              <span className="menu-icon"></span> {isSuperAdmin ? 'Super Admin' : 'Admin'}
              {pendingAdminCount > 0 && <span className="notification-badge">{pendingAdminCount > 99 ? '99+' : pendingAdminCount}</span>}
            </Link>
          </>
        )}

        <div className="menu-divider" />
        {isAuthenticated ? (
          <button className="menu-item menu-btn" onClick={handleLogout}>
            <span className="menu-icon"></span> Sign out
          </button>
        ) : (
          <Link to="/login" className="menu-item" onClick={() => setMenuOpen(false)}>
            <span className="menu-icon"></span> Sign in
          </Link>
        )}
      </div>
    </>
  )
}
