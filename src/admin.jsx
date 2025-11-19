import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './globals.css'

function AdminPanel() {
  const [authStatus, setAuthStatus] = useState('loading')
  const [activeTab, setActiveTab] = useState('users')
  const [stats, setStats] = useState({})
  const [users, setUsers] = useState([])
  const [serials, setSerials] = useState([])
  const [serialsPage, setSerialsPage] = useState(0)
  const [showLoginHistory, setShowLoginHistory] = useState(false)
  const [loginHistory, setLoginHistory] = useState([])
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [selectedUserName, setSelectedUserName] = useState('')

  useEffect(() => {
    fetch('/api/auth/status', { credentials: 'include' })
      .then(r => {
        if (r.status === 401) {
          window.location.href = '/login?message=session-expired'
          return
        }
        return r.json()
      })
      .then(data => {
        if (!data) return
        if (data.status === 'admin') {
          setAuthStatus('authorized')
          loadData()
        } else {
          setAuthStatus('unauthorized')
        }
      })
      .catch(() => setAuthStatus('unauthorized'))
  }, [])

  const loadData = async () => {
    try {
      const statsRes = await fetch('/api/admin/stats', { credentials: 'include' })
      if (statsRes.status === 401) {
        window.location.href = '/login?message=session-expired'
        return
      }
      const statsData = await statsRes.json()

      setStats(statsData.overview || {})
      setUsers(statsData.users || [])
      setSerials(statsData.serials || [])
    } catch (err) {
      console.error('Failed to load admin data:', err)
    }
  }

  const approveUser = async (userId) => {
    try {
      const r = await fetch(`/api/admin/users/${userId}/approve`, {
        method: 'POST',
        credentials: 'include'
      })
      if (r.status === 401) {
        window.location.href = '/login?message=session-expired'
        return
      }
      loadData()
    } catch (err) {
      console.error('Failed to approve user:', err)
    }
  }

  const rejectUser = async (userId) => {
    try {
      const r = await fetch(`/api/admin/users/${userId}/reject`, {
        method: 'POST',
        credentials: 'include'
      })
      if (r.status === 401) {
        window.location.href = '/login?message=session-expired'
        return
      }
      loadData()
    } catch (err) {
      console.error('Failed to reject user:', err)
    }
  }

  const deleteUser = async (userId, userName) => {
    if (!confirm(`Delete user "${userName}"? This cannot be undone.`)) {
      return
    }

    try {
      const r = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      if (r.status === 401) {
        window.location.href = '/login?message=session-expired'
        return
      }
      if (!r.ok) {
        const data = await r.json()
        alert(data.error || 'Failed to delete user')
        return
      }
      loadData()
    } catch (err) {
      console.error('Failed to delete user:', err)
      alert('Failed to delete user: ' + err.message)
    }
  }

  const updateWhatsApp = async (userId, currentWhatsApp) => {
    const newWhatsApp = prompt('Enter new WhatsApp number:', currentWhatsApp || '')
    if (newWhatsApp === null) return

    try {
      const r = await fetch(`/api/admin/users/${userId}/whatsapp`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ whatsapp: newWhatsApp })
      })
      if (r.status === 401) {
        window.location.href = '/login?message=session-expired'
        return
      }
      loadData()
    } catch (err) {
      console.error('Failed to update WhatsApp:', err)
      alert('Failed to update WhatsApp number')
    }
  }

  const toggleWaNoti = async (userId, currentStatus) => {
    try {
      const r = await fetch(`/api/admin/users/${userId}/wa-noti`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ waNoti: !currentStatus })
      })
      if (r.status === 401) {
        window.location.href = '/login?message=session-expired'
        return
      }
      loadData()
    } catch (err) {
      console.error('Failed to toggle wa_noti:', err)
      alert('Failed to toggle WhatsApp notification')
    }
  }

  const loadLoginHistory = async (userId, userName) => {
    try {
      const r = await fetch(`/api/admin/users/${userId}/login-history`, { credentials: 'include' })
      if (r.status === 401) {
        window.location.href = '/login?message=session-expired'
        return
      }
      if (!r.ok) {
        throw new Error('Failed to load login history')
      }
      const data = await r.json()
      setSelectedUserId(userId)
      setSelectedUserName(userName)
      setLoginHistory(data.history || [])
      setShowLoginHistory(true)
    } catch (err) {
      console.error('Failed to load login history:', err)
      alert('Failed to load login history')
    }
  }

  if (authStatus === 'loading') {
    return (
      <div className="admin-container">
        <div className="admin-loading">Loading...</div>
      </div>
    )
  }

  if (authStatus === 'unauthorized') {
    return (
      <div className="admin-container">
        <div className="admin-error">
          <h1>Unauthorized</h1>
          <p>You don't have admin access</p>
        </div>
      </div>
    )
  }

  const pendingUsers = users.filter(u => u.status === 'pending')
  const approvedUsers = users.filter(u => u.status === 'approved')
  const adminUsers = users.filter(u => u.status === 'admin')

  return (
    <div className="admin-container">
      {/* Header */}
      <div className="admin-header">
        <div className="admin-brand">
          <div className="admin-logo">T</div>
          <div>
            <div className="admin-title">TubeKit Admin</div>
            <div className="admin-subtitle">System Dashboard</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="admin-stats">
        <div className="admin-stat-card">
          <div className="admin-stat-label">Total Downloads</div>
          <div className="admin-stat-value">{stats.totalDownloads || 0}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Today</div>
          <div className="admin-stat-value">{stats.downloadsToday || 0}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Last 7 Days</div>
          <div className="admin-stat-value">{stats.downloadsLastWeek || 0}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Users</div>
          <div className="admin-stat-value">{users.length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Users ({users.length})
        </button>
        <button
          className={`admin-tab ${activeTab === 'serials' ? 'active' : ''}`}
          onClick={() => setActiveTab('serials')}
        >
          Serials ({serials.length})
        </button>
      </div>

      {/* Content */}
      <div className="admin-content">
        {activeTab === 'users' && (
          <div className="admin-section">
            {/* Pending Users */}
            {pendingUsers.length > 0 && (
              <div className="admin-subsection">
                <div className="admin-subsection-title">
                  Pending Approval ({pendingUsers.length})
                </div>
                <div className="admin-user-grid">
                  {pendingUsers.map(user => (
                    <div key={user.id} className="admin-user-card pending">
                      <div className="admin-user-info">
                        <div className="admin-user-name">{user.name}</div>
                        <div className="admin-user-email">{user.email}</div>
                        <div className="admin-user-whatsapp">
                          {user.whatsapp || 'No WhatsApp'}
                          <button
                            className="admin-btn-small"
                            onClick={() => updateWhatsApp(user.id, user.whatsapp)}
                            title="Edit WhatsApp number"
                          >
                            Edit
                          </button>
                        </div>
                        <div className="admin-user-wa-noti">
                          WA Notification: {user.wa_noti ? 'Enabled' : 'Disabled'}
                          <button
                            className="admin-btn-small"
                            onClick={() => toggleWaNoti(user.id, user.wa_noti)}
                            title="Toggle WhatsApp notification"
                          >
                            {user.wa_noti ? 'Disable' : 'Enable'}
                          </button>
                        </div>
                      </div>
                      <div className="admin-user-actions">
                        <button
                          className="admin-btn approve"
                          onClick={() => approveUser(user.id)}
                        >
                          Approve
                        </button>
                        <button
                          className="admin-btn reject"
                          onClick={() => rejectUser(user.id)}
                        >
                          Reject
                        </button>
                        <button
                          className="admin-btn delete"
                          onClick={() => deleteUser(user.id, user.name)}
                          title="Delete user permanently"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Approved Users */}
            {approvedUsers.length > 0 && (
              <div className="admin-subsection">
                <div className="admin-subsection-title">
                  Approved Users ({approvedUsers.length})
                </div>
                <div className="admin-user-list">
                  {approvedUsers.map(user => (
                    <div key={user.id} className="admin-user-row">
                      <div className="admin-user-info">
                        <span className="admin-user-name">{user.name}</span>
                        <span className="admin-user-email">{user.email}</span>
                        <span className="admin-user-whatsapp">
                          {user.whatsapp || 'No WhatsApp'}
                          <button
                            className="admin-btn-icon"
                            onClick={() => updateWhatsApp(user.id, user.whatsapp)}
                            title="Edit WhatsApp number"
                          >
                            ✎
                          </button>
                        </span>
                        <span className="admin-user-wa-noti">
                          WA: {user.wa_noti ? 'ON' : 'OFF'}
                          <button
                            className="admin-btn-icon"
                            onClick={() => toggleWaNoti(user.id, user.wa_noti)}
                            title="Toggle WhatsApp notification"
                          >
                            {user.wa_noti ? '✓' : '✗'}
                          </button>
                        </span>
                      </div>
                      <div className="admin-user-meta">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: '#64748b' }}>
                          <span className="admin-user-downloads">
                            {user.totalDownloads || 0} downloads
                          </span>
                          <span className="admin-user-login-stats">
                            {user.total_logins || 0} logins • {user.unique_devices || 0} devices • {user.unique_ips || 0} IPs
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            className="admin-btn-icon"
                            onClick={() => loadLoginHistory(user.id, user.name)}
                            title="View login history"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 3h18v18H3zM9 9h6M9 15h6M9 12h6"/>
                            </svg>
                          </button>
                          <button
                            className="admin-btn-icon delete"
                            onClick={() => deleteUser(user.id, user.name)}
                            title="Delete user"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Admin Users */}
            {adminUsers.length > 0 && (
              <div className="admin-subsection">
                <div className="admin-subsection-title">
                  Administrators ({adminUsers.length})
                </div>
                <div className="admin-user-list">
                  {adminUsers.map(user => (
                    <div key={user.id} className="admin-user-row admin">
                      <div className="admin-user-info">
                        <span className="admin-user-name">{user.name}</span>
                        <span className="admin-user-email">{user.email}</span>
                      </div>
                      <div className="admin-user-meta">
                        <span className="admin-badge">Admin</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'serials' && (
          <div className="admin-section">
            <div className="admin-subsection">
              <div className="admin-subsection-title">
                Top Downloading Serials ({serials.length} total)
              </div>
              <div className="admin-serial-list">
                {serials.slice(serialsPage * 30, (serialsPage + 1) * 30).map(serial => (
                  <div key={serial.id} className="admin-serial-row">
                    <div className="admin-serial-info">
                      <span className="admin-serial-name">{serial.name}</span>
                      <span className="admin-serial-platform">{serial.platform_name}</span>
                    </div>
                    <div className="admin-serial-meta">
                      <span className="admin-serial-downloads">
                        {serial.totalDownloads || 0} downloads
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {serials.length > 30 && (
                <div className="admin-pagination">
                  <button
                    className="admin-btn"
                    onClick={() => setSerialsPage(Math.max(0, serialsPage - 1))}
                    disabled={serialsPage === 0}
                  >
                    Previous
                  </button>
                  <span className="admin-pagination-info">
                    Page {serialsPage + 1} of {Math.ceil(serials.length / 30)}
                  </span>
                  <button
                    className="admin-btn"
                    onClick={() => setSerialsPage(Math.min(Math.ceil(serials.length / 30) - 1, serialsPage + 1))}
                    disabled={serialsPage >= Math.ceil(serials.length / 30) - 1}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showLoginHistory && (
        <div className="modal-bg show">
          <div className="modal" style={{ maxWidth: '800px', maxHeight: '80vh', overflow: 'auto' }}>
            <button className="modal-close" onClick={() => setShowLoginHistory(false)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <div className="modal-hdr">
              <div className="modal-title">Login History</div>
              <div className="modal-subtitle">{selectedUserName ? `Complete login timeline for ${selectedUserName}` : 'Complete login timeline for user'}</div>
            </div>
            <div style={{ padding: '20px' }}>
              {loginHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No login history found</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {loginHistory.map((entry, idx) => (
                    <div key={entry.id || idx} style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                        <div style={{ fontWeight: '600', color: '#1e293b' }}>
                          {new Date(entry.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <div style={{ fontSize: '13px', color: '#64748b', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div><strong>IP:</strong> {entry.ip || 'N/A'}</div>
                        <div><strong>Device:</strong> {entry.device_fingerprint ? entry.device_fingerprint.substring(0, 16) + '...' : 'N/A'}</div>
                        <div><strong>Screen:</strong> {entry.screen_resolution || 'N/A'}</div>
                        <div><strong>Timezone:</strong> {entry.timezone || 'N/A'}</div>
                      </div>
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#94a3b8' }}>
                        <strong>User Agent:</strong> {entry.user_agent || 'N/A'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

createRoot(document.getElementById('root')).render(<AdminPanel />)
