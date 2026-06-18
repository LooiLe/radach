import React from 'react'

export default function ARAnnotationModal({
  showAnnotationModal,
  pinnedLocation,
  capturedPhotoPreview,
  uploadingPhoto,
  annotationDistance,
  setAnnotationDistance,
  annotationForm,
  setAnnotationForm,
  closestSpotPreset,
  annotationSubmitting,
  handleCancelAnnotation,
  handleSubmitAnnotation,
  getCompassLabel
}) {
  if (!showAnnotationModal) return null

  return (
    <div className={`ar-annotation-modal ${showAnnotationModal ? 'ar-annotation-modal--open' : ''}`}>
      <div className="ar-annotation-modal-content">
        <div className="ar-info-drag-handle" />
        <div className="ar-annotation-modal-title">
          📖 Submit an Explanation
        </div>

        <div className="ar-earn-badge">
          <span>💎</span>
          <span>Pin & Earn: Approved explanations reward you with 1 free AI itinerary generation credit!</span>
        </div>

        {pinnedLocation && (
          <div className="ar-annotation-gps-info">
            📍 Locked Location: {pinnedLocation.latitude.toFixed(5)}, {pinnedLocation.longitude.toFixed(5)} · Facing {Math.round(pinnedLocation.heading)}° {getCompassLabel(pinnedLocation.heading)} · Pitch {Math.round(pinnedLocation.pitch || 90)}°
          </div>
        )}

        {capturedPhotoPreview && (
          <div className="ar-annotation-field" style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px' }}>Captured Reference Photo</label>
            <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
              <img
                src={capturedPhotoPreview}
                alt="Captured View"
                style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', borderRadius: '10px', border: '1px solid var(--border)' }}
              />
              {uploadingPhoto && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0,0,0,0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '10px',
                  fontSize: '0.8rem',
                  color: '#fff',
                  fontWeight: 600
                }}>
                  Uploading camera snapshot...
                </div>
              )}
            </div>
          </div>
        )}

        <div className="ar-annotation-field" style={{ marginBottom: '16px' }}>
          <label style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <span>Distance to Object:</span>
            <strong style={{ color: 'var(--warning)' }}>{annotationDistance} meters</strong>
          </label>
          <input
            type="range"
            min="1"
            max="50"
            step="1"
            value={annotationDistance}
            onChange={(e) => setAnnotationDistance(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--text-primary)', marginTop: '8px' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', opacity: 0.5, marginTop: '2px' }}>
            <span>1m (Right in front)</span>
            <span>50m (Far away)</span>
          </div>

          <div className="ar-annotation-presets">
            <button
              type="button"
              className={`ar-preset-btn ${annotationDistance === 3 ? 'active' : ''}`}
              onClick={() => setAnnotationDistance(3)}
            >
              Wall (3m)
            </button>
            <button
              type="button"
              className={`ar-preset-btn ${annotationDistance === 5 ? 'active' : ''}`}
              onClick={() => setAnnotationDistance(5)}
            >
              Close (5m)
            </button>
            <button
              type="button"
              className={`ar-preset-btn ${annotationDistance === 15 ? 'active' : ''}`}
              onClick={() => setAnnotationDistance(15)}
            >
              Medium (15m)
            </button>
            <button
              type="button"
              className={`ar-preset-btn ${annotationDistance === 30 ? 'active' : ''}`}
              onClick={() => setAnnotationDistance(30)}
            >
              Far (30m)
            </button>
            {closestSpotPreset && (
              <button
                type="button"
                className={`ar-preset-btn ${annotationDistance === closestSpotPreset.distance ? 'active' : ''}`}
                onClick={() => setAnnotationDistance(closestSpotPreset.distance)}
              >
                📍 Snap to {closestSpotPreset.name.length > 18 ? closestSpotPreset.name.substring(0, 16) + '..' : closestSpotPreset.name} ({closestSpotPreset.distance}m)
              </button>
            )}
          </div>
        </div>

        <div className="ar-annotation-field">
          <label>What is it?</label>
          <input
            type="text"
            placeholder="e.g. Temple mural on the east wall"
            value={annotationForm.title}
            onChange={(e) => setAnnotationForm(prev => ({ ...prev, title: e.target.value }))}
            maxLength={150}
          />
        </div>

        <div className="ar-annotation-field">
          <label>Explanation</label>
          <textarea
            placeholder="Describe what this is and why it's interesting..."
            value={annotationForm.description}
            onChange={(e) => setAnnotationForm(prev => ({ ...prev, description: e.target.value }))}
            maxLength={2000}
          />
        </div>

        <div className="ar-annotation-actions">
          <button
            className="ar-annotation-cancel-btn"
            onClick={handleCancelAnnotation}
          >
            Cancel
          </button>
          <button
            className="ar-annotation-submit-btn"
            disabled={!annotationForm.title.trim() || !annotationForm.description.trim() || !pinnedLocation || annotationSubmitting || uploadingPhoto}
            onClick={handleSubmitAnnotation}
          >
            {uploadingPhoto ? 'Uploading snapshot...' : annotationSubmitting ? 'Submitting...' : 'Submit for Review'}
          </button>
        </div>
      </div>
    </div>
  )
}
