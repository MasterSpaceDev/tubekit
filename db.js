const Database = require('better-sqlite3')
const path = require('path')

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'tubekit.db')
const db = new Database(dbPath)

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    whatsapp TEXT,
    password TEXT,
    hash TEXT UNIQUE,
    status TEXT DEFAULT 'pending',
    wa_noti INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    plan_expiry_date TEXT
  );

  CREATE TABLE IF NOT EXISTS platforms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS serials (
    id TEXT PRIMARY KEY,
    platform_id INTEGER,
    name TEXT NOT NULL,
    url TEXT,
    dlurl TEXT,
    ytdl TEXT,
    bypass_progress INTEGER DEFAULT 0,
    date TEXT,
    FOREIGN KEY (platform_id) REFERENCES platforms(id)
  );

  CREATE TABLE IF NOT EXISTS download_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    serial_id TEXT NOT NULL,
    user_id INTEGER,
    type TEXT DEFAULT 'original',
    status TEXT DEFAULT 'queued',
    progress INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (serial_id) REFERENCES serials(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS download_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    serial_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    download_type TEXT DEFAULT 'original',
    episode_date TEXT,
    downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (serial_id) REFERENCES serials(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS user_serials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_email TEXT NOT NULL,
    serial_id TEXT NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_email) REFERENCES users(email),
    FOREIGN KEY (serial_id) REFERENCES serials(id),
    UNIQUE(user_email, serial_id)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    device_fingerprint TEXT,
    ip TEXT,
    user_agent TEXT,
    screen_resolution TEXT,
    timezone TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS login_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ip TEXT,
    user_agent TEXT,
    device_fingerprint TEXT,
    screen_resolution TEXT,
    timezone TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_download_logs_serial ON download_logs(serial_id);
  CREATE INDEX IF NOT EXISTS idx_download_logs_user ON download_logs(user_id);
  CREATE INDEX IF NOT EXISTS idx_download_logs_downloaded_at ON download_logs(downloaded_at);
  CREATE INDEX IF NOT EXISTS idx_user_serials_user ON user_serials(user_email);
  CREATE INDEX IF NOT EXISTS idx_user_serials_serial ON user_serials(serial_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id);
  CREATE INDEX IF NOT EXISTS idx_login_history_timestamp ON login_history(timestamp);
`)

try {
  const tableInfo = db.prepare("PRAGMA table_info(users)").all()
  const planExpiryColumn = tableInfo.find(col => col.name === 'plan_expiry_date')
  if (!planExpiryColumn) {
    db.exec('ALTER TABLE users ADD COLUMN plan_expiry_date TEXT')
    console.log('Added plan_expiry_date column to users table')
  }
} catch (migrationError) {
  console.error('Schema migration error (non-critical):', migrationError.message)
}

// Ensure episode_date index exists (column is already in CREATE TABLE for new databases)
try {
  const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='download_logs'").all()
  const episodeIndex = indexes.find(idx => idx.name === 'idx_download_logs_episode')
  if (!episodeIndex) {
    db.exec('CREATE INDEX IF NOT EXISTS idx_download_logs_episode ON download_logs(serial_id, user_id, episode_date)')
    console.log('Added episode index to download_logs table')
  }
} catch (indexError) {
  console.error('Failed to create episode index:', indexError.message)
}

function getSerials() {
  return db.prepare(`
    SELECT s.*, p.name as platform_name, p.slug as platform_slug
    FROM serials s
    JOIN platforms p ON s.platform_id = p.id
    ORDER BY p.id, s.name
  `).all()
}

function getSerialById(id) {
  return db.prepare('SELECT * FROM serials WHERE id = ?').get(id)
}

function updateSerial(id, data) {
  const keys = Object.keys(data)
  if (!keys.length) return { changes: 0 }
  const fields = keys.map(k => `${k} = ?`).join(', ')
  const values = [...Object.values(data), id]
  return db.prepare(`UPDATE serials SET ${fields} WHERE id = ?`).run(...values)
}

function addToQueue(serialId, userId, type = 'original') {
  return db.prepare(
    'INSERT INTO download_queue (serial_id, user_id, type, status) VALUES (?, ?, ?, ?)'
  ).run(serialId, userId, type, 'queued')
}

function getQueueJob(jobId) {
  return db.prepare('SELECT * FROM download_queue WHERE id = ?').get(jobId)
}

function updateQueueJob(jobId, data) {
  const keys = Object.keys(data)
  if (!keys.length) return { changes: 0 }
  const fields = keys.map(k => `${k} = ?`).join(', ')
  const values = [...Object.values(data), jobId]
  return db.prepare(`UPDATE download_queue SET ${fields} WHERE id = ?`).run(...values)
}

function getActiveJobForSerial(serialId) {
  return db.prepare(
    'SELECT * FROM download_queue WHERE serial_id = ? AND status IN (?, ?) ORDER BY created_at DESC LIMIT 1'
  ).get(serialId, 'queued', 'processing')
}

function getPendingQueueItems() {
  return db.prepare(
    'SELECT * FROM download_queue WHERE status = ? ORDER BY created_at ASC LIMIT 10'
  ).all('queued')
}

function logDownload(serialId, userId, downloadType = 'original') {
  // Get the serial to check its current episode date
  const serial = getSerialById(serialId)
  if (!serial) {
    throw new Error('Serial not found')
  }
  
  const episodeDate = serial.date || 'Unknown'
  
  // Check if user has already downloaded this episode
  const existingDownload = db.prepare(
    'SELECT id FROM download_logs WHERE serial_id = ? AND user_id = ? AND episode_date = ?'
  ).get(serialId, userId, episodeDate)
  
  // Only log if this is a new episode download for this user
  if (!existingDownload) {
    return db.prepare(
      'INSERT INTO download_logs (serial_id, user_id, download_type, episode_date) VALUES (?, ?, ?, ?)'
    ).run(serialId, userId, downloadType, episodeDate)
  }
  
  // Return a result indicating no new log was created (duplicate)
  return { changes: 0, lastInsertRowid: null }
}

const PAKISTAN_TZ_PLUS = '+5 hour'
const PAKISTAN_TZ_MINUS = '-5 hour'

const todayStart = `datetime('now', '${PAKISTAN_TZ_PLUS}', 'start of day', '${PAKISTAN_TZ_MINUS}')`
const tomorrowStart = `datetime('now', '${PAKISTAN_TZ_PLUS}', 'start of day', '+1 day', '${PAKISTAN_TZ_MINUS}')`
const yesterdayStart = `datetime('now', '${PAKISTAN_TZ_PLUS}', 'start of day', '-1 day', '${PAKISTAN_TZ_MINUS}')`
const lastWeekStart = `datetime('now', '${PAKISTAN_TZ_PLUS}', 'start of day', '-7 day', '${PAKISTAN_TZ_MINUS}')`
const last30DaysStart = `datetime('now', '${PAKISTAN_TZ_PLUS}', 'start of day', '-30 day', '${PAKISTAN_TZ_MINUS}')`

function getDownloadOverview() {
  return db.prepare(`
    SELECT
      COUNT(*) AS totalDownloads,
      COALESCE(SUM(CASE
            WHEN downloaded_at >= ${todayStart}
             AND downloaded_at < ${tomorrowStart}
            THEN 1 ELSE 0
          END), 0) AS downloadsToday,
      COALESCE(SUM(CASE
            WHEN downloaded_at >= ${lastWeekStart}
             AND downloaded_at < ${tomorrowStart}
            THEN 1 ELSE 0
          END), 0) AS downloadsLastWeek
    FROM download_logs
  `).get()
}

function getSerialDownloadStats() {
  return db.prepare(`
    SELECT
      s.id,
      s.name,
      p.name AS platform_name,
      COUNT(dl.id) AS totalDownloads,
      COALESCE(SUM(CASE
            WHEN dl.downloaded_at >= ${todayStart}
             AND dl.downloaded_at < ${tomorrowStart}
            THEN 1 ELSE 0
          END), 0) AS downloadsToday,
      COALESCE(SUM(CASE
            WHEN dl.downloaded_at >= ${yesterdayStart}
             AND dl.downloaded_at < ${todayStart}
            THEN 1 ELSE 0
          END), 0) AS downloadsYesterday,
      COALESCE(SUM(CASE
            WHEN dl.downloaded_at >= ${lastWeekStart}
             AND dl.downloaded_at < ${tomorrowStart}
            THEN 1 ELSE 0
          END), 0) AS downloadsLast7Days,
      COALESCE(SUM(CASE
            WHEN dl.downloaded_at >= ${last30DaysStart}
             AND dl.downloaded_at < ${tomorrowStart}
            THEN 1 ELSE 0
          END), 0) AS downloadsLast30Days
    FROM serials s
    JOIN platforms p ON s.platform_id = p.id
    LEFT JOIN download_logs dl ON dl.serial_id = s.id
    GROUP BY s.id
    ORDER BY totalDownloads DESC, s.name
  `).all()
}

function getUserDownloadStats() {
  const users = db.prepare(`
    SELECT
      u.id,
      u.name,
      u.email,
      u.whatsapp,
      u.status,
      u.wa_noti,
      u.created_at,
      u.plan_expiry_date,
      COUNT(dl.id) AS totalDownloads,
      COALESCE(SUM(CASE
            WHEN dl.downloaded_at >= ${todayStart}
             AND dl.downloaded_at < ${tomorrowStart}
            THEN 1 ELSE 0
          END), 0) AS downloadsToday,
      COALESCE(SUM(CASE
            WHEN dl.downloaded_at >= ${lastWeekStart}
             AND dl.downloaded_at < ${tomorrowStart}
            THEN 1 ELSE 0
          END), 0) AS downloadsLastWeek
    FROM users u
    LEFT JOIN download_logs dl ON dl.user_id = u.id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `).all()
  
  return users.map(user => {
    const loginStats = getUserLoginStats(user.id)
    const currentSession = db.prepare(`
      SELECT device_fingerprint FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1
    `).get(user.id)
    
    return {
      ...user,
      total_logins: loginStats.total_logins,
      unique_devices: loginStats.unique_devices,
      unique_ips: loginStats.unique_ips,
      device_fingerprint: currentSession?.device_fingerprint || null
    }
  })
}

function updateUserStatus(userId, status) {
  return db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, userId)
}

function getUsers() {
  return db.prepare('SELECT * FROM users ORDER BY created_at DESC').all()
}

function updateUserWhatsApp(userId, whatsapp) {
  return db.prepare('UPDATE users SET whatsapp = ? WHERE id = ?').run(whatsapp, userId)
}

function updateUserWaNoti(userId, waNoti) {
  return db.prepare('UPDATE users SET wa_noti = ? WHERE id = ?').run(waNoti, userId)
}

function updateUserPlanDays(userId, days) {
  const expiryDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
  return db.prepare('UPDATE users SET plan_expiry_date = ? WHERE id = ?').run(expiryDate, userId)
}

function extendUserPlanDays(userId, days) {
  const user = db.prepare('SELECT plan_expiry_date FROM users WHERE id = ?').get(userId)
  if (!user) return { changes: 0 }
  
  let newExpiryDate
  if (user.plan_expiry_date) {
    const currentExpiry = new Date(user.plan_expiry_date)
    const now = new Date()
    
    if (currentExpiry < now) {
      newExpiryDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
    } else {
      newExpiryDate = new Date(currentExpiry.getTime() + days * 24 * 60 * 60 * 1000).toISOString()
    }
  } else {
    newExpiryDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
  }
  
  return db.prepare('UPDATE users SET plan_expiry_date = ? WHERE id = ?').run(newExpiryDate, userId)
}

function isUserPlanExpired(expiryDate) {
  if (!expiryDate) return true
  return new Date() > new Date(expiryDate)
}

function approveUserWithPlan(userId, days) {
  const expiryDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
  return db.prepare('UPDATE users SET status = ?, plan_expiry_date = ? WHERE id = ?')
    .run('approved', expiryDate, userId)
}

function getUserSerials(userEmail) {
  return db.prepare(`
    SELECT s.*, p.name as platform_name, p.slug as platform_slug, us.added_at
    FROM user_serials us
    JOIN serials s ON us.serial_id = s.id
    JOIN platforms p ON s.platform_id = p.id
    WHERE us.user_email = ?
    ORDER BY us.added_at DESC
  `).all(userEmail)
}

function getUserSerialsByUserId(userId) {
  return db.prepare(`
    SELECT s.*, p.name as platform_name, p.slug as platform_slug, us.added_at
    FROM user_serials us
    JOIN serials s ON us.serial_id = s.id
    JOIN platforms p ON s.platform_id = p.id
    JOIN users u ON us.user_email = u.email
    WHERE u.id = ?
    ORDER BY us.added_at DESC
  `).all(userId)
}

function getAllAvailableSerials() {
  return db.prepare(`
    SELECT s.*, p.name as platform_name, p.slug as platform_slug
    FROM serials s
    JOIN platforms p ON s.platform_id = p.id
    ORDER BY p.id, s.name
  `).all()
}

function addSerialToUser(userEmail, serialId) {
  try {
    return db.prepare(
      'INSERT INTO user_serials (user_email, serial_id) VALUES (?, ?)'
    ).run(userEmail, serialId)
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      return { changes: 0, error: 'Serial already added' }
    }
    throw error
  }
}

function removeSerialFromUser(userEmail, serialId) {
  return db.prepare(
    'DELETE FROM user_serials WHERE user_email = ? AND serial_id = ?'
  ).run(userEmail, serialId)
}

function isSerialAddedByUser(userEmail, serialId) {
  const result = db.prepare(
    'SELECT 1 FROM user_serials WHERE user_email = ? AND serial_id = ?'
  ).get(userEmail, serialId)
  return !!result
}

function getOrCreatePlatform(platformName) {
  const normalized = platformName.trim()
  const slug = normalized.toLowerCase().replace(/[^a-z0-9]+/g, '')

  let platform = db.prepare('SELECT * FROM platforms WHERE name = ? OR slug = ?').get(normalized, slug)

  if (!platform) {
    const result = db.prepare('INSERT INTO platforms (name, slug) VALUES (?, ?)').run(normalized, slug)
    platform = { id: result.lastInsertRowid, name: normalized, slug }
  }

  return platform
}

function createOrUpdateSerial(serialName, platformName, url, date) {
  const serialId = serialName.toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '_')
    .replace(/-+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')

  const platform = getOrCreatePlatform(platformName)
  const existingSerial = getSerialById(serialId)

  if (existingSerial) {
    updateSerial(serialId, {
      url,
      date,
      dlurl: null,
      ytdl: null,
      bypass_progress: 0
    })
  } else {
    db.prepare(`
      INSERT INTO serials (id, platform_id, name, url, date)
      VALUES (?, ?, ?, ?, ?)
    `).run(serialId, platform.id, serialName, url, date)
  }

  return { serialId, serialName, platform }
}

function createSession(userId, deviceInfo) {
  try {
    const crypto = require('crypto')
    const token = crypto.randomBytes(32).toString('hex')
    db.prepare(`
      INSERT INTO sessions (user_id, token, device_fingerprint, ip, user_agent, screen_resolution, timezone)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      token,
      deviceInfo.deviceFingerprint || null,
      deviceInfo.ip || null,
      deviceInfo.userAgent || null,
      deviceInfo.screenResolution || null,
      deviceInfo.timezone || null
    )
    try {
      db.prepare('UPDATE users SET hash = ? WHERE id = ?').run(token, userId)
    } catch (e) {
      console.error('Failed to update user hash:', e.message)
    }
    return token
  } catch (e) {
    console.error('Failed to create session:', e.message)
    throw e
  }
}

