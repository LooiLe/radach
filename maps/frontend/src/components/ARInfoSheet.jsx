import React from 'react'
import { Link } from 'react-router-dom'

export default function ARInfoSheet({
  showInfoSheet,
  selectedPOI,
  handleCloseSheet,
  explanation,
  explanationError,
  itineraryId,
  nextItineraryStop,
  routeInsight,
  itineraryActionLoading,
  handleAddSelectedAfterCurrent,
  handleReplaceNextStop,
  stopCamera,
  getIconUrl,
  formatDistance
}) {
  if (!showInfoSheet || !selectedPOI) return null

  const canEditItineraryFromSpot =
    itineraryId && !selectedPOI.isItineraryStop && !selectedPOI.isAnnotation && !selectedPOI.isFriendPost
  const spotId = selectedPOI.isFriendPost ? selectedPOI.postData.spotId : selectedPOI.id
  const replaceLabel = nextItineraryStop?.spot?.name
    ? `Replace #${nextItineraryStop.stopOrder || ''}`
    : 'Replace next stop'
  const preferReplace = routeInsight?.tone === 'swap'

  return (
    <div className={`ar-info-sheet ${showInfoSheet ? 'ar-info-sheet--open' : ''}`}>
      <div className="ar-info-sheet-content">
        <div className="ar-info-drag-handle" />

        {!selectedPOI.isAnnotation && !selectedPOI.isFriendPost && selectedPOI.photos?.length > 0 && (
          <div className="ar-info-photos">
            {selectedPOI.photos.slice(0, 4).map((url, idx) => (
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
          <div className="ar-info-title-block">
            <div className="ar-info-spot-name">
              {selectedPOI.isItineraryStop && (
                <span className="ar-info-stop-number">#{selectedPOI.stopNumber}</span>
              )}
              {selectedPOI.name}
            </div>
            <div className="ar-info-meta">
              <span>{formatDistance(selectedPOI.distance)}</span>
              {!selectedPOI.isAnnotation && !selectedPOI.isFriendPost && selectedPOI.averageRating > 0 && (
                <span>
                  Rating <span className="ar-info-rating">{selectedPOI.averageRating?.toFixed?.(1) || selectedPOI.averageRating}</span>
                </span>
              )}
            </div>
          </div>

          <div className="ar-info-header-actions">
            {!selectedPOI.isAnnotation && !selectedPOI.isFriendPost && (
              <span className="ar-info-spot-type">
                <img src={getIconUrl(selectedPOI.type)} alt="" className="ar-info-spot-type-icon" />
                {selectedPOI.type}
              </span>
            )}
            {selectedPOI.isAnnotation && (
              <span className="ar-info-spot-type ar-info-spot-type--annotation">Annotation</span>
            )}
            {selectedPOI.isFriendPost && (
              <span className="ar-info-spot-type ar-info-spot-type--friend">Friend tip</span>
            )}
            <button className="ar-info-close-btn" onClick={handleCloseSheet}>x</button>
          </div>
        </div>

        {selectedPOI.isAnnotation && selectedPOI.annotationData && (
          <div className="ar-annotation-detail">
            <div className="ar-annotation-detail-author">
              {selectedPOI.annotationData.authorName}
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

        {selectedPOI.isFriendPost && selectedPOI.postData && (
          <div className="ar-friend-post-detail">
            <div className="ar-friend-post-author">
              {selectedPOI.postData.authorProfilePicture ? (
                <img
                  src={selectedPOI.postData.authorProfilePicture}
                  alt={selectedPOI.postData.authorName}
                  className="ar-friend-post-avatar"
                />
              ) : (
                <div className="ar-friend-post-avatar ar-friend-post-avatar--empty">
                  {selectedPOI.postData.authorName?.charAt(0) || '?'}
                </div>
              )}
              <div>
                <div className="ar-friend-post-name">{selectedPOI.postData.authorName}</div>
                <div className="ar-friend-post-date">
                  {selectedPOI.postData.spotName} - {new Date(selectedPOI.postData.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
            <div className="ar-friend-post-text">
              {selectedPOI.postData.content}
            </div>
            {selectedPOI.postData.mediaUrls?.length > 0 && (
              <div className="ar-friend-post-photos">
                {selectedPOI.postData.mediaUrls.slice(0, 3).map((url, idx) => (
                  <img
                    key={`post-img-${idx}`}
                    src={url}
                    alt="Friend tip attachment"
                    className="ar-friend-post-photo"
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {!selectedPOI.isAnnotation && !selectedPOI.isFriendPost && (
          <>
            {routeInsight && (
              <div className={`ar-route-insight ar-route-insight--${routeInsight.tone}`}>
                <div className="ar-route-insight-kicker">Route check</div>
                <div className="ar-route-insight-title">{routeInsight.title}</div>
                <div className="ar-route-insight-text">{routeInsight.text}</div>
              </div>
            )}

            {explanation ? (
              <div className="ar-explanation ar-explanation--compact ar-explanation--animated">
                <div className="ar-explanation-label">Why this spot</div>
                <div className="ar-explanation-text">
                  {explanation.whatIsThis && (
                    <div className="ar-explanation-desc ar-stagger-1">
                      {explanation.whatIsThis}
                    </div>
                  )}
                  {explanation.visitTip && (
                    <div className="ar-explanation-tip ar-stagger-2">
                      <span className="ar-explanation-kicker">Best move</span>
                      <span>{explanation.visitTip}</span>
                    </div>
                  )}
                </div>

                {itineraryId && explanation.shouldYouSwitch && (
                  <div className="ar-explanation-switch ar-stagger-3">
                    <div className="ar-explanation-switch-title">Itinerary call</div>
                    <div className="ar-explanation-switch-content">
                      {explanation.shouldYouSwitch}
                    </div>
                  </div>
                )}
              </div>
            ) : explanationError ? (
              <div className="ar-explanation ar-explanation--muted">
                <div className="ar-explanation-label">Why this spot</div>
                <div className="ar-explanation-text">{explanationError}</div>
              </div>
            ) : (
              <div className="ar-skeleton ar-skeleton--compact">
                <div className="ar-skeleton-line ar-skeleton-line--title" />
                <div className="ar-skeleton-line ar-skeleton-line--long" />
                <div className="ar-skeleton-line ar-skeleton-line--medium" />
              </div>
            )}
          </>
        )}

        {canEditItineraryFromSpot && (
          <div className={`ar-itinerary-actions ${preferReplace ? 'ar-itinerary-actions--swap' : ''}`}>
            {preferReplace ? (
              <>
                <button
                  type="button"
                  className="ar-action-btn ar-action-btn--primary"
                  disabled={itineraryActionLoading || !nextItineraryStop}
                  onClick={() => handleReplaceNextStop(selectedPOI)}
                >
                  {itineraryActionLoading ? 'Updating...' : replaceLabel}
                </button>
                <button
                  type="button"
                  className="ar-action-btn"
                  disabled={itineraryActionLoading}
                  onClick={() => handleAddSelectedAfterCurrent(selectedPOI)}
                >
                  Add after current
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="ar-action-btn ar-action-btn--primary"
                  disabled={itineraryActionLoading}
                  onClick={() => handleAddSelectedAfterCurrent(selectedPOI)}
                >
                  {itineraryActionLoading ? 'Updating...' : 'Add after current'}
                </button>
                <button
                  type="button"
                  className="ar-action-btn"
                  disabled={itineraryActionLoading || !nextItineraryStop}
                  onClick={() => handleReplaceNextStop(selectedPOI)}
                >
                  {replaceLabel}
                </button>
              </>
            )}
          </div>
        )}

        {!selectedPOI.isAnnotation && (
          <div className="ar-info-actions">
            <Link
              to={`/directions/${spotId}`}
              className="ar-action-btn ar-action-btn--primary"
              style={{ textDecoration: 'none' }}
              onClick={() => stopCamera(true)}
            >
              Directions
            </Link>
            <Link
              to={`/spot/${spotId}`}
              className="ar-action-btn"
              style={{ textDecoration: 'none' }}
              onClick={() => stopCamera(true)}
            >
              Full details
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
