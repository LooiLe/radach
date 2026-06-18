import React from 'react'
import { Link } from 'react-router-dom'

export default function ARInfoSheet({
  showInfoSheet,
  selectedPOI,
  handleCloseSheet,
  explanation,
  explanationError,
  alternatives,
  handleSelectPOI,
  stopCamera,
  getIconUrl,
  formatDistance
}) {
  if (!showInfoSheet || !selectedPOI) return null

  return (
    <div className={`ar-info-sheet ${showInfoSheet ? 'ar-info-sheet--open' : ''}`}>
      <div className="ar-info-sheet-content">
        <div className="ar-info-drag-handle" />

        {/* Photo strip */}
        {!selectedPOI.isAnnotation && !selectedPOI.isFriendPost && selectedPOI.photos?.length > 0 && (
          <div className="ar-info-photos">
            {selectedPOI.photos.slice(0, 5).map((url, idx) => (
              <img
                key={`info-photo-${idx}`}
                src={url}
                alt={`${selectedPOI.name} photo ${idx + 1}`}
                className="ar-info-photo"
              />
            ))}
          </div>
        )}

        <div className="ar-info-header">
          <div>
            <div className="ar-info-spot-name">
              {selectedPOI.isItineraryStop && (
                <span style={{ color: 'var(--text-primary)', marginRight: '6px' }}>
                  #{selectedPOI.stopNumber}
                </span>
              )}
              {selectedPOI.name}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {!selectedPOI.isAnnotation && !selectedPOI.isFriendPost && (
              <span className="ar-info-spot-type">
                <img src={getIconUrl(selectedPOI.type)} alt="" style={{ width: '14px', height: '14px', opacity: 0.7 }} />
                {selectedPOI.type}
              </span>
            )}
            {selectedPOI.isAnnotation && (
              <span className="ar-info-spot-type" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
                📖 Annotation
              </span>
            )}
            {selectedPOI.isFriendPost && (
              <span className="ar-info-spot-type" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                💬 Friend's Note
              </span>
            )}
            <button className="ar-info-close-btn" onClick={handleCloseSheet}>✕</button>
          </div>
        </div>

        <div className="ar-info-meta">
          <span>📍 {formatDistance(selectedPOI.distance)}</span>
          {!selectedPOI.isAnnotation && !selectedPOI.isFriendPost && selectedPOI.averageRating > 0 && (
            <span>
              ⭐ <span className="ar-info-rating">{selectedPOI.averageRating?.toFixed?.(1) || selectedPOI.averageRating}</span>
            </span>
          )}
          {!selectedPOI.isAnnotation && !selectedPOI.isFriendPost && selectedPOI.address && (
            <span style={{ fontSize: '0.75rem', opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
              {selectedPOI.address}
            </span>
          )}
        </div>

        {/* ─── Annotation detail ─── */}
        {selectedPOI.isAnnotation && selectedPOI.annotationData && (
          <div className="ar-annotation-detail">
            <div className="ar-annotation-detail-author">
              👤 {selectedPOI.annotationData.authorName}
              {selectedPOI.annotationData.authorIsExpert && (
                <span className="badge-expert">Expert</span>
              )}
            </div>
            <div className="ar-annotation-detail-text">
              {selectedPOI.annotationData.description}
            </div>
            {selectedPOI.annotationData.photoUrl && (
              <img
                src={selectedPOI.annotationData.photoUrl}
                alt={selectedPOI.annotationData.title}
                className="ar-annotation-detail-photo"
              />
            )}
          </div>
        )}

        {/* ─── Friend Post detail ─── */}
        {selectedPOI.isFriendPost && selectedPOI.postData && (
          <div className="ar-friend-post-detail" style={{ padding: '12px 0' }}>
            <div className="ar-friend-post-author" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              {selectedPOI.postData.authorProfilePicture ? (
                <img
                  src={selectedPOI.postData.authorProfilePicture}
                  alt={selectedPOI.postData.authorName}
                  style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>👤</div>
              )}
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{selectedPOI.postData.authorName}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Shared a tip about {selectedPOI.postData.spotName} · {new Date(selectedPOI.postData.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
            <div className="ar-friend-post-text" style={{ fontSize: '0.8rem', lineHeight: '1.5', color: 'var(--text-secondary)', marginBottom: '12px', whiteSpace: 'pre-wrap' }}>
              {selectedPOI.postData.content}
            </div>
            {selectedPOI.postData.mediaUrls?.length > 0 && (
              <div className="ar-friend-post-photos" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                {selectedPOI.postData.mediaUrls.map((url, idx) => (
                  <img
                    key={`post-img-${idx}`}
                    src={url}
                    alt="attachment"
                    style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border)' }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Spot Explanation ─── */}
        {!selectedPOI.isAnnotation && !selectedPOI.isFriendPost && (
          <>
            {explanation ? (
              <div className="ar-explanation ar-explanation--animated">
                <div className="ar-explanation-heading">
                  <div className="ar-explanation-label">About this spot</div>
                  <div className={`ar-explanation-source ${explanation.aiEnhanced ? 'ar-explanation-source--ai' : ''}`}>
                    {explanation.aiEnhanced ? 'AI enhanced' : 'Local guide'}
                  </div>
                </div>
                <div className="ar-explanation-text">
                  {explanation.whatIsThis && (
                    <div className="ar-explanation-desc ar-stagger-1">
                      {explanation.whatIsThis}
                    </div>
                  )}

                  {explanation.highlights?.length > 0 && (
                    <div className="ar-explanation-highlights ar-stagger-2">
                      {explanation.highlights.slice(0, 5).map((highlight, idx) => (
                        <div key={`ar-highlight-${idx}`} className="ar-explanation-highlight" style={{ animationDelay: `${0.1 + idx * 0.06}s` }}>
                          {highlight}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {explanation.whoIsThisFor && (
                    <div className="ar-explanation-audience ar-stagger-3">
                      <span>👥</span> <span>{explanation.whoIsThisFor}</span>
                    </div>
                  )}

                  {explanation.quickFact && (
                    <div className="ar-explanation-fact ar-stagger-4">
                      💡 {explanation.quickFact}
                    </div>
                  )}
                  {explanation.visitTip && (
                    <div className="ar-explanation-tip ar-stagger-5">
                      <span className="ar-explanation-kicker">AR tip</span>
                      <span>{explanation.visitTip}</span>
                    </div>
                  )}
                </div>

                {explanation.shouldYouSwitch && (
                  <div className="ar-explanation-switch ar-stagger-5">
                    <div className="ar-explanation-switch-title">
                      <span>🔄</span> Should you switch?
                    </div>
                    <div className="ar-explanation-switch-content">
                      {explanation.shouldYouSwitch}
                    </div>
                  </div>
                )}

                {explanation.friendSays && (
                  <div className="ar-explanation-friend ar-stagger-6">
                    👤 A friend says: "{explanation.friendSays}"
                  </div>
                )}
              </div>
            ) : explanationError ? (
              <div className="ar-explanation ar-explanation--muted">
                <div className="ar-explanation-label">About this spot</div>
                <div className="ar-explanation-text">{explanationError}</div>
              </div>
            ) : selectedPOI && (
              <div className="ar-skeleton">
                <div className="ar-skeleton-line ar-skeleton-line--title" />
                <div className="ar-skeleton-line ar-skeleton-line--long" />
                <div className="ar-skeleton-line ar-skeleton-line--medium" />
                <div className="ar-skeleton-line ar-skeleton-line--short" />
                <div className="ar-skeleton-line ar-skeleton-line--medium" />
              </div>
            )}
          </>
        )}

        {/* Actions */}
        {!selectedPOI.isAnnotation && (
          <div className="ar-info-actions">
            <Link
              to={`/spot/${selectedPOI.isFriendPost ? selectedPOI.postData.spotId : selectedPOI.id}`}
              className="ar-action-btn ar-action-btn--primary"
              style={{ textDecoration: 'none' }}
              onClick={() => stopCamera(true)}
            >
              📄 Details
            </Link>
            <Link
              to={`/directions/${selectedPOI.isFriendPost ? selectedPOI.postData.spotId : selectedPOI.id}`}
              className="ar-action-btn"
              style={{ textDecoration: 'none' }}
              onClick={() => stopCamera(true)}
            >
              📍 Directions
            </Link>
          </div>
        )}

        {/* Alternatives */}
        {alternatives.length > 0 && (
          <div className="ar-alternatives">
            <div className="ar-alternatives-label">
              Similar spots nearby
            </div>
            <div className="ar-alt-list">
              {alternatives.map(alt => (
                <div
                  key={`alt-${alt.id}`}
                  className="ar-alt-card"
                  onClick={() => handleSelectPOI({
                    ...alt,
                    isItineraryStop: false,
                    isAnnotation: false,
                    distance: selectedPOI.distance // rough
                  })}
                >
                  <img
                    src={getIconUrl(alt.type)}
                    alt={alt.type}
                    className="ar-alt-icon"
                  />
                  <div className="ar-alt-info">
                    <div className="ar-alt-name">{alt.name}</div>
                    <div className="ar-alt-meta">
                      {alt.type}
                      {alt.averageRating > 0 && ` · ⭐${alt.averageRating.toFixed?.(1) || alt.averageRating}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
