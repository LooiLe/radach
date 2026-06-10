import './RatingModeSelector.css'

export default function RatingModeSelector({ mode, onChange }) {
  const modes = [
    { key: 'trusted', label: 'Trusted' },
    { key: 'global', label: 'Global' },
    { key: 'expert', label: 'Experts' },
  ]

  return (
    <div className="rating-mode-selector">
      {modes.map(m => (
        <button
          key={m.key}
          className={`rating-mode-btn ${mode === m.key ? 'active' : ''}`}
          onClick={() => onChange(m.key)}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}