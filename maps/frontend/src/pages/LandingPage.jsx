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
      {/* Ambient glow */}
      <div className="landing-glow glow-1" />
      <div className="landing-glow glow-2" />

      <section className="hero">
        <div className="hero-content animate-fade-up">
          <p className="hero-eyebrow">
            <span className="eyebrow-line" />
            discoveries
          </p>
          <h1 className="hero-title">
            Find the spots<br />worth <em>talking</em><br />about.
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

        <div className="hero-visual animate-fade-up" style={{ animationDelay: '0.15s' }}>
          <div className="hero-cards">
            <div className="hero-card tall glass">
              <div className="hero-card-emoji">🍜</div>
              <div className="hero-card-info">
                <span className="hero-card-type">Food Hall</span>
                <span className="hero-card-name">Central Market Bangkok</span>
                <span className="hero-card-stars">★★★★★ Chef reviewed</span>
              </div>
            </div>
            <div className="hero-card glass">
              <div className="hero-card-emoji">🥘</div>
              <div className="hero-card-info">
                <span className="hero-card-type">Restaurant</span>
                <span className="hero-card-name">Baan Ying</span>
                <span className="hero-card-stars">★★★★ Trending</span>
              </div>
            </div>
            <div className="hero-card glass">
              <div className="hero-card-emoji">☕</div>
              <div className="hero-card-info">
                <span className="hero-card-type">Café</span>
                <span className="hero-card-name">Roots Coffee</span>
                <span className="hero-card-stars">★★★★★ Popular</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="stats-bar">
        <div className="stat"><span className="stat-number">200+</span><span className="stat-label">Verified spots</span></div>
        <div className="stat"><span className="stat-number">50+</span><span className="stat-label">Expert chefs</span></div>
        <div className="stat"><span className="stat-number">1,000+</span><span className="stat-label">Reviews written</span></div>
        <div className="stat"><span className="stat-number">5k+</span><span className="stat-label">Monthly visitors</span></div>
      </section>

      <section className="features">
        <p className="section-eyebrow"><span className="eyebrow-line" />Why Radach</p>
        <h2 className="section-title">Trusted by everyone,<br />curated by the pros.</h2>
        <div className="features-grid">
          <div className="feature glass">
            <div className="feature-icon">👨‍🍳</div>
            <h3 className="feature-name">Verified reviews</h3>
            <p className="feature-desc">Every expert review is written by a verified culinary professional. No fake accounts. No paid promotions.</p>
          </div>
          <div className="feature glass">
            <div className="feature-icon">📍</div>
            <h3 className="feature-name">Discover near you</h3>
            <p className="feature-desc">Find the best spots within any radius. Our geo-search surfaces hidden gems close to wherever you are.</p>
          </div>
          <div className="feature glass">
            <div className="feature-icon">🔥</div>
            <h3 className="feature-name">Trending spots</h3>
            <p className="feature-desc">Our ranking engine tracks real engagement — views, saves, and review quality — so trending means actually trending.</p>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <span>© 2026 Radach.</span>
      </footer>
    </div>
  )
}
