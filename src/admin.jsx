import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './globals.css'

function AdminPanel() {
  const [authStatus, setAuthStatus] = useState('loading')
  const [activeTab, setActiveTab] = useState('users')
  const [stats, setStats] = useState({})
  const [users, setUsers] = useState([])
  const [serials, setSerials] = useState([])

  useEffect(() => {
    // Check admin auth
    fetch('/api/auth/status', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
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
      // Load stats and users
      const statsRes = await fetch('/api/admin/stats', { credentials: 'include' })
      const statsData = await statsRes.json()

      setStats(statsData.overview || {})
      setUsers(statsData.users || [])
      setSerials((statsData.serials || []).slice(0, 50))
    } catch (err) {
      console.error('Failed to load admin data:', err)
    }
  }

  const approveUser = async (userId) => {
    try {
      await fetch(`/api/admin/users/${userId}/approve`, {
        method: 'POST',
        credentials: 'include'
      })
      loadData()
    } catch (err) {
      console.error('Failed to approve user:', err)
    }
  }

  const rejectUser = async (userId) => {
    try {
      await fetch(`/api/admin/users/${userId}/reject`, {
        method: 'POST',
        credentials: 'include'
      })
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
      await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      loadData()
    } catch (err) {
      console.error('Failed to delete user:', err)
      alert('Failed to delete user')
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
                        {user.whatsapp && (
                          <div className="admin-user-whatsapp">{user.whatsapp}</div>
                        )}
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
                        {user.whatsapp && (
                          <span className="admin-user-whatsapp">{user.whatsapp}</span>
                        )}
                      </div>
                      <div className="admin-user-meta">
                        <span className="admin-user-downloads">
                          {user.totalDownloads || 0} downloads
                        </span>
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
                All Serials ({serials.length})
              </div>
              <div className="admin-serial-list">
                {serials.map(serial => (
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
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<AdminPanel />)
