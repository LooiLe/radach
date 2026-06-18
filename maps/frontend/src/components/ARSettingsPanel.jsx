import React from 'react'

export default function ARSettingsPanel({
  showSettings,
  maxRange,
  setMaxRange,
  position,
  itineraryId,
  showNavigation,
  setShowNavigation,
  subscription,
  followedExperts,
  selectedExpertId,
  setSelectedExpertId,
  setShowUpgradeModal
}) {
  if (!showSettings) return null

  return (
    <div className="ar-settings-panel">
      <div className="ar-settings-label">Detection Range</div>
      <div className="ar-settings-value">{maxRange}m</div>
      <input
        type="range"
        className="ar-range-slider"
        min={100}
        max={1000}
        step={50}
        value={maxRange}
        onChange={(e) => setMaxRange(Number(e.target.value))}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px' }}>
        <span>100m</span>
        <span>1km</span>
      </div>

      {position && (
        <div style={{ marginTop: '12px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          GPS: {position.latitude.toFixed(5)}, {position.longitude.toFixed(5)}
          <br />Accuracy: ±{Math.round(position.accuracy)}m
        </div>
      )}

      {/* Navigation toggle — only show in itinerary mode */}
      {itineraryId && (
        <div className="ar-settings-toggle">
          <span className="ar-settings-toggle-label">🧭 Navigation arrows</span>
          <button
            className={`ar-toggle-switch ${showNavigation ? 'ar-toggle-switch--on' : ''}`}
            onClick={() => setShowNavigation(prev => !prev)}
          />
        </div>
      )}

      {/* Expert Spotlight filter */}
      <div className="ar-settings-expert-spotlight">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span className="ar-settings-label" style={{ margin: 0 }}>🌟 Expert Spotlight</span>
          {subscription?.tier !== 'PRO' && subscription?.tier !== 'UNLIMITED' && (
            <span className="ar-pro-badge" style={{ fontSize: '0.65rem', background: '#a78bfa', color: '#1e1b4b', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>PRO</span>
          )}
        </div>
        <select
          className="ar-expert-select"
          value={selectedExpertId || ''}
          onChange={(e) => {
            const val = e.target.value
            if (val && subscription?.tier !== 'PRO' && subscription?.tier !== 'UNLIMITED') {
              setShowUpgradeModal(true)
            } else {
              setSelectedExpertId(val ? Number(val) : null)
            }
          }}
        >
          <option value="">Show All Spots</option>
          {followedExperts.map(exp => (
            <option key={`opt-expert-${exp.id}`} value={exp.id}>
              {exp.name} ({exp.professionalTitle || 'Local Expert'})
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