function getSessionByToken(token) {
  return db.prepare(`
    SELECT s.*, u.status, u.email, u.name, u.whatsapp
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ?
  `).get(token)
}

function deleteSession(token) {
  const session = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token)
  if (session) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
  }
  return { changes: session ? 1 : 0 }
}

function deleteUserSessions(userId) {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)
  return { changes: 1 }
}

function updateSessionActivity(token) {
  return db.prepare('UPDATE sessions SET last_activity = CURRENT_TIMESTAMP WHERE token = ?').run(token)
}

function logLogin(userId, deviceInfo) {
  try {
    return db.prepare(`
      INSERT INTO login_history (user_id, ip, user_agent, device_fingerprint, screen_resolution, timezone)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      deviceInfo.ip || null,
      deviceInfo.userAgent || null,
      deviceInfo.deviceFingerprint || null,
      deviceInfo.screenResolution || null,
      deviceInfo.timezone || null
    )
  } catch (e) {
    console.error('Failed to log login:', e.message)
    throw e
  }
}

function getUserLoginHistory(userId) {
  return db.prepare(`
    SELECT * FROM login_history
    WHERE user_id = ?
    ORDER BY timestamp DESC
  `).all(userId)
}

function getUserLoginStats(userId) {
  const stats = db.prepare(`
    SELECT
      COUNT(*) AS total_logins,
      COUNT(DISTINCT device_fingerprint) AS unique_devices,
      COUNT(DISTINCT ip) AS unique_ips
    FROM login_history
    WHERE user_id = ?
  `).get(userId)
  return stats || { total_logins: 0, unique_devices: 0, unique_ips: 0 }
}

function getUserDownloadsByDateRange(userId, startDateExpr, endDateExpr) {
  // Note: startDateExpr and endDateExpr are SQL expressions (not parameters) for date calculations
  // We need to use string interpolation for the date expressions but parameterize the userId
  const query = `
    SELECT
      s.id,
      s.name,
      p.name AS platform_name,
      COUNT(dl.id) AS download_count,
      GROUP_CONCAT(DISTINCT dl.episode_date) AS episode_dates
    FROM download_logs dl
    JOIN serials s ON dl.serial_id = s.id
    JOIN platforms p ON s.platform_id = p.id
    WHERE dl.user_id = ?
      AND dl.downloaded_at >= ${startDateExpr}
      AND dl.downloaded_at < ${endDateExpr}
    GROUP BY s.id, s.name, p.name
    ORDER BY download_count DESC, s.name
  `
  return db.prepare(query).all(userId)
}

module.exports = {
  db,
  getSerials,
  getSerialById,
  updateSerial,
  addToQueue,
  getQueueJob,
  updateQueueJob,
  getActiveJobForSerial,
  getPendingQueueItems,
  logDownload,
  getDownloadOverview,
  getSerialDownloadStats,
  getUserDownloadStats,
  updateUserStatus,
  getUsers,
  updateUserWhatsApp,
  updateUserWaNoti,
  getUserSerials,
  getUserSerialsByUserId,
  getAllAvailableSerials,
  addSerialToUser,
  removeSerialFromUser,
  isSerialAddedByUser,
  getOrCreatePlatform,
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
  approveUserWithPlan,
  getUserDownloadsByDateRange
}
