require('dotenv').config()
require('dotenv').config({ path: '.env.local', override: true })
const express = require('express')
const cookieParser = require('cookie-parser')
const crypto = require('crypto')
const path = require('path')
const {
  db,
  getSerials,
  getSerialById,
  updateSerial,
  addToQueue,
  getActiveJobForSerial,
  logDownload,
  getDownloadOverview,
  getSerialDownloadStats,
  getUserDownloadStats,
  updateUserStatus,
  updateUserWhatsApp,
  updateUserWaNoti,
  getUserSerials,
  getAllAvailableSerials,
  addSerialToUser,
  removeSerialFromUser,
  isSerialAddedByUser,
  createOrUpdateSerial,
  createSession,
  getSessionByToken,
  deleteSession,
  deleteUserSessions,
  updateSessionActivity,
  logLogin,
  getUserLoginHistory,
  getUserLoginStats,
  updateUserPlanDays,
  extendUserPlanDays,
  isUserPlanExpired,
  approveUserWithPlan
} = require('./db')

const app = express()
app.set('trust proxy', true)
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())

function hashPassword(password) {
  // Hash password with pbkdf2
  const salt = 'tubekit_salt_2024' // Fixed salt for consistency
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
}

function createHash(name, email, password) {
  // Create unique cookie hash from user data
  return crypto.createHash('sha256').update(name + email + password).digest('hex')
}

function verifyAuth(req) {
  const token = req.cookies && req.cookies['tubekit_session']
  if (!token) return null
  const session = getSessionByToken(token)
  if (!session) return null
  if (session.status !== 'approved' && session.status !== 'admin') return null
  
  // Check plan expiry for approved users (admins bypass this check)
  if (session.status === 'approved') {
    const user = db.prepare('SELECT plan_expiry_date FROM users WHERE id = ?').get(session.user_id)
    if (user && isUserPlanExpired(user.plan_expiry_date)) {
      return { expired: true, id: session.user_id }
    }
  }
  
  updateSessionActivity(token)
  return {
    id: session.user_id,
    name: session.name,
    email: session.email,
    whatsapp: session.whatsapp,
    status: session.status
  }
}

function verifyAdmin(req) {
  const token = req.cookies && req.cookies['tubekit_session']
  if (!token) return null
  const session = getSessionByToken(token)
  if (!session) return null
  if (session.status !== 'admin') return null
  updateSessionActivity(token)
  return {
    id: session.user_id,
    name: session.name,
    email: session.email,
    whatsapp: session.whatsapp,
    status: session.status
  }
}

function getTrackedDownloadUrl(serialId, type) {
  return `/api/download/file?serialId=${encodeURIComponent(serialId)}&type=${encodeURIComponent(type)}`
}

app.post('/api/auth/register', (req, res) => {
  try {
    const { name, email, whatsapp, password, deviceFingerprint, screenResolution, timezone } = req.body || {}
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password required' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email' })
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })
    const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
    if (existing) return res.status(400).json({ error: 'Already registered' })

    const hashedPassword = hashPassword(password)

    let userId
    try {
      const result = db.prepare('INSERT INTO users (name, email, whatsapp, password, hash, status) VALUES (?, ?, ?, ?, ?, ?)')
        .run(name, email, whatsapp || '', hashedPassword, null, 'pending')
      userId = result.lastInsertRowid
    } catch (dbError) {
      console.error('Failed to insert user:', dbError.message)
      if (dbError.message.includes('NOT NULL') || dbError.message.includes('hash')) {
        try {
          const result = db.prepare('INSERT INTO users (name, email, whatsapp, password, status) VALUES (?, ?, ?, ?, ?)')
            .run(name, email, whatsapp || '', hashedPassword, 'pending')
          userId = result.lastInsertRowid
        } catch (e2) {
          console.error('Failed to insert user (fallback):', e2.message)
          throw e2
        }
      } else {
        throw dbError
      }
    }

    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown'
    const userAgent = req.headers['user-agent'] || 'unknown'

    const deviceInfo = {
      deviceFingerprint,
      ip,
      userAgent,
      screenResolution,
      timezone
    }

    let token
    try {
      token = createSession(userId, deviceInfo)
    } catch (sessionError) {
      console.error('Failed to create session:', sessionError.message)
      db.prepare('DELETE FROM users WHERE id = ?').run(userId)
      throw new Error('Failed to create session: ' + sessionError.message)
    }

    try {
      logLogin(userId, deviceInfo)
    } catch (logError) {
      console.error('Failed to log login (non-critical):', logError.message)
    }

    res.cookie('tubekit_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365 * 1000,
      path: '/',
      sameSite: 'lax'
    })
    res.json({ success: true })
  } catch (e) {
    console.error('Registration error:', e)
    res.status(500).json({ error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? e.message : undefined })
  }
})

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password, deviceFingerprint, screenResolution, timezone } = req.body || {}
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' })

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
    if (!user) return res.status(401).json({ error: 'Invalid email or password' })
    if (!user.password) return res.status(401).json({ error: 'Account created with old system. Please contact admin.' })

    const hashedPassword = hashPassword(password)
    if (hashedPassword !== user.password) return res.status(401).json({ error: 'Invalid email or password' })

    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown'
    const userAgent = req.headers['user-agent'] || 'unknown'

    deleteUserSessions(user.id)

    const deviceInfo = {
      deviceFingerprint,
      ip,
      userAgent,
      screenResolution,
      timezone
    }

    const token = createSession(user.id, deviceInfo)
    logLogin(user.id, deviceInfo)

    res.cookie('tubekit_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365 * 1000,
      path: '/',
      sameSite: 'lax'
    })
    res.json({ success: true, status: user.status })
  } catch (e) {
    console.error('Login error:', e)
    res.status(500).json({ error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? e.message : undefined })
  }
})

