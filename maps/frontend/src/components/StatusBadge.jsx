export default function StatusBadge({ status }) {
  const s = (status || '').toUpperCase()
  const cls = s === 'ACTIVE' ? 'badge-active'
    : s === 'PENDING' ? 'badge-pending'
    : 'badge-inactive'
  return <span className={`badge ${cls}`}>{status}</span>
}
