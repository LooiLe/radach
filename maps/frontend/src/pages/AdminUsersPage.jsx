import { useState, useEffect, useCallback } from 'react'
import { useApi } from '../hooks/useApi'
import './AdminUsersPage.css'

export default function AdminUsersPage() {
  const { apiFetch } = useApi()
  const [users, setUsers] = useState([])
  const [emailFilter, setEmailFilter] = useState('')
  const [msg, setMsg] = useState({ type: '', text: '' })

  const load = useCallback(async (email) => {
    try {
      let url = '/api/v1/super-admin/users'
      if (email?.trim()) url += `?email=${encodeURIComponent(email.trim())}`
      const res = await apiFetch(url)
      if (res.ok) setUsers(await res.json())
    } catch { /* ignore */ }
  }, [apiFetch])

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const promote = async (id) => {
    setMsg({ type: '', text: '' })
    try {
      const res = await apiFetch(`/api/v1/super-admin/users/${id}/promote`, { method: 'PUT' })
      const data = await res.json()
      if (res.ok) { setMsg({ type: 'success', text: `✓ ${data.name} promoted to ADMIN!` }); load(emailFilter) }
      else setMsg({ type: 'error', text: data.error || 'Failed.' })
    } catch { setMsg({ type: 'error', text: 'Server error.' }) }
  }

  const demote = async (id) => {
    setMsg({ type: '', text: '' })
    try {
      const res = await apiFetch(`/api/v1/super-admin/users/${id}/demote`, { method: 'PUT' })
      const data = await res.json()
      if (res.ok) { setMsg({ type: 'success', text: `✓ ${data.name} demoted to USER.` }); load(emailFilter) }
      else setMsg({ type: 'error', text: data.error || 'Failed.' })
    } catch { setMsg({ type: 'error', text: 'Server error.' }) }
  }

  const roleBadgeCls = (r) => r === 'SUPER_ADMIN' ? 'badge-role' : r === 'ADMIN' ? 'badge-pending' : 'badge-inactive'

  return (
    <div className="users-page animate-fade-up">
      <h1 className="page-title"> Manage Users</h1>
      <p className="page-sub">Promote <strong>USER</strong> → <strong>ADMIN</strong>, or demote <strong>ADMIN</strong> → <strong>USER</strong>.</p>
      {msg.text && <div className={`msg msg-${msg.type}`}>{msg.text}</div>}

      <div className="users-search">
        <input className="input" value={emailFilter} onChange={e => setEmailFilter(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load(emailFilter)} placeholder="Search by email..." />
        <button className="btn btn-primary" onClick={() => load(emailFilter)}> Search</button>
        {emailFilter && <button className="btn" onClick={() => { setEmailFilter(''); load('') }}>Clear</button>}
      </div>

      <div className="users-table-wrap glass">
        <table className="users-table">
          <thead>
            <tr><th>ID</th><th>Name</th><th>Email</th><th>Role</th><th>Action</th></tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td><span className={`badge ${roleBadgeCls(u.role)}`}>{u.role}</span></td>
                <td>
                  {u.role === 'USER' && <button className="btn btn-primary btn-sm" onClick={() => promote(u.id)}>↑ Promote</button>}
                  {u.role === 'ADMIN' && <button className="btn btn-danger btn-sm" onClick={() => demote(u.id)}>↓ Demote</button>}
                  {u.role === 'SUPER_ADMIN' && <span className="text-muted">—</span>}
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No users found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
