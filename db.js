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
    hash TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
    downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (serial_id) REFERENCES serials(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS user_serials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    serial_id TEXT NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (serial_id) REFERENCES serials(id),
    UNIQUE(user_id, serial_id)
  );

  CREATE INDEX IF NOT EXISTS idx_download_logs_serial ON download_logs(serial_id);
  CREATE INDEX IF NOT EXISTS idx_download_logs_user ON download_logs(user_id);
  CREATE INDEX IF NOT EXISTS idx_download_logs_downloaded_at ON download_logs(downloaded_at);
  CREATE INDEX IF NOT EXISTS idx_user_serials_user ON user_serials(user_id);
  CREATE INDEX IF NOT EXISTS idx_user_serials_serial ON user_serials(serial_id);
`)

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
  return db.prepare(
    'INSERT INTO download_logs (serial_id, user_id, download_type) VALUES (?, ?, ?)'
  ).run(serialId, userId, downloadType)
}

const PAKISTAN_TZ_PLUS = '+5 hour'
const PAKISTAN_TZ_MINUS = '-5 hour'

const todayStart = `datetime('now', '${PAKISTAN_TZ_PLUS}', 'start of day', '${PAKISTAN_TZ_MINUS}')`
const tomorrowStart = `datetime('now', '${PAKISTAN_TZ_PLUS}', 'start of day', '+1 day', '${PAKISTAN_TZ_MINUS}')`
const lastWeekStart = `datetime('now', '${PAKISTAN_TZ_PLUS}', 'start of day', '-7 day', '${PAKISTAN_TZ_MINUS}')`

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
            WHEN dl.downloaded_at >= ${lastWeekStart}
             AND dl.downloaded_at < ${tomorrowStart}
            THEN 1 ELSE 0
          END), 0) AS downloadsLastWeek
    FROM serials s
    JOIN platforms p ON s.platform_id = p.id
    LEFT JOIN download_logs dl ON dl.serial_id = s.id
    GROUP BY s.id
    ORDER BY totalDownloads DESC, s.name
  `).all()
}

function getUserDownloadStats() {
  return db.prepare(`
    SELECT
      u.id,
      u.name,
      u.email,
      u.whatsapp,
      u.status,
      u.created_at,
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
}

function updateUserStatus(userId, status) {
  return db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, userId)
}

function getUsers() {
  return db.prepare('SELECT * FROM users ORDER BY created_at DESC').all()
}

// User Serials Management
function getUserSerials(userId) {
  return db.prepare(`
    SELECT s.*, p.name as platform_name, p.slug as platform_slug, us.added_at
    FROM user_serials us
    JOIN serials s ON us.serial_id = s.id
    JOIN platforms p ON s.platform_id = p.id
    WHERE us.user_id = ?
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

function addSerialToUser(userId, serialId) {
  try {
    return db.prepare(
      'INSERT INTO user_serials (user_id, serial_id) VALUES (?, ?)'
    ).run(userId, serialId)
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      return { changes: 0, error: 'Serial already added' }
    }
    throw error
  }
}

function removeSerialFromUser(userId, serialId) {
  return db.prepare(
    'DELETE FROM user_serials WHERE user_id = ? AND serial_id = ?'
  ).run(userId, serialId)
}

function isSerialAddedByUser(userId, serialId) {
  const result = db.prepare(
    'SELECT 1 FROM user_serials WHERE user_id = ? AND serial_id = ?'
  ).get(userId, serialId)
  return !!result
}

// Platform Management
function getOrCreatePlatform(platformName) {
  // Normalize platform name
  const normalized = platformName.trim()
  const slug = normalized.toLowerCase().replace(/[^a-z0-9]+/g, '')

  // Try to find existing platform
  let platform = db.prepare('SELECT * FROM platforms WHERE name = ? OR slug = ?').get(normalized, slug)

  if (!platform) {
    // Create new platform
    const result = db.prepare('INSERT INTO platforms (name, slug) VALUES (?, ?)').run(normalized, slug)
    platform = { id: result.lastInsertRowid, name: normalized, slug }
  }

  return platform
}

// Serial Management
function createOrUpdateSerial(serialName, platformName, url, date) {
  // Generate serial_id slug from serial name
  const serialId = serialName.toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '_')      // Replace spaces with underscores
    .replace(/-+/g, '_')       // Replace hyphens with underscores
    .replace(/_+/g, '_')       // Replace multiple underscores with single
    .replace(/^_|_$/g, '')     // Remove leading/trailing underscores

  // Get or create platform
  const platform = getOrCreatePlatform(platformName)

  // Check if serial exists
  const existingSerial = getSerialById(serialId)

  if (existingSerial) {
    // Update existing serial (clear old download URLs for new episode)
    updateSerial(serialId, {
      url,
      date,
      dlurl: null,
      ytdl: null,
      bypass_progress: 0
    })
  } else {
    // Create new serial
    db.prepare(`
      INSERT INTO serials (id, platform_id, name, url, date)
      VALUES (?, ?, ?, ?, ?)
    `).run(serialId, platform.id, serialName, url, date)
  }

  return { serialId, serialName, platform }
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
  // User serials management
  getUserSerials,
  getAllAvailableSerials,
  addSerialToUser,
  removeSerialFromUser,
  isSerialAddedByUser,
  // Platform & serial creation
  getOrCreatePlatform,
  createOrUpdateSerial
}
