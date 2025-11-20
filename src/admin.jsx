import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './globals.css'

function AdminPanel() {
  const [authStatus, setAuthStatus] = useState('loading')
  const [activeTab, setActiveTab] = useState('users')
  const [userFilter, setUserFilter] = useState('all') // all, pending, approved, admin
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
  const [showUserSerialsModal, setShowUserSerialsModal] = useState(false)
  const [userSerials, setUserSerials] = useState([])
  const [selectedUserForSerials, setSelectedUserForSerials] = useState({ id: null, name: '' })
  const [showUserDownloadsModal, setShowUserDownloadsModal] = useState(false)
  const [userDownloads, setUserDownloads] = useState([])
  const [selectedUserForDownloads, setSelectedUserForDownloads] = useState({ id: null, name: '' })
  const [downloadPeriod, setDownloadPeriod] = useState('today')
  const [downloadStats, setDownloadStats] = useState({ count: 0, period: 'Today' })
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
      showToast(`User "${user?.name || 'User'}" approved`, 'success')
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
      showToast(`User deleted successfully`, 'success')
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
      showToast('WhatsApp number updated', 'success')
    } catch (err) {
      console.error('Failed to update WhatsApp:', err)
      showToast('Failed to update WhatsApp', 'error')
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
      showToast(`Notification ${!currentStatus ? 'enabled' : 'disabled'}`, 'success')
    } catch (err) {
      console.error('Failed to toggle wa_noti:', err)
      showToast('Failed to toggle notification', 'error')
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
      showToast(`Plan extended by ${daysNumber} days`, 'success')
    } catch (err) {
      console.error('Failed to extend plan:', err)
      showToast('Failed to extend plan: ' + err.message, 'error')
    }
  }

  const loadUserSerials = async (userId, userName) => {
    try {
      const r = await fetch(`/api/admin/users/${userId}/serials`, { credentials: 'include' })
      if (r.status === 401) {
        window.location.href = '/login?message=session-expired'
        return
      }
      if (!r.ok) {
        throw new Error('Failed to load user serials')
      }
      const data = await r.json()
      setSelectedUserForSerials({ id: userId, name: userName })
      setUserSerials(data.serials || [])
      setShowUserSerialsModal(true)
    } catch (err) {
      console.error('Failed to load user serials:', err)
      showToast('Failed to load user serials', 'error')
    }
  }

  const loadUserDownloads = async (userId, userName, period = 'today') => {
    try {
      const r = await fetch(`/api/admin/users/${userId}/downloads?period=${period}`, { credentials: 'include' })
      if (r.status === 401) {
        window.location.href = '/login?message=session-expired'
        return
      }
      if (!r.ok) {
        throw new Error('Failed to load user downloads')
      }
      const data = await r.json()
      setSelectedUserForDownloads({ id: userId, name: userName })
      setUserDownloads(data.downloads || [])
      setDownloadStats({ count: data.count || 0, period: data.period || 'Today' })
      setDownloadPeriod(period)
      setShowUserDownloadsModal(true)
    } catch (err) {
      console.error('Failed to load user downloads:', err)
      showToast('Failed to load user downloads', 'error')
    }
  }

  const changeDownloadPeriod = async (period) => {
    if (!selectedUserForDownloads.id) return
    await loadUserDownloads(selectedUserForDownloads.id, selectedUserForDownloads.name, period)
  }

  if (authStatus === 'loading') {
    return (
      <div className="saas-loading">
        <div className="spinner"></div>
      </div>
    )
  }

  if (authStatus === 'unauthorized') {
    return (
      <div className="saas-unauthorized">
        <div className="auth-card">
          <h1 className="auth-title">Unauthorized</h1>
          <p className="auth-subtitle">You don't have permission to access this area.</p>
        </div>
      </div>
    )
  }

  // Filter logic
  const pendingUsers = users.filter(u => u.status === 'pending')
  const approvedUsers = users.filter(u => u.status === 'approved')
  const adminUsers = users.filter(u => u.status === 'admin')

  let displayedUsers = users
  if (userFilter === 'pending') displayedUsers = pendingUsers
  if (userFilter === 'approved') displayedUsers = approvedUsers
  if (userFilter === 'admin') displayedUsers = adminUsers

  return (
    <div className="saas-layout">
      {/* Sidebar / Navigation */}
      <aside className="saas-sidebar">
        <div className="saas-brand">
          <div className="saas-logo">TK</div>
          <span className="saas-brand-name">TubeKit</span>
        </div>
        
        <nav className="saas-nav">
          <button 
            className={`saas-nav-item ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            Users
          </button>
          <button 
            className={`saas-nav-item ${activeTab === 'serials' ? 'active' : ''}`}
            onClick={() => setActiveTab('serials')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
            Serials
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="saas-main">
        <header className="saas-header">
          <h1 className="saas-page-title">
            {activeTab === 'users' ? 'User Management' : 'Serial Analytics'}
          </h1>
          <div className="saas-user-menu">
            <span className="saas-badge">Admin</span>
          </div>
        </header>

        {/* Stats Overview */}
        <div className="saas-stats-grid">
          <div className="saas-stat-card">
            <div className="saas-stat-icon blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </div>
            <div className="saas-stat-info">
              <span className="saas-stat-label">Total Downloads</span>
              <span className="saas-stat-value">{stats.totalDownloads || 0}</span>
            </div>
          </div>
          <div className="saas-stat-card">
            <div className="saas-stat-icon green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                <polyline points="17 6 23 6 23 12"></polyline>
              </svg>
            </div>
            <div className="saas-stat-info">
              <span className="saas-stat-label">Downloads Today</span>
              <span className="saas-stat-value">{stats.downloadsToday || 0}</span>
            </div>
          </div>
          <div className="saas-stat-card">
            <div className="saas-stat-icon purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </div>
            <div className="saas-stat-info">
              <span className="saas-stat-label">Last 7 Days</span>
              <span className="saas-stat-value">{stats.downloadsLastWeek || 0}</span>
            </div>
          </div>
          <div className="saas-stat-card">
            <div className="saas-stat-icon orange">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
              </svg>
            </div>
            <div className="saas-stat-info">
              <span className="saas-stat-label">Total Users</span>
              <span className="saas-stat-value">{users.length}</span>
            </div>
          </div>
        </div>

        <div className="saas-content-area">
          {activeTab === 'users' && (
            <>
              <div className="saas-filters">
                <button 
                  className={`saas-filter-btn ${userFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setUserFilter('all')}
                >
                  All Users
                </button>
                <button 
                  className={`saas-filter-btn ${userFilter === 'pending' ? 'active' : ''}`}
                  onClick={() => setUserFilter('pending')}
                >
                  Pending {pendingUsers.length > 0 && <span className="saas-count-badge warning">{pendingUsers.length}</span>}
                </button>
                <button 
                  className={`saas-filter-btn ${userFilter === 'approved' ? 'active' : ''}`}
                  onClick={() => setUserFilter('approved')}
                >
                  Active
                </button>
                <button 
                  className={`saas-filter-btn ${userFilter === 'admin' ? 'active' : ''}`}
                  onClick={() => setUserFilter('admin')}
                >
                  Admins
                </button>
              </div>

              {/* Desktop Table View */}
              <div className="saas-table-wrapper">
                <table className="saas-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Status</th>
                      <th>WhatsApp</th>
                      <th>Notifications</th>
                      <th>Activity</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedUsers.map(user => {
                      const isPending = user.status === 'pending'
                      const planExpired = user.plan_expiry_date ? new Date(user.plan_expiry_date) < new Date() : true
                      const expiryDateStr = user.plan_expiry_date ? new Date(user.plan_expiry_date).toLocaleDateString() : '-'
                      
                      return (
                        <tr key={user.id}>
                          <td>
                            <div className="saas-user-cell">
                              <div className="saas-user-avatar">{user.name.charAt(0).toUpperCase()}</div>
                              <div className="saas-user-details">
                                <span className="saas-user-name">{user.name}</span>
                                <span className="saas-user-email">{user.email}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            {isPending ? (
                              <span className="saas-status-badge warning">Pending</span>
                            ) : user.status === 'admin' ? (
                              <span className="saas-status-badge info">Admin</span>
                            ) : (
                              <div className="saas-plan-info">
                                <span className={`saas-status-badge ${planExpired ? 'danger' : 'success'}`}>
                                  {planExpired ? 'Expired' : 'Active'}
                                </span>
                                <span className="saas-plan-date">{expiryDateStr}</span>
                              </div>
                            )}
                          </td>
                          <td>
                            <div className="saas-wa-cell">
                              <span className="saas-wa-number">{user.whatsapp || '-'}</span>
                              <button 
                                className="saas-btn-icon small" 
                                onClick={() => showWhatsAppEdit(user.id, user.whatsapp)} 
                                title="Edit WhatsApp"
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                              </button>
                            </div>
                          </td>
                          <td>
                            <div className="saas-noti-cell">
                              <span className={`saas-status-badge ${user.wa_noti ? 'success' : 'danger'}`}>
                                {user.wa_noti ? 'Enabled' : 'Disabled'}
                              </span>
                              <button 
                                className="saas-btn-icon small" 
                                onClick={() => toggleWaNoti(user.id, user.wa_noti)}
                                title={user.wa_noti ? 'Disable Notifications' : 'Enable Notifications'}
                              >
                                {user.wa_noti ? (
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                                  </svg>
                                ) : (
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                                    <line x1="13.73" y1="21" x2="10.27" y2="21"></line>
                                    <line x1="1" y1="1" x2="23" y2="23"></line>
                                  </svg>
                                )}
                              </button>
                            </div>
                          </td>
                          <td>
                            <div className="saas-activity-cell">
                              <div className="saas-activity-stats">
                                <span>{user.totalDownloads || 0} DLs</span>
                                <span className="sub">{user.total_logins || 0} logins</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="saas-actions-cell">
                              {isPending ? (
                                <>
                                  <div className="saas-trial-input">
                                    <input
                                      type="number"
                                      min="1"
                                      placeholder="3"
                                      value={planDays[user.id] || ''}
                                      onChange={(e) => setPlanDays(prev => ({ ...prev, [user.id]: Number(e.target.value) }))}
                                    />
                                    <span>days</span>
                                  </div>
                                  <button className="saas-btn-icon success" onClick={() => approveUser(user.id)} title="Approve">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                  </button>
                                  <button className="saas-btn-icon danger" onClick={() => rejectUser(user.id)} title="Reject">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <line x1="18" y1="6" x2="6" y2="18"></line>
                                      <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button className="saas-btn-icon primary" onClick={() => showExtendPlan(user.id, user.name)} title="Extend Plan">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                                    </svg>
                                  </button>
                                  <button className="saas-btn-icon" onClick={() => loadUserSerials(user.id, user.name)} title="View Serials">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect>
                                      <polyline points="17 2 12 7 7 2"></polyline>
                                    </svg>
                                  </button>
                                  <button className="saas-btn-icon" onClick={() => loadLoginHistory(user.id, user.name)} title="History">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <circle cx="12" cy="12" r="10"></circle>
                                      <polyline points="12 6 12 12 16 14"></polyline>
                                    </svg>
                                  </button>
                                  <button className="saas-btn-icon" onClick={() => loadUserDownloads(user.id, user.name, 'today')} title="View Downloads">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                      <polyline points="7 10 12 15 17 10"></polyline>
                                      <line x1="12" y1="15" x2="12" y2="3"></line>
                                    </svg>
                                  </button>
                                </>
                              )}
                              <button className="saas-btn-icon danger" onClick={() => showDeleteConfirmation(user.id, user.name)} title="Delete">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="3 6 5 6 21 6"></polyline>
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                    {displayedUsers.length === 0 && (
                      <tr>
                        <td colSpan="6" className="saas-empty-state">
                          No users found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="saas-mobile-cards">
                {displayedUsers.map(user => {
                  const isPending = user.status === 'pending'
                  const planExpired = user.plan_expiry_date ? new Date(user.plan_expiry_date) < new Date() : true
                  const expiryDateStr = user.plan_expiry_date ? new Date(user.plan_expiry_date).toLocaleDateString() : '-'
                  
                  return (
                    <div key={user.id} className="saas-mobile-card">
                      <div className="saas-mobile-card-header">
                        <div className="saas-user-cell">
                          <div className="saas-user-avatar">{user.name.charAt(0).toUpperCase()}</div>
                          <div className="saas-user-details">
                            <span className="saas-user-name">{user.name}</span>
                            <span className="saas-user-email">{user.email}</span>
                          </div>
                        </div>
                        <div>
                          {isPending ? (
                            <span className="saas-status-badge warning">Pending</span>
                          ) : user.status === 'admin' ? (
                            <span className="saas-status-badge info">Admin</span>
                          ) : (
                            <div className="saas-plan-info">
                              <span className={`saas-status-badge ${planExpired ? 'danger' : 'success'}`}>
                                {planExpired ? 'Expired' : 'Active'}
                              </span>
                              <span className="saas-plan-date">{expiryDateStr}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="saas-mobile-card-body">
                        <div className="saas-mobile-two-col">
                          <div className="saas-mobile-col">
                            <span className="saas-mobile-label">WhatsApp</span>
                            <div className="saas-wa-cell">
                              <span className="saas-wa-number">{user.whatsapp || '-'}</span>
                              <button 
                                className="saas-btn-icon small" 
                                onClick={() => showWhatsAppEdit(user.id, user.whatsapp)} 
                                title="Edit WhatsApp"
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                              </button>
                            </div>
                          </div>
                          <div className="saas-mobile-col">
                            <span className="saas-mobile-label">Notifications</span>
                            <div className="saas-noti-cell">
                              <span className={`saas-status-badge ${user.wa_noti ? 'success' : 'danger'}`}>
                                {user.wa_noti ? 'Enabled' : 'Disabled'}
                              </span>
                              <button 
                                className="saas-btn-icon small" 
                                onClick={() => toggleWaNoti(user.id, user.wa_noti)}
                                title={user.wa_noti ? 'Disable Notifications' : 'Enable Notifications'}
                              >
                                {user.wa_noti ? (
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                                  </svg>
                                ) : (
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                                    <line x1="13.73" y1="21" x2="10.27" y2="21"></line>
                                    <line x1="1" y1="1" x2="23" y2="23"></line>
                                  </svg>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                        
                        <div className="saas-mobile-row">
                          <span className="saas-mobile-label">Activity</span>
                          <div className="saas-activity-cell">
                            <div className="saas-activity-stats">
                              <span>{user.totalDownloads || 0} DLs</span>
                              <span className="sub">{user.total_logins || 0} logins</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="saas-mobile-card-footer">
                        {isPending ? (
                          <>
                            <div className="saas-trial-input">
                              <input
                                type="number"
                                min="1"
                                placeholder="3"
                                value={planDays[user.id] || ''}
                                onChange={(e) => setPlanDays(prev => ({ ...prev, [user.id]: Number(e.target.value) }))}
                              />
                              <span>days</span>
                            </div>
                            <button className="saas-btn-icon success" onClick={() => approveUser(user.id)} title="Approve">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="20 6 9 17 4 12"></polyline>
                              </svg>
                            </button>
                            <button className="saas-btn-icon danger" onClick={() => rejectUser(user.id)} title="Reject">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                              </svg>
                            </button>
                          </>
                        ) : (
                          <>
                            <button className="saas-btn-icon primary" onClick={() => showExtendPlan(user.id, user.name)} title="Extend Plan">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                              </svg>
                            </button>
                            <button className="saas-btn-icon" onClick={() => loadUserSerials(user.id, user.name)} title="View Serials">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect>
                                <polyline points="17 2 12 7 7 2"></polyline>
                              </svg>
                            </button>
                            <button className="saas-btn-icon" onClick={() => loadLoginHistory(user.id, user.name)} title="History">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                              </svg>
                            </button>
                            <button className="saas-btn-icon" onClick={() => loadUserDownloads(user.id, user.name, 'today')} title="View Downloads">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                              </svg>
                            </button>
                            <button className="saas-btn-icon danger" onClick={() => showDeleteConfirmation(user.id, user.name)} title="Delete">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
                {displayedUsers.length === 0 && (
                  <div className="saas-empty-state">
                    No users found
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'serials' && (
            <>
              {/* Desktop Table View */}
              <div className="saas-table-wrapper">
                <table className="saas-table">
                  <thead>
                    <tr>
                      <th>Serial Name</th>
                      <th>Platform</th>
                      <th>Today</th>
                      <th>Yesterday</th>
                      <th>7 Days</th>
                      <th>30 Days</th>
                      <th className="text-right font-bold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serials.slice(serialsPage * 30, (serialsPage + 1) * 30).map(serial => (
                      <tr key={serial.id}>
                        <td className="font-medium">{serial.name}</td>
                        <td>
                          <span className="saas-platform-badge">{serial.platform_name}</span>
                        </td>
                        <td>{serial.downloadsToday || 0}</td>
                        <td>{serial.downloadsYesterday || 0}</td>
                        <td>{serial.downloadsLast7Days || 0}</td>
                        <td>{serial.downloadsLast30Days || 0}</td>
                        <td className="text-right font-bold">{serial.totalDownloads || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {serials.length > 30 && (
                  <div className="saas-pagination">
                    <button
                      onClick={() => setSerialsPage(Math.max(0, serialsPage - 1))}
                      disabled={serialsPage === 0}
                    >
                      Previous
                    </button>
                    <span>Page {serialsPage + 1}</span>
                    <button
                      onClick={() => setSerialsPage(Math.min(Math.ceil(serials.length / 30) - 1, serialsPage + 1))}
                      disabled={serialsPage >= Math.ceil(serials.length / 30) - 1}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile Card View */}
              <div className="saas-mobile-cards">
                {serials.slice(serialsPage * 30, (serialsPage + 1) * 30).map(serial => (
                  <div key={serial.id} className="saas-mobile-card saas-serial-card">
                    <div className="saas-mobile-card-header">
                      <div>
                        <span className="saas-user-name">{serial.name}</span>
                        <span className="saas-platform-badge">{serial.platform_name}</span>
                      </div>
                    </div>
                    <div className="saas-serial-stats-grid">
                      <div className="saas-stat-item">
                        <span className="saas-stat-label">Today</span>
                        <span className="saas-stat-value">{serial.downloadsToday || 0}</span>
                      </div>
                      <div className="saas-stat-item">
                        <span className="saas-stat-label">Yesterday</span>
                        <span className="saas-stat-value">{serial.downloadsYesterday || 0}</span>
                      </div>
                      <div className="saas-stat-item">
                        <span className="saas-stat-label">7 Days</span>
                        <span className="saas-stat-value">{serial.downloadsLast7Days || 0}</span>
                      </div>
                      <div className="saas-stat-item">
                        <span className="saas-stat-label">30 Days</span>
                        <span className="saas-stat-value">{serial.downloadsLast30Days || 0}</span>
                      </div>
                      <div className="saas-stat-item saas-stat-total">
                        <span className="saas-stat-label">Total</span>
                        <span className="saas-stat-value">{serial.totalDownloads || 0}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {serials.length > 30 && (
                  <div className="saas-pagination">
                    <button
                      onClick={() => setSerialsPage(Math.max(0, serialsPage - 1))}
                      disabled={serialsPage === 0}
                    >
                      Previous
                    </button>
                    <span>Page {serialsPage + 1}</span>
                    <button
                      onClick={() => setSerialsPage(Math.min(Math.ceil(serials.length / 30) - 1, serialsPage + 1))}
                      disabled={serialsPage >= Math.ceil(serials.length / 30) - 1}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Modals */}
      {showLoginHistory && (
        <div className="saas-modal-overlay">
          <div className="saas-modal large">
            <div className="saas-modal-header">
              <h3>Login History</h3>
              <button onClick={() => setShowLoginHistory(false)}>✕</button>
            </div>
            <div className="saas-modal-content scrollable">
              <div className="saas-timeline">
                {loginHistory.map((entry, idx) => (
                  <div key={idx} className="saas-timeline-item">
                    <div className="saas-timeline-date">
                      {new Date(entry.timestamp).toLocaleString()}
                    </div>
                    <div className="saas-timeline-details">
                      <div className="saas-timeline-row">
                        <span>IP: {entry.ip}</span>
                        <span>Device: {entry.device_fingerprint?.substring(0, 12)}...</span>
                      </div>
                      <div className="saas-timeline-meta">
                        {entry.user_agent}
                      </div>
                    </div>
                  </div>
                ))}
                {loginHistory.length === 0 && <p className="text-center text-muted">No history available</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="saas-modal-overlay">
          <div className="saas-modal small">
            <div className="saas-modal-header">
              <h3>Confirm Deletion</h3>
              <button onClick={() => { setShowDeleteModal(false); setUserToDelete(null) }}>✕</button>
            </div>
            <div className="saas-modal-content">
              <p>Are you sure you want to delete <strong>{userToDelete?.name}</strong>? This action cannot be undone.</p>
              <div className="saas-modal-actions">
                <button className="saas-btn secondary" onClick={() => { setShowDeleteModal(false); setUserToDelete(null) }}>Cancel</button>
                <button className="saas-btn danger" onClick={deleteUser}>Delete User</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showWhatsAppModal && (
        <div className="saas-modal-overlay">
          <div className="saas-modal small">
            <div className="saas-modal-header">
              <h3>Update WhatsApp</h3>
              <button onClick={() => { setShowWhatsAppModal(false); setWhatsAppData({ userId: null, current: '' }) }}>✕</button>
            </div>
            <div className="saas-modal-content">
              <div className="saas-form-group">
                <label>WhatsApp Number</label>
                <input
                  type="text"
                  value={whatsAppData.current}
                  onChange={(e) => setWhatsAppData(prev => ({ ...prev, current: e.target.value }))}
                  placeholder="+1234567890"
                  autoFocus
                />
              </div>
              <div className="saas-modal-actions">
                <button className="saas-btn secondary" onClick={() => { setShowWhatsAppModal(false); setWhatsAppData({ userId: null, current: '' }) }}>Cancel</button>
                <button className="saas-btn primary" onClick={updateWhatsApp}>Update</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showExtendPlanModal && (
        <div className="saas-modal-overlay">
          <div className="saas-modal small">
            <div className="saas-modal-header">
              <h3>Extend Plan</h3>
              <button onClick={() => { setShowExtendPlanModal(false); setExtendPlanData({ userId: null, userName: '', days: '30' }) }}>✕</button>
            </div>
            <div className="saas-modal-content">
              <div className="saas-form-group">
                <label>Add Days</label>
                <input
                  type="number"
                  value={extendPlanData.days}
                  onChange={(e) => setExtendPlanData(prev => ({ ...prev, days: e.target.value }))}
                  min="1"
                  autoFocus
                />
              </div>
              <div className="saas-modal-actions">
                <button className="saas-btn secondary" onClick={() => { setShowExtendPlanModal(false); setExtendPlanData({ userId: null, userName: '', days: '30' }) }}>Cancel</button>
                <button className="saas-btn primary" onClick={extendUserPlan}>Extend</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showUserSerialsModal && (
        <div className="saas-modal-overlay">
          <div className="saas-modal large">
            <div className="saas-modal-header">
              <h3>{selectedUserForSerials.name}'s Serials</h3>
              <button onClick={() => { setShowUserSerialsModal(false); setUserSerials([]); setSelectedUserForSerials({ id: null, name: '' }) }}>✕</button>
            </div>
            <div className="saas-modal-content scrollable">
              {userSerials.length === 0 ? (
                <p className="text-center text-muted">No serials added yet</p>
              ) : (
                <div className="saas-serials-list">
                  {userSerials.map(serial => (
                    <div key={serial.id} className="saas-serial-item">
                      <div className="saas-serial-item-info">
                        <div className="saas-serial-item-name">{serial.name}</div>
                        <div className="saas-serial-item-meta">
                          <span className="saas-platform-badge">{serial.platform_name}</span>
                          <span className="saas-serial-date">Added: {new Date(serial.added_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showUserDownloadsModal && (
        <div className="saas-modal-overlay">
          <div className="saas-modal large">
            <div className="saas-modal-header">
              <h3>{selectedUserForDownloads.name}'s Downloads</h3>
              <button onClick={() => { 
                setShowUserDownloadsModal(false); 
                setUserDownloads([]); 
                setSelectedUserForDownloads({ id: null, name: '' });
                setDownloadPeriod('today');
              }}>✕</button>
            </div>
            <div className="saas-modal-content">
              <div className="saas-download-filters">
                <button 
                  className={`saas-filter-btn ${downloadPeriod === 'today' ? 'active' : ''}`}
                  onClick={() => changeDownloadPeriod('today')}
                >
                  Today
                </button>
                <button 
                  className={`saas-filter-btn ${downloadPeriod === 'yesterday' ? 'active' : ''}`}
                  onClick={() => changeDownloadPeriod('yesterday')}
                >
                  Yesterday
                </button>
                <button 
                  className={`saas-filter-btn ${downloadPeriod === 'week' ? 'active' : ''}`}
                  onClick={() => changeDownloadPeriod('week')}
                >
                  Week
                </button>
                <button 
                  className={`saas-filter-btn ${downloadPeriod === '30days' ? 'active' : ''}`}
                  onClick={() => changeDownloadPeriod('30days')}
                >
                  30 Days
                </button>
              </div>
              <div className="saas-download-summary">
                <span className="saas-download-count">{downloadStats.count} downloads</span>
                <span className="saas-download-period">{downloadStats.period}</span>
              </div>
              <div className="saas-modal-content scrollable" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                {userDownloads.length === 0 ? (
                  <p className="text-center text-muted">No downloads found for this period</p>
                ) : (
                  <div className="saas-downloads-list">
                    {userDownloads.map(download => (
                      <div key={download.id} className="saas-download-item">
                        <div className="saas-download-item-info">
                          <div className="saas-download-item-name">
                            {download.name}
                            {download.download_count > 1 && (
                              <span className="saas-download-count-badge">+{download.download_count}</span>
                            )}
                          </div>
                          <div className="saas-download-item-meta">
                            <span className="saas-platform-badge">{download.platform_name}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {toast.show && (
        <div className={`saas-toast ${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}

createRoot(document.getElementById('root')).render(<AdminPanel />)