app.get('/api/auth/status', (req, res) => {
  try {
    const token = req.cookies && req.cookies['tubekit_session']
    if (!token) return res.json({ status: 'guest' })
    const session = getSessionByToken(token)
    if (!session) return res.json({ status: 'guest' })
    updateSessionActivity(token)
    if (session.status === 'admin') {
      return res.json({ status: 'admin', user: { id: session.user_id, name: session.name, email: session.email, whatsapp: session.whatsapp, status: 'admin' } })
    }
    if (session.status === 'approved') {
      // Check if plan is expired for approved users
      const user = db.prepare('SELECT plan_expiry_date FROM users WHERE id = ?').get(session.user_id)
      if (user && isUserPlanExpired(user.plan_expiry_date)) {
        return res.json({ status: 'expired', user: { id: session.user_id, name: session.name, email: session.email, whatsapp: session.whatsapp } })
      }
      return res.json({ status: 'approved', user: { id: session.user_id, name: session.name, email: session.email, whatsapp: session.whatsapp, status: 'approved' } })
    }
    if (session.status === 'pending') {
      return res.json({ status: 'pending' })
    }
    res.json({ status: 'guest' })
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.get('/api/serials', (req, res) => {
  try {
    const user = verifyAuth(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })
    if (user.expired) return res.status(403).json({ error: 'Plan expired' })
    // Return only serials that the user has added
    const serials = getUserSerials(user.email)
    res.json({ serials })
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.get('/api/serials/available', (req, res) => {
  try {
    const user = verifyAuth(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })
    if (user.expired) return res.status(403).json({ error: 'Plan expired' })
    // Return all serials in database for the "Add Serial" modal
    const allSerials = getAllAvailableSerials()
    // Mark which serials the user has already added
    const serialsWithStatus = allSerials.map(serial => ({
      ...serial,
      isAdded: isSerialAddedByUser(user.email, serial.id)
    }))
    res.json({ serials: serialsWithStatus })
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.post('/api/serials/add', (req, res) => {
  try {
    const user = verifyAuth(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })
    if (user.expired) return res.status(403).json({ error: 'Plan expired' })
    const { serialId } = req.body || {}
    if (!serialId) return res.status(400).json({ error: 'Missing serial ID' })

    // Check if serial exists
    const serial = getSerialById(serialId)
    if (!serial) return res.status(404).json({ error: 'Serial not found' })

    // Add serial to user's list
    const result = addSerialToUser(user.email, serialId)

    if (result.error) {
      return res.status(400).json({ error: result.error })
    }

    res.json({ success: true, message: 'Serial added to your dashboard' })
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.delete('/api/serials/remove/:serialId', (req, res) => {
  try {
    const user = verifyAuth(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })
    if (user.expired) return res.status(403).json({ error: 'Plan expired' })
    const { serialId } = req.params

    if (!serialId) return res.status(400).json({ error: 'Missing serial ID' })

    // Remove serial from user's list
    const result = removeSerialFromUser(user.email, serialId)

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Serial not found in your list' })
    }

    res.json({ success: true, message: 'Serial removed from your dashboard' })
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.post('/api/download', (req, res) => {
  try {
    const user = verifyAuth(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })
    if (user.expired) return res.status(403).json({ error: 'Plan expired' })
    const { serialId, type } = req.body || {}
    if (!serialId || !type) return res.status(400).json({ error: 'Missing parameters' })
    const serial = getSerialById(serialId)
    if (!serial) return res.status(404).json({ error: 'Serial not found' })
    if (type === 'original') {
      if (serial.dlurl && serial.dlurl !== 'Error') {
        return res.json({ status: 'ready', downloadUrl: getTrackedDownloadUrl(serialId, type) })
      }
    }
    if (type === 'bypass') {
      if (serial.ytdl && serial.ytdl !== 'Error') {
        return res.json({ status: 'ready', downloadUrl: getTrackedDownloadUrl(serialId, type) })
      }
      if (serial.dlurl && serial.dlurl !== 'Error') {
        return res.json({ status: 'processing', progress: serial.bypass_progress || 0, requestedType: type, message: 'Bypass version is being processed' })
      }
    }
    const existingJob = getActiveJobForSerial(serialId)
    if (existingJob) {
      return res.json({ status: 'queued', requestedType: type, message: 'Download already in queue' })
    }
    const job = addToQueue(serialId, user.id, type)
    res.json({ status: 'queued', jobId: job.lastInsertRowid, requestedType: type, message: 'Added to download queue' })
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.get('/api/status/check', (req, res) => {
  try {
    const serialId = req.query.serialId
    const type = req.query.type || 'original'
    if (!serialId) return res.status(400).json({ error: 'Missing serialId' })
    const serial = getSerialById(serialId)
    if (!serial) return res.status(404).json({ error: 'Serial not found' })
    const urlField = type === 'original' ? 'dlurl' : 'ytdl'
    const urlVal = serial[urlField]
    if (urlVal && urlVal !== 'Error') return res.json({ status: 'ready', downloadUrl: getTrackedDownloadUrl(serialId, type) })
    if (urlVal === 'Error') return res.json({ status: 'error', message: 'Download failed' })
    if (type === 'bypass') {
      if (serial.dlurl && serial.dlurl !== 'Error') {
        return res.json({ status: 'processing', progress: serial.bypass_progress || 0 })
      }
    }
    res.json({ status: 'queued', progress: 0 })
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.get('/api/download/file', (req, res) => {
  try {
    const user = verifyAuth(req)
    if (!user) return res.status(401).json({ error: 'Unauthorized' })
    if (user.expired) return res.status(403).json({ error: 'Plan expired' })
    const serialId = req.query.serialId
    const typeParam = req.query.type
    if (!serialId) return res.status(400).json({ error: 'Missing serialId' })
    const serial = getSerialById(serialId)
    if (!serial) return res.status(404).json({ error: 'Serial not found' })
    const downloadType = typeParam === 'bypass' ? 'bypass' : 'original'
    const urlField = downloadType === 'bypass' ? 'ytdl' : 'dlurl'
    const targetUrl = serial[urlField]
    if (!targetUrl || targetUrl === 'Error') return res.status(404).json({ error: 'Download not available' })
    logDownload(serialId, user.id, downloadType)
    res.redirect(302, targetUrl)
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.get('/api/admin/users', (req, res) => {
  try {
    const admin = verifyAdmin(req)
    if (!admin) return res.status(401).json({ error: 'Unauthorized' })
    const users = getUserDownloadStats()
    res.json({ users })
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.get('/api/admin/users/:id/login-history', (req, res) => {
  try {
    const admin = verifyAdmin(req)
    if (!admin) return res.status(401).json({ error: 'Unauthorized' })
    const userId = Number(req.params.id)
    if (!userId) return res.status(400).json({ error: 'Invalid user id' })
    const history = getUserLoginHistory(userId)
    res.json({ history })
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.get('/api/admin/stats', (req, res) => {
  try {
    const admin = verifyAdmin(req)
    if (!admin) return res.status(401).json({ error: 'Unauthorized' })
    const overview = getDownloadOverview()
    const serials = getSerialDownloadStats()
    const users = getUserDownloadStats()
    res.json({ overview, serials, users })
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.post('/api/admin/users/:id/approve', (req, res) => {
  try {
    const admin = verifyAdmin(req)
    if (!admin) return res.status(401).json({ error: 'Unauthorized' })
    const userId = Number(req.params.id)
    if (!userId) return res.status(400).json({ error: 'Invalid user id' })
    const { days } = req.body || {}
    const planDays = days && !isNaN(days) ? Number(days) : 3 // Default to 3 days
    const result = approveUserWithPlan(userId, planDays)
    if (!result.changes) return res.status(404).json({ error: 'User not found' })
    res.json({ success: true, userId, days: planDays })
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.post('/api/admin/users/:id/reject', (req, res) => {
  try {
    const admin = verifyAdmin(req)
    if (!admin) return res.status(401).json({ error: 'Unauthorized' })
    const userId = Number(req.params.id)
    if (!userId) return res.status(400).json({ error: 'Invalid user id' })
    const result = updateUserStatus(userId, 'rejected')
    if (!result.changes) return res.status(404).json({ error: 'User not found' })
    res.json({ success: true, userId })
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.delete('/api/admin/users/:id', (req, res) => {
  try {
    const admin = verifyAdmin(req)
    if (!admin) return res.status(401).json({ error: 'Unauthorized' })
    const userId = Number(req.params.id)
    if (!userId) return res.status(400).json({ error: 'Invalid user id' })

    db.prepare('DELETE FROM user_serials WHERE user_email = (SELECT email FROM users WHERE id = ?)').run(userId)
    db.prepare('DELETE FROM download_logs WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM login_history WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM download_queue WHERE user_id = ?').run(userId)
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(userId)

    if (!result.changes) return res.status(404).json({ error: 'User not found' })
    res.json({ success: true, userId })
  } catch (e) {
    console.error('Delete user error:', e)
    res.status(500).json({ error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? e.message : undefined })
  }
})

app.patch('/api/admin/users/:id/whatsapp', (req, res) => {
  try {
    const admin = verifyAdmin(req)
    if (!admin) return res.status(401).json({ error: 'Unauthorized' })
    const userId = Number(req.params.id)
    if (!userId) return res.status(400).json({ error: 'Invalid user id' })
    const { whatsapp } = req.body || {}
    if (whatsapp === undefined) return res.status(400).json({ error: 'Missing whatsapp field' })

    const result = updateUserWhatsApp(userId, whatsapp)
    if (!result.changes) return res.status(404).json({ error: 'User not found' })
    res.json({ success: true, userId, whatsapp })
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.patch('/api/admin/users/:id/wa-noti', (req, res) => {
  try {
    const admin = verifyAdmin(req)
    if (!admin) return res.status(401).json({ error: 'Unauthorized' })
    const userId = Number(req.params.id)
    if (!userId) return res.status(400).json({ error: 'Invalid user id' })
    const { waNoti } = req.body || {}
    if (waNoti === undefined) return res.status(400).json({ error: 'Missing waNoti field' })

    const result = updateUserWaNoti(userId, waNoti ? 1 : 0)
    if (!result.changes) return res.status(404).json({ error: 'User not found' })
    res.json({ success: true, userId, waNoti: waNoti ? 1 : 0 })
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.post('/api/admin/users/:id/extend-plan', (req, res) => {
  try {
    const admin = verifyAdmin(req)
    if (!admin) return res.status(401).json({ error: 'Unauthorized' })
    const userId = Number(req.params.id)
    if (!userId) return res.status(400).json({ error: 'Invalid user id' })
    const { days } = req.body || {}
    if (!days || isNaN(days)) return res.status(400).json({ error: 'Missing or invalid days field' })

    const result = extendUserPlanDays(userId, Number(days))
    if (!result.changes) return res.status(404).json({ error: 'User not found' })
    res.json({ success: true, userId, days: Number(days) })
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.post('/api/admin/update', (req, res) => {
  try {
    const apiKey = req.get('X-API-Key')
    if (apiKey !== process.env.ADMIN_API_KEY) return res.status(401).json({ error: 'Unauthorized' })
    const { id, dlurl, ytdl, date, progress } = req.body || {}
    if (!id) return res.status(400).json({ error: 'Missing serial ID' })
    const updates = {}
    if (dlurl !== undefined) updates.dlurl = dlurl
    if (ytdl !== undefined) updates.ytdl = ytdl
    if (date !== undefined) updates.date = date
    if (progress !== undefined) updates.bypass_progress = progress
    if (ytdl && ytdl !== 'Error') updates.bypass_progress = 0
    if (Object.keys(updates).length) updateSerial(id, updates)
    res.json({ success: true, message: 'Serial updated successfully' })
  } catch (e) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.post('/api/webhook/serial', (req, res) => {
  try {
    const apiKey = req.get('X-API-Key')
    if (apiKey !== process.env.ADMIN_API_KEY) return res.status(401).json({ error: 'Unauthorized' })

    const { serial_name, platform, url, date } = req.body || {}

    // Validate required fields
    if (!serial_name || !platform || !url) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['serial_name', 'platform', 'url']
      })
    }

    // Create or update the serial (auto-creates platform if needed)
    const result = createOrUpdateSerial(serial_name, platform, url, date || 'Unknown')

    res.json({
      success: true,
      message: 'Serial processed successfully',
      serial: {
        id: result.serialId,
        name: result.serialName,
        platform: result.platform.name
      }
    })
  } catch (e) {
    console.error('Webhook error:', e)
    res.status(500).json({ error: 'Internal server error', details: e.message })
  }
})

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'login.html'))
})

app.get(['/admin', '/admin/*'], (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'admin.html'))
})

app.use(express.static(path.join(__dirname, 'dist')))

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

const port = Number(process.env.PORT) || 4000
app.listen(port, () => {})
