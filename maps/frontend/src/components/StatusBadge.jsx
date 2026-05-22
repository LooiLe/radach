export default function StatusBadge({ status }) {
  const s = (status || '').toUpperCase()
  const cls = s === 'ACTIVE' ? 'badge-active'
    : s === 'PENDING' ? 'badge-pending'
    : s === 'ENDED' ? 'badge-ended'
    : 'badge-inactive'
  return <span className={`badge ${cls}`}>{status}</span>
}
