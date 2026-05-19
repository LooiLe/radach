import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './LandingPage.css'

export default function LandingPage() {
  const { isAuthenticated } = useAuth()

  if (isAuthenticated) {
    return <Navigate to="/spots" replace />
  }

  return (
    <div className="landing">
      <section className="hero-fullscreen">
        <div className="hero-content-right animate-fade-up">
          <h1 className="hero-title">
            Find the spots<br />worth <span className="highlight-orange">talking</span><br />about.
          </h1>
          <p className="hero-sub">
            Real reviews from verified experts. No sponsored posts. No algorithms. Just the best food halls, restaurants, and hidden gems.
          </p>
          <div className="hero-cta">
            {isAuthenticated ? (
              <Link to="/spots" className="btn btn-primary btn-pill btn-lg">Explore spots →</Link>
            ) : (
              <>
                <Link to="/register" className="btn btn-primary btn-pill btn-lg">Start exploring →</Link>
                <Link to="/login" className="hero-link">Already a member?</Link>
              </>
            )}
          </div>
        </div>
        <div className="scroll-indicator">
          <img src="/icons/chevron-double-down.svg" alt="Scroll down" />
        </div>
      </section>

      <section className="map-features">
        <div className="map-features-content">
          <div className="map-features-left animate-fade-up">
            <h2 className="section-title">Trusted by everyone,<br />curated by professionals</h2>
          </div>
          <div className="map-features-right animate-fade-up" style={{ animationDelay: '0.15s' }}>
            <div className="feature-item">
              <h3 className="feature-name">Verified reviews</h3>
              <p className="feature-desc">Every expert review is written by a verified culinary professional. No fake accounts. No paid promotions.</p>
            </div>
            <div className="feature-item">
              <h3 className="feature-name">Discover near you</h3>
              <p className="feature-desc">Find the best spots within any radius. Our geo-search surfaces hidden gems close to wherever you are.</p>
            </div>
            <div className="feature-item">
              <h3 className="feature-name">Trending spots</h3>
              <p className="feature-desc">Our ranking engine tracks real engagement — views, saves, and review quality — so trending means actually trending.</p>
            </div>
          </div>
        </div>

        {/* Decorative Map Pins */}
        {/* Top-Left (above heading) */}
        <div className="decorative-pin pin-purple" style={{ top: '15%', left: '15%' }}></div>
        {/* Bottom-Left (below heading) */}
        <div className="decorative-pin pin-yellow" style={{ top: '80%', left: '20%' }}></div>
        {/* Top-Middle (gap) */}
        <div className="decorative-pin pin-red" style={{ top: '20%', left: '48%' }}></div>
        {/* Center-Middle (gap) */}
        <div className="decorative-pin pin-green" style={{ top: '50%', left: '45%' }}></div>
        {/* Bottom-Middle (gap) */}
        <div className="decorative-pin pin-blue" style={{ top: '75%', left: '50%' }}></div>
        {/* Far-Right Top */}
        <div className="decorative-pin pin-yellow-2" style={{ top: '10%', left: '85%' }}></div>
        {/* Far-Right Bottom */}
        <div className="decorative-pin pin-orange" style={{ top: '85%', left: '88%' }}></div>
      </section>

      <footer className="landing-footer" style={{ position: 'relative', zIndex: 10 }}>
        <span> 2026 Radach.</span>
      </footer>
    </div>
  )
}
