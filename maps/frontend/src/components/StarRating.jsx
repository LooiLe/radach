import { useState } from 'react'
import './StarRating.css'

export default function StarRating({ value = 0, onChange, readonly = false, size = '1.5rem' }) {
  const [hover, setHover] = useState(0)

  return (
    <div className="star-rating" style={{ fontSize: size }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          className={`star ${n <= (hover || value) ? 'active' : ''} ${readonly ? 'readonly' : ''}`}
          onClick={() => !readonly && onChange?.(n)}
          onMouseEnter={() => !readonly && setHover(n)}
          onMouseLeave={() => !readonly && setHover(0)}
        >
          ★
        </span>
      ))}
    </div>
  )
}

export function formatRating(rating) {
  if (!rating || rating <= 0) return 'No ratings'
  return `★ ${Number.isInteger(rating) ? rating : rating.toFixed(1)}/5`
}
