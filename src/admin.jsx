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
  const [planDays, setPlanDays] = useState({})
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [userToDelete, setUserToDelete] = useState(null)
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false)
  const [whatsAppData, setWhatsAppData] = useState({ userId: null, current: '' })
  const [showExtendPlanModal, setShowExtendPlanModal] = useState(false)
  const [extendPlanData, setExtendPlanData] = useState({ userId: null, userName: '', days: '30' })
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' })

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
      const days = planDays[userId] || 3 // Default to 3 days
      const user = users.find(u => u.id === userId)
      const r = await fetch(`/api/admin/users/${userId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ days })
      })
      if (r.status === 401) {
        window.location.href = '/login?message=session-expired'
        return
      }
      if (!r.ok) {
        const data = await r.json()
        showToast(data.error || 'Failed to approve user', 'error')
        return
      }
      // Clear the planDays for this user
      setPlanDays(prev => {
        const newState = { ...prev }
        delete newState[userId]
        return newState
      })
      loadData()
      showToast(`User "${user?.name || 'User'}" approved with ${days} days free trial`, 'success')
    } catch (err) {
      console.error('Failed to approve user:', err)
      showToast('Failed to approve user: ' + err.message, 'error')
    }
  }

  const rejectUser = async (userId) => {
    try {
      const user = users.find(u => u.id === userId)
      const r = await fetch(`/api/admin/users/${userId}/reject`, {
        method: 'POST',
        credentials: 'include'
      })
      if (r.status === 401) {
        window.location.href = '/login?message=session-expired'
        return
      }
      if (!r.ok) {
        const data = await r.json()
        showToast(data.error || 'Failed to reject user', 'error')
        return
      }
      loadData()
      showToast(`User "${user?.name || 'User'}" rejected`, 'success')
    } catch (err) {
      console.error('Failed to reject user:', err)
      showToast('Failed to reject user: ' + err.message, 'error')
    }
  }

  const showDeleteConfirmation = (userId, userName) => {
    setUserToDelete({ id: userId, name: userName })
    setShowDeleteModal(true)
  }

  const deleteUser = async () => {
    if (!userToDelete) return

    try {
      const r = await fetch(`/api/admin/users/${userToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      if (r.status === 401) {
        window.location.href = '/login?message=session-expired'
        return
      }
      if (!r.ok) {
        const data = await r.json()
        showToast(data.error || 'Failed to delete user', 'error')
        setShowDeleteModal(false)
        setUserToDelete(null)
        return
      }
      setShowDeleteModal(false)
      setUserToDelete(null)
      loadData()
      showToast(`User "${userToDelete.name}" deleted successfully`, 'success')
    } catch (err) {
      console.error('Failed to delete user:', err)
      showToast('Failed to delete user: ' + err.message, 'error')
      setShowDeleteModal(false)
      setUserToDelete(null)
    }
  }

  const showWhatsAppEdit = (userId, currentWhatsApp) => {
    setWhatsAppData({ userId, current: currentWhatsApp || '' })
    setShowWhatsAppModal(true)
  }

  const updateWhatsApp = async () => {
    if (!whatsAppData.userId) return

    try {
      const r = await fetch(`/api/admin/users/${whatsAppData.userId}/whatsapp`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ whatsapp: whatsAppData.current })
      })
      if (r.status === 401) {
        window.location.href = '/login?message=session-expired'
        return
      }
      if (!r.ok) {
        const data = await r.json()
        showToast(data.error || 'Failed to update WhatsApp', 'error')
        return
      }
      setShowWhatsAppModal(false)
      setWhatsAppData({ userId: null, current: '' })
      loadData()
      showToast('WhatsApp number updated successfully', 'success')
    } catch (err) {
      console.error('Failed to update WhatsApp:', err)
      showToast('Failed to update WhatsApp number', 'error')
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
      if (!r.ok) {
        const data = await r.json()
        showToast(data.error || 'Failed to toggle notification', 'error')
        return
      }
      loadData()
      showToast(`WhatsApp notification ${!currentStatus ? 'enabled' : 'disabled'}`, 'success')
    } catch (err) {
      console.error('Failed to toggle wa_noti:', err)
      showToast('Failed to toggle WhatsApp notification', 'error')
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
      showToast('Failed to load login history', 'error')
    }
  }

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000)
  }

  const showExtendPlan = (userId, userName) => {
    setExtendPlanData({ userId, userName, days: '30' })
    setShowExtendPlanModal(true)
  }

  const extendUserPlan = async () => {
    if (!extendPlanData.userId) return

    const daysNumber = Number(extendPlanData.days)
    if (isNaN(daysNumber) || daysNumber <= 0) {
      showToast('Please enter a valid number of days', 'error')
      return
    }

    try {
      const r = await fetch(`/api/admin/users/${extendPlanData.userId}/extend-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ days: daysNumber })
      })
      if (r.status === 401) {
        window.location.href = '/login?message=session-expired'
        return
      }
      if (!r.ok) {
        const data = await r.json()
        showToast(data.error || 'Failed to extend plan', 'error')
        return
      }
      setShowExtendPlanModal(false)
      setExtendPlanData({ userId: null, userName: '', days: '30' })
      loadData()
      showToast(`Plan extended by ${daysNumber} days successfully`, 'success')
    } catch (err) {
      console.error('Failed to extend plan:', err)
      showToast('Failed to extend plan: ' + err.message, 'error')
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
                            onClick={() => showWhatsAppEdit(user.id, user.whatsapp)}
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
                        <div className="admin-user-plan-days">
                          <label>Free Trial Days:</label>
                          <input
                            type="number"
                            min="1"
                            value={planDays[user.id] || 3}
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value)
                              if (val === '' || (val > 0 && val <= 365)) {
                                setPlanDays(prev => ({ ...prev, [user.id]: val }))
                              }
                            }}
                          />
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
                          onClick={() => showDeleteConfirmation(user.id, user.name)}
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
                  {approvedUsers.map(user => {
                    const planExpired = user.plan_expiry_date ? new Date(user.plan_expiry_date) < new Date() : true
                    const expiryDateStr = user.plan_expiry_date ? new Date(user.plan_expiry_date).toLocaleDateString() : 'Not set'
                    
                    return (
                      <div key={user.id} className="admin-user-row">
                        <div className="admin-user-info">
                          <span className="admin-user-name">{user.name}</span>
                          <span className="admin-user-email">{user.email}</span>
                          <span className="admin-user-whatsapp">
                            {user.whatsapp || 'No WhatsApp'}
                            <button
                              className="admin-btn-icon"
                              onClick={() => showWhatsAppEdit(user.id, user.whatsapp)}
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
                          <span style={{ 
                            fontSize: '12px', 
                            fontWeight: '600',
                            color: planExpired ? '#ef4444' : '#10b981',
                            background: planExpired ? '#fee2e2' : '#d1fae5',
                            padding: '4px 10px',
                            borderRadius: '12px'
                          }}>
                            {planExpired ? '🔴 Expired' : '🟢 Active'} • {expiryDateStr}
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
                              onClick={() => showExtendPlan(user.id, user.name)}
                              title="Extend plan"
                              style={{ background: '#10b981', color: 'white', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '500' }}
                            >
                              Extend
                            </button>
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
                              onClick={() => showDeleteConfirmation(user.id, user.name)}
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
                    )
                  })}
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

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-bg show">
          <div className="modal" style={{ maxWidth: '420px' }}>
            <button className="modal-close" onClick={() => { setShowDeleteModal(false); setUserToDelete(null) }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <div className="modal-hdr">
              <div className="modal-icon error">
                <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
              </div>
              <div className="modal-title">Delete User</div>
              <div className="modal-subtitle">Are you sure you want to delete "{userToDelete?.name}"? This action cannot be undone.</div>
            </div>
            <div className="confirm-actions">
              <button className="confirm-btn cancel" onClick={() => { setShowDeleteModal(false); setUserToDelete(null) }}>
                Cancel
              </button>
              <button className="confirm-btn delete" onClick={deleteUser}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Edit Modal */}
      {showWhatsAppModal && (
        <div className="modal-bg show">
          <div className="modal" style={{ maxWidth: '420px' }}>
            <button className="modal-close" onClick={() => { setShowWhatsAppModal(false); setWhatsAppData({ userId: null, current: '' }) }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <div className="modal-hdr">
              <div className="modal-icon">
                <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
              </div>
              <div className="modal-title">Edit WhatsApp Number</div>
              <div className="modal-subtitle">Update the WhatsApp number for this user</div>
            </div>
            <div style={{ marginTop: '24px' }}>
              <div className="auth-field">
                <label className="auth-label">WhatsApp Number</label>
                <input
                  type="text"
                  className="auth-input"
                  value={whatsAppData.current}
                  onChange={(e) => setWhatsAppData(prev => ({ ...prev, current: e.target.value }))}
                  placeholder="Enter WhatsApp number"
                  autoFocus
                />
              </div>
              <div className="confirm-actions" style={{ marginTop: '24px' }}>
                <button className="confirm-btn cancel" onClick={() => { setShowWhatsAppModal(false); setWhatsAppData({ userId: null, current: '' }) }}>
                  Cancel
                </button>
                <button className="confirm-btn" style={{ background: 'var(--accent)', borderColor: 'var(--accent)', color: 'white' }} onClick={updateWhatsApp}>
                  Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Extend Plan Modal */}
      {showExtendPlanModal && (
        <div className="modal-bg show">
          <div className="modal" style={{ maxWidth: '420px' }}>
            <button className="modal-close" onClick={() => { setShowExtendPlanModal(false); setExtendPlanData({ userId: null, userName: '', days: '30' }) }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <div className="modal-hdr">
              <div className="modal-icon" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="white">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
              </div>
              <div className="modal-title">Extend Plan</div>
              <div className="modal-subtitle">Extend plan for {extendPlanData.userName}</div>
            </div>
            <div style={{ marginTop: '24px' }}>
              <div className="auth-field">
                <label className="auth-label">Number of Days</label>
                <input
                  type="number"
                  min="1"
                  className="auth-input"
                  value={extendPlanData.days}
                  onChange={(e) => setExtendPlanData(prev => ({ ...prev, days: e.target.value }))}
                  placeholder="Enter days (e.g., 30, 60)"
                  autoFocus
                />
              </div>
              <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', fontSize: '13px', color: '#10b981' }}>
                💡 Common plans: 30 days (1 month) or 60 days (2 months)
              </div>
              <div className="confirm-actions" style={{ marginTop: '24px' }}>
                <button className="confirm-btn cancel" onClick={() => { setShowExtendPlanModal(false); setExtendPlanData({ userId: null, userName: '', days: '30' }) }}>
                  Cancel
                </button>
                <button className="confirm-btn" style={{ background: '#10b981', borderColor: '#10b981', color: 'white' }} onClick={extendUserPlan}>
                  Extend Plan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div className={`admin-toast ${toast.type}`}>
          <div className="admin-toast-icon">
            {toast.type === 'success' ? (
              <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
            )}
          </div>
          <div className="admin-toast-message">{toast.message}</div>
        </div>
      )}
    </div>
  )
}

createRoot(document.getElementById('root')).render(<AdminPanel />)


