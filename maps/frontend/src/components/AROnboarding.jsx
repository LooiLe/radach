import React from 'react'

export default function AROnboarding({ showOnboarding, onboardingExit, onClick }) {
  if (!showOnboarding) return null

  return (
    <div
      className={`ar-onboarding ${onboardingExit ? 'ar-onboarding--exit' : ''}`}
      onClick={onClick}
    >
      <div className="ar-onboarding-steps">
        <div className="ar-onboarding-step" style={{ animationDelay: '0s' }}>
          <div className="ar-onboarding-step-icon">📷</div>
          <div className="ar-onboarding-step-text">Point your phone to see spots</div>
        </div>
        <div className="ar-onboarding-step" style={{ animationDelay: '0.15s' }}>
          <div className="ar-onboarding-step-icon">👆</div>
          <div className="ar-onboarding-step-text">Tap a marker for details</div>
        </div>
        <div className="ar-onboarding-step" style={{ animationDelay: '0.3s' }}>
          <div className="ar-onboarding-step-icon">📖</div>
          <div className="ar-onboarding-step-text">Add your own insights</div>
        </div>
      </div>
      <div className="ar-onboarding-hint">Tap anywhere to start</div>
    </div>
  )
}
