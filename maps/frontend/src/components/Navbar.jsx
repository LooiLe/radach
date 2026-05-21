import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Navbar.css'

export default function Navbar() {
  const { isAuthenticated, isAdmin, isSuperAdmin, role, userId, isExpert, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

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
              <img src="/icons/iconamoon--profile-thin.svg" alt="Profile" style={{ width: '22px', height: '22px' }} />
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
           <span className="menu-icon"></span> All Spots
         </Link>
         <Link to="/events" className={`menu-item ${isActive('/events') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
           <span className="menu-icon"></span> Events
         </Link>
         <Link to="/feed" className={`menu-item ${isActive('/feed') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
          <span className="menu-icon"></span> Feed
        </Link>
         <Link to="/trending" className={`menu-item ${isActive('/trending') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
           <span className="menu-icon"></span> Trending
         </Link>
         <Link to="/search" className={`menu-item ${isActive('/search') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
           <span className="menu-icon"></span> Search for users
         </Link>
         <Link to="/friends" className={`menu-item ${isActive('/friends') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
           <span className="menu-icon"></span> Friends
         </Link>
        <Link to="/saved" className={`menu-item ${isActive('/saved') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
          <span className="menu-icon"></span> Saved Spots
        </Link>
<<<<<<< Updated upstream
        <Link to="/feed" className={`menu-item ${isActive('/feed') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
          <span className="menu-icon"></span> Friend Feed
        </Link>
        <Link to="/events" className={`menu-item ${isActive('/events') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>
          <span className="menu-icon"></span> Events
        </Link>
=======
>>>>>>> Stashed changes
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
