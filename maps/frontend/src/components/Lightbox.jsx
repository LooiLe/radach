import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import './Lightbox.css'

export default function Lightbox({ images, initialIndex = 0, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') showPrev()
      if (e.key === 'ArrowRight') showNext()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex, images])

  const showNext = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length)
  }

  const showPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  if (!images || images.length === 0) return null

  return createPortal(
    <div className="lightbox-overlay" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose}>✕</button>
      
      {images.length > 1 && (
        <button 
          className="lightbox-nav lightbox-prev" 
          onClick={(e) => { e.stopPropagation(); showPrev(); }}
        >
          ‹
        </button>
      )}

      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <img src={images[currentIndex]} alt={`Photo ${currentIndex + 1}`} className="lightbox-img" />
        <div className="lightbox-counter">
          {currentIndex + 1} / {images.length}
        </div>
      </div>

      {images.length > 1 && (
        <button 
          className="lightbox-nav lightbox-next" 
          onClick={(e) => { e.stopPropagation(); showNext(); }}
        >
          ›
        </button>
      )}
    </div>,
    document.body
  )
}
