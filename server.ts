import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";
import axios from "axios";
import { XMLParser } from "fast-xml-parser";
import * as otplib from 'otplib';
const authenticator = (otplib as any).default?.authenticator || (otplib as any).authenticator;
import QRCode from 'qrcode';
import { createHash, randomUUID } from 'crypto';
import { GoogleGenAI, Type } from "@google/genai";
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';

dotenv.config();

// Prevent unhandled rejections from crashing the server
process.on('unhandledRejection', (reason, promise) => {
  console.error('[UnhandledRejection] at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[UncaughtException]', err);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Gemini AI (server-side only) ──────────────────────────────────────────────
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// ── MySQL Connection Pool ─────────────────────────────────────────────────────
const pool = mysql.createPool({
  host:     process.env.MYSQL_HOST || '147.93.27.94',
  port:     parseInt(process.env.MYSQL_PORT || '5443'),
  user:     process.env.MYSQL_USER || 'mysql',
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DB || 'default',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
});

console.log(`🗄️  MySQL: ${process.env.MYSQL_HOST}:${process.env.MYSQL_PORT}/${process.env.MYSQL_DB}`);

// ── JWT helpers ───────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES = '7d';

interface JWTPayload {
  id: string;
  username: string;
  email: string;
  name: string;
  role: string;
}

function signJWT(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function verifyJWT(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

// ── MySQL Schema Initialization ───────────────────────────────────────────────
async function initSchema() {
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        role ENUM('viewer','editor','senior-editor','admin','super-admin') DEFAULT 'viewer',
        two_factor_enabled BOOLEAN DEFAULT FALSE,
        two_factor_secret VARCHAR(255),
        temp_2fa_secret VARCHAR(255),
        last_login DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS news (
        id VARCHAR(36) PRIMARY KEY,
        headline VARCHAR(1000),
        article_body MEDIUMTEXT,
        article_url VARCHAR(700) UNIQUE,
        source_name VARCHAR(255),
        source_key VARCHAR(100),
        published_at_source VARCHAR(255),
        session_id VARCHAR(36),
        theme VARCHAR(100),
        asset_tags JSON,
        safety_status ENUM('safe','unsafe','conditional') DEFAULT 'safe',
        rejection_reason TEXT,
        status ENUM('pending','processed','rejected') DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS stories (
        id VARCHAR(36) PRIMARY KEY,
        news_id VARCHAR(36),
        headline_en VARCHAR(1000),
        headline_ar VARCHAR(1000),
        caption_en MEDIUMTEXT,
        caption_ar MEDIUMTEXT,
        hashtags_en JSON,
        hashtags_ar JSON,
        hook_en MEDIUMTEXT,
        hook_ar MEDIUMTEXT,
        hook_hashtags_en JSON,
        hook_hashtags_ar JSON,
        image_url VARCHAR(2000),
        visual_brief TEXT,
        theme VARCHAR(100),
        format VARCHAR(50) DEFAULT 'Post',
        status ENUM('draft','review','approved','scheduled','published','rejected') DEFAULT 'draft',
        platform VARCHAR(100),
        created_by VARCHAR(36),
        social_package JSON,
        scheduled_at DATETIME,
        target_accounts JSON,
        en_caption_final MEDIUMTEXT,
        ar_caption_final MEDIUMTEXT,
        published_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS fetch_sessions (
        id VARCHAR(36) PRIMARY KEY,
        source VARCHAR(100),
        fetched_by VARCHAR(36),
        fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        total_articles INT DEFAULT 0,
        approved_articles INT DEFAULT 0,
        rejected_articles INT DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36),
        action_type VARCHAR(100),
        entity_type VARCHAR(100),
        entity_id VARCHAR(500),
        details TEXT,
        before_data JSON,
        after_data JSON,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS login_activity (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36),
        email VARCHAR(255),
        status ENUM('success','failure') DEFAULT 'success',
        ip VARCHAR(100),
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id VARCHAR(36) PRIMARY KEY,
        key_name VARCHAR(255) UNIQUE NOT NULL,
        value JSON,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS images (
        id VARCHAR(36) PRIMARY KEY,
        filename VARCHAR(500),
        original_name VARCHAR(500),
        mime_type VARCHAR(100),
        size INT,
        file_path VARCHAR(1000),
        url VARCHAR(1000),
        uploaded_by VARCHAR(36),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    // ── Migrations: add columns that may not exist in older tables ──
    const migrations = [
      "ALTER TABLE stories ADD COLUMN social_package JSON",
      "ALTER TABLE stories ADD COLUMN scheduled_at DATETIME",
      "ALTER TABLE stories ADD COLUMN target_accounts JSON",
      "ALTER TABLE stories ADD COLUMN en_caption_final MEDIUMTEXT",
      "ALTER TABLE stories ADD COLUMN ar_caption_final MEDIUMTEXT",
      "ALTER TABLE stories MODIFY COLUMN status ENUM('draft','review','approved','scheduled','published','rejected') DEFAULT 'draft'",
    ];
    for (const sql of migrations) {
      try { await conn.query(sql); } catch (_) { /* column already exists */ }
    }
    console.log('✅ MySQL schema ready');
  } finally {
    conn.release();
  }
}

// ── Super-Admin Bootstrap ─────────────────────────────────────────────────────
async function bootstrapSuperAdmin() {
  const username  = process.env.FIRST_ADMIN_USERNAME;
  const password  = process.env.FIRST_ADMIN_PASSWORD;
  const email     = process.env.FIRST_ADMIN_EMAIL;
  const name      = process.env.FIRST_ADMIN_NAME || 'Admin';

  if (!username || !password) {
    console.log('ℹ️  No FIRST_ADMIN_USERNAME/PASSWORD set — skipping bootstrap');
    return;
  }

  const [rows] = await pool.query<mysql.RowDataPacket[]>('SELECT COUNT(*) as cnt FROM users');
  if ((rows[0] as any).cnt > 0) {
    console.log('ℹ️  Users table not empty — skipping bootstrap');
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  const id   = randomUUID();
  await pool.query(
    'INSERT INTO users (id, username, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?, ?)',
    [id, username, email || null, hash, name, 'super-admin']
  );
  console.log(`✅ Super-admin created: "${username}" (${email})`);
}

// ── Audit log helper ──────────────────────────────────────────────────────────
async function logAction(
  userId: string, actionType: string, entityType: string,
  entityId: string, details = '', beforeData: any = null, afterData: any = null
) {
  try {
    await pool.query(
      'INSERT INTO audit_logs (id, user_id, action_type, entity_type, entity_id, details, before_data, after_data) VALUES (?,?,?,?,?,?,?,?)',
      [randomUUID(), userId, actionType, entityType, entityId, details,
       beforeData ? JSON.stringify(beforeData) : null,
       afterData  ? JSON.stringify(afterData)  : null]
    );
  } catch (e) {
    console.error('[AuditLog] Failed:', e);
  }
}

// ── Temporary image store (for Metricool uploads) ─────────────────────────────
const tempImageStore = new Map<string, { buf: Buffer; mime: string; ts: number }>();
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [k, v] of tempImageStore) if (v.ts < cutoff) tempImageStore.delete(k);
}, 5 * 60 * 1000);

async function startServer() {
  // Initialize schema + admin
  await initSchema();
  await bootstrapSuperAdmin();

  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '20mb' }));

  // COOP header for popup compatibility
  app.use((req: any, res: any, next: any) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    next();
  });

  // ── Local file storage (multer) ───────────────────────────────────────────
  const STORAGE_DIR = process.env.STORAGE_DIR || './storage';
  if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });

  const diskStorage = multer.diskStorage({
    destination: STORAGE_DIR,
    filename: (req, file, cb) => cb(null, `${randomUUID()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`),
  });
  const upload = multer({ storage: diskStorage, limits: { fileSize: 20 * 1024 * 1024 } });

  // Serve stored files publicly
  app.use('/storage', express.static(STORAGE_DIR));

  // ── Temp image endpoint (Metricool) ───────────────────────────────────────
  app.get('/api/temp-image/:id', (req: any, res: any) => {
    const img = tempImageStore.get(req.params.id);
    if (!img) return res.status(404).send('Not found');
    res.set('Content-Type', img.mime);
    res.set('Cache-Control', 'public, max-age=1800');
    res.send(img.buf);
  });

  // ── Auth Middleware ───────────────────────────────────────────────────────
  const checkAuth = (req: any, res: any, next: any) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    try {
      req.user = verifyJWT(header.split('Bearer ')[1]);
      next();
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  };

  const checkRole = (roles: string[]) => async (req: any, res: any, next: any) => {
    try {
      const [rows] = await pool.query<mysql.RowDataPacket[]>('SELECT role FROM users WHERE id = ?', [req.user.id]);
      if (!rows.length || !roles.includes(rows[0].role)) {
        return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
      }
      req.userRole = rows[0].role;
      next();
    } catch {
      res.status(403).json({ error: 'Forbidden' });
    }
  };

  // ── Health ────────────────────────────────────────────────────────────────
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  AUTH ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════

  // POST /api/auth/register
  app.post('/api/auth/register', async (req: any, res: any) => {
    const { username, password, email, name } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });

    try {
      const hash = await bcrypt.hash(password, 12);
      const id   = randomUUID();
      await pool.query(
        'INSERT INTO users (id, username, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?, ?)',
        [id, username.trim(), email || null, hash, name || username, 'viewer']
      );
      const token = signJWT({ id, username, email: email || '', name: name || username, role: 'viewer' });
      res.json({ token, user: { id, username, email, name, role: 'viewer' } });
    } catch (e: any) {
      if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Username or email already exists' });
      console.error('[Register]', e);
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  // POST /api/auth/login
  app.post('/api/auth/login', async (req: any, res: any) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });

    try {
      const [rows] = await pool.query<mysql.RowDataPacket[]>(
        'SELECT * FROM users WHERE username = ? OR email = ?',
        [username.trim(), username.trim()]
      );
      if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

      const user = rows[0];
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        await pool.query('INSERT INTO login_activity (id, user_id, email, status, ip, user_agent) VALUES (?,?,?,?,?,?)',
          [randomUUID(), user.id, user.email, 'failure',
           req.ip || 'unknown', req.headers['user-agent'] || '']);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // 2FA check
      if (user.two_factor_enabled && user.two_factor_secret) {
        // Return a short-lived temp token embedding user id only
        const tempToken = jwt.sign({ id: user.id, type: '2fa_pending' }, JWT_SECRET, { expiresIn: '5m' });
        return res.json({ requires2FA: true, tempToken });
      }

      // Update last login
      await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
      await pool.query('INSERT INTO login_activity (id, user_id, email, status, ip, user_agent) VALUES (?,?,?,?,?,?)',
        [randomUUID(), user.id, user.email, 'success',
         req.ip || 'unknown', req.headers['user-agent'] || '']);

      const payload: JWTPayload = { id: user.id, username: user.username, email: user.email || '', name: user.name || user.username, role: user.role };
      const token = signJWT(payload);
      res.json({ token, user: { id: user.id, username: user.username, email: user.email, name: user.name, role: user.role } });
    } catch (e: any) {
      console.error('[Login]', e);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  // POST /api/auth/2fa/check  (complete 2FA login using tempToken)
  app.post('/api/auth/2fa/check', async (req: any, res: any) => {
    const { tempToken, token } = req.body;
    if (!tempToken || !token) return res.status(400).json({ error: 'tempToken and token required' });

    try {
      const decoded = jwt.verify(tempToken, JWT_SECRET) as any;
      if (decoded.type !== '2fa_pending') return res.status(401).json({ error: 'Invalid temp token' });

      const [rows] = await pool.query<mysql.RowDataPacket[]>('SELECT * FROM users WHERE id = ?', [decoded.id]);
      if (!rows.length) return res.status(401).json({ error: 'User not found' });

      const user = rows[0];
      if (!authenticator.check(token, user.two_factor_secret)) {
        return res.status(401).json({ error: 'Invalid 2FA code' });
      }

      await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
      const payload: JWTPayload = { id: user.id, username: user.username, email: user.email || '', name: user.name || user.username, role: user.role };
      const fullToken = signJWT(payload);
      res.json({ token: fullToken, user: { id: user.id, username: user.username, email: user.email, name: user.name, role: user.role } });
    } catch (e: any) {
      console.error('[2FA check]', e);
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  });

  // POST /api/auth/login-activity
  app.post('/api/auth/login-activity', checkAuth, async (req: any, res: any) => {
    const { status, ip, userAgent } = req.body;
    try {
      await pool.query('INSERT INTO login_activity (id, user_id, email, status, ip, user_agent) VALUES (?,?,?,?,?,?)',
        [randomUUID(), req.user.id, req.user.email, status || 'success', ip || 'unknown', userAgent || '']);
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to log activity' });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  USER ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /api/users/me
  app.get('/api/users/me', checkAuth, async (req: any, res: any) => {
    try {
      const [rows] = await pool.query<mysql.RowDataPacket[]>(
        'SELECT id, username, email, name, role, two_factor_enabled, last_login, created_at FROM users WHERE id = ?',
        [req.user.id]
      );
      if (!rows.length) return res.status(404).json({ error: 'User not found' });
      res.json(rows[0]);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/users  (admin only)
  app.get('/api/users', checkAuth, checkRole(['admin', 'super-admin']), async (req: any, res: any) => {
    try {
      const [rows] = await pool.query<mysql.RowDataPacket[]>(
        'SELECT id, username, email, name, role, two_factor_enabled, last_login, created_at FROM users ORDER BY created_at ASC'
      );
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  // PATCH /api/users/:id/role
  app.patch('/api/users/:id/role', checkAuth, checkRole(['admin', 'super-admin']), async (req: any, res: any) => {
    const { id } = req.params;
    const { role } = req.body;
    const validRoles = ['viewer', 'editor', 'senior-editor', 'admin', 'super-admin'];
    if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });
    if (req.userRole === 'admin' && role === 'super-admin') {
      return res.status(403).json({ error: 'Admins cannot assign super-admin' });
    }
    try {
      const [before] = await pool.query<mysql.RowDataPacket[]>('SELECT role FROM users WHERE id = ?', [id]);
      await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, id]);
      await logAction(req.user.id, 'USER_ROLE_UPDATE', 'USER', id,
        `Role updated to ${role} by ${req.user.username}`,
        before[0] || null, { role });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to update role' });
    }
  });

  // DELETE /api/users/:id
  app.delete('/api/users/:id', checkAuth, checkRole(['admin', 'super-admin']), async (req: any, res: any) => {
    const { id } = req.params;
    if (id === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });
    try {
      const [rows] = await pool.query<mysql.RowDataPacket[]>('SELECT role FROM users WHERE id = ?', [id]);
      if (rows.length && rows[0].role === 'super-admin' && req.userRole === 'admin') {
        return res.status(403).json({ error: 'Admins cannot delete super-admins' });
      }
      await pool.query('DELETE FROM users WHERE id = ?', [id]);
      await logAction(req.user.id, 'USER_DELETED', 'USER', id, `Deleted by ${req.user.username}`);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // PATCH /api/users/:id/password  (change own password)
  app.patch('/api/users/:id/password', checkAuth, async (req: any, res: any) => {
    const { id } = req.params;
    if (id !== req.user.id) return res.status(403).json({ error: 'Cannot change another user\'s password' });
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'currentPassword and newPassword required' });
    try {
      const [rows] = await pool.query<mysql.RowDataPacket[]>('SELECT password_hash FROM users WHERE id = ?', [id]);
      if (!rows.length) return res.status(404).json({ error: 'User not found' });
      const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
      if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
      const hash = await bcrypt.hash(newPassword, 12);
      await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, id]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  FILE UPLOAD
  // ═══════════════════════════════════════════════════════════════════════════

  app.post('/api/upload', checkAuth, upload.single('file'), async (req: any, res: any) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
    const url = `/storage/${req.file.filename}`;
    try {
      await pool.query(
        'INSERT INTO images (id, filename, original_name, mime_type, size, file_path, url, uploaded_by) VALUES (?,?,?,?,?,?,?,?)',
        [randomUUID(), req.file.filename, req.file.originalname, req.file.mimetype,
         req.file.size, req.file.path, url, req.user.id]
      );
    } catch (e) { /* log only, don't fail upload */ console.error('[Upload DB]', e); }
    res.json({ url, fullUrl: appUrl + url });
  });

  // Brand asset upload → temp in-memory store (for Metricool)
  app.post('/api/upload-brand-asset', checkAuth, async (req: any, res: any) => {
    try {
      const { dataUrl } = req.body;
      if (!dataUrl) return res.status(400).json({ error: 'Missing dataUrl' });
      const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches) return res.status(400).json({ error: 'Invalid data URL format' });
      const mimeType = matches[1];
      const buffer   = Buffer.from(matches[2], 'base64');
      const id       = randomUUID();
      tempImageStore.set(id, { buf: buffer, mime: mimeType, ts: Date.now() });
      const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
      res.json({ url: `${appUrl}/api/temp-image/${id}` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  2FA ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════

  app.post('/api/auth/2fa/setup', checkAuth, async (req: any, res: any) => {
    const secret  = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(req.user.username || req.user.email, 'IST NewsBot', secret);
    try {
      const qrCodeUrl = await QRCode.toDataURL(otpauth);
      await pool.query('UPDATE users SET temp_2fa_secret = ? WHERE id = ?', [secret, req.user.id]);
      res.json({ qrCodeUrl, secret });
    } catch (e) {
      res.status(500).json({ error: '2FA setup failed' });
    }
  });

  app.post('/api/auth/2fa/verify', checkAuth, async (req: any, res: any) => {
    const { token } = req.body;
    try {
      const [rows] = await pool.query<mysql.RowDataPacket[]>(
        'SELECT temp_2fa_secret, two_factor_secret FROM users WHERE id = ?', [req.user.id]
      );
      if (!rows.length) return res.status(404).json({ error: 'User not found' });
      const secret = rows[0].temp_2fa_secret || rows[0].two_factor_secret;
      if (!secret) return res.status(400).json({ error: '2FA not setup' });

      if (!authenticator.check(token, secret)) {
        return res.status(400).json({ error: 'Invalid token' });
      }
      await pool.query(
        'UPDATE users SET two_factor_enabled = TRUE, two_factor_secret = ?, temp_2fa_secret = NULL WHERE id = ?',
        [secret, req.user.id]
      );
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: '2FA verification failed' });
    }
  });

  app.post('/api/auth/2fa/disable', checkAuth, async (req: any, res: any) => {
    const { token } = req.body;
    try {
      const [rows] = await pool.query<mysql.RowDataPacket[]>(
        'SELECT two_factor_secret FROM users WHERE id = ?', [req.user.id]
      );
      if (!rows.length || !rows[0].two_factor_secret) {
        return res.status(400).json({ error: '2FA not enabled' });
      }
      if (!authenticator.check(token, rows[0].two_factor_secret)) {
        return res.status(400).json({ error: 'Invalid token' });
      }
      await pool.query(
        'UPDATE users SET two_factor_enabled = FALSE, two_factor_secret = NULL WHERE id = ?',
        [req.user.id]
      );
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to disable 2FA' });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  AI PROXY ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════

  app.post('/api/ai/check-safety', checkAuth, async (req: any, res: any) => {
    try {
      const { content } = req.body;
      if (!content) return res.status(400).json({ error: 'Missing content' });
      const prompt = `Analyze the following financial news content for safety. Flag content that is: 1. Prohibited financial advice (guaranteeing returns). 2. Hate speech or harassment. 3. Misleading or false market manipulation. 4. Explicit or inappropriate content.\n\nContent: ${content}\n\nReturn JSON: { "safe": boolean, "reason": string | null }`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash', contents: prompt,
        config: { responseMimeType: 'application/json', responseSchema: { type: Type.OBJECT, properties: { safe: { type: Type.BOOLEAN }, reason: { type: Type.STRING, nullable: true } }, required: ['safe'] } }
      });
      res.json(JSON.parse(response.text || '{"safe":false}'));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/ai/rewrite', checkAuth, async (req: any, res: any) => {
    try {
      const { articleTitle, articleContent } = req.body;
      if (!articleTitle || !articleContent) return res.status(400).json({ error: 'Missing fields' });
      const OPENING_HOOKS = ['Here\'s what\'s moving markets today —','Traders are watching closely as...','Market alert:','The numbers are in —','What every Forex trader needs to know right now:','A key development just hit the tape —','Eyes on the market:','Breaking through resistance —'];
      const CLOSING_HOOKS = ['Here\'s why it matters for Forex traders.','Watch this space — the move could accelerate into the next session.','Analysts say the impact will be felt across multiple currency pairs.','Positioning ahead of tomorrow\'s session will be critical.','This is the data point markets have been waiting for.','The ripple effects are already being priced in.'];
      const prompt = `You are a Senior Forex Editor for IST Markets. Transform the following news into a polished editorial story for Instagram in both English and Arabic.\n\nOriginal Headline: ${articleTitle}\nOriginal Body: ${articleContent}\n\nSTRICT GUIDELINES:\n1. Tone: Professional, engaging, and authoritative.\n2. Length: 3 to 5 sentences per version.\n3. Audience: Forex and Commodity traders.\n4. NO guaranteed return claims or financial advice.\n5. NO political bias.\n6. Light CTA at the end.\n\nENGLISH STRUCTURE:\n- Opening Hook: Select one from: ${OPENING_HOOKS.join(' | ')}\n- Core News Body: Concise summary of the event.\n- Market Context: Why it matters for traders.\n- Closing Hook: Select one from: ${CLOSING_HOOKS.join(' | ')}\n\nARABIC STYLE:\n- Not a literal translation.\n- Use natural Arabic financial media style.\n- Preserve numbers and asset notation in standard format.\n- Full RTL compatibility.\n\nOUTPUT FORMAT (JSON ONLY):\n{\n  "en": { "headline": "...", "caption": "...", "hashtags": ["...", "..."] },\n  "ar": { "headline": "...", "caption": "...", "hashtags": ["...", "..."] }\n}`;
      const storySchema = { type: Type.OBJECT, properties: { en: { type: Type.OBJECT, properties: { headline: { type: Type.STRING }, caption: { type: Type.STRING }, hashtags: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ['headline','caption','hashtags'] }, ar: { type: Type.OBJECT, properties: { headline: { type: Type.STRING }, caption: { type: Type.STRING }, hashtags: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ['headline','caption','hashtags'] } }, required: ['en','ar'] };
      const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json', responseSchema: storySchema } });
      res.json(JSON.parse(response.text || '{}'));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/ai/generate-hook', checkAuth, async (req: any, res: any) => {
    try {
      const { articleTitle, articleContent } = req.body;
      if (!articleTitle || !articleContent) return res.status(400).json({ error: 'Missing fields' });
      const prompt = `You are a viral financial markets content writer specializing in hook-based social media posts that drive massive engagement.\n\nArticle Title: ${articleTitle}\nArticle Content: ${articleContent}\n\nWrite TWO viral hook-based social media posts — one in English and one in Arabic.\n\nUse ONE of these psychological hook frameworks per post:\n- FOMO Hook: "Everyone is talking about X but nobody is telling you Y..."\n- Curiosity Gap: "The reason [thing] happened will shock you..."\n- Authority Hook: "After analyzing 1000+ trades, here's what actually moves markets..."\n- Pattern Recognition: "Every time X happens, Y follows within Z days..."\n- Contrarian Hook: "While everyone is [doing X], smart money is quietly doing Y..."\n- Educational Value: "3 things your broker won't tell you about [topic]..."\n\nRules:\n- English post: Max 2200 chars. Start with the hook. Use line breaks for readability. 3-5 relevant hashtags.\n- Arabic post: Max 2200 chars. Translate naturally with the same hook energy. 3-5 Arabic hashtags.\n- Headline: Short punchy hook title (max 15 words).\n- DO NOT use generic financial news language. Make it feel personal, urgent, and exciting.`;
      const storySchema = { type: Type.OBJECT, properties: { en: { type: Type.OBJECT, properties: { headline: { type: Type.STRING }, caption: { type: Type.STRING }, hashtags: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ['headline','caption','hashtags'] }, ar: { type: Type.OBJECT, properties: { headline: { type: Type.STRING }, caption: { type: Type.STRING }, hashtags: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ['headline','caption','hashtags'] } }, required: ['en','ar'] };
      const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json', responseSchema: storySchema } });
      res.json(JSON.parse(response.text || '{}'));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/ai/visual-brief', checkAuth, async (req: any, res: any) => {
    try {
      const { headline, caption } = req.body;
      if (!headline || !caption) return res.status(400).json({ error: 'Missing fields' });
      const extractPrompt = `From this financial news headline and caption, extract the following in JSON:\n1. "subjectName": The main financial asset in UPPERCASE (e.g., GOLD, BTC, OIL, EUR, AAPL, S&P500).\n2. "mainElement": A physical 3D object representing this asset.\n3. "sentiment": One of "bullish", "bearish", or "neutral".\n\nHeadline: ${headline}\nCaption: ${caption}\n\nReturn ONLY valid JSON. Example: {"subjectName":"GOLD","mainElement":"shiny gold bars","sentiment":"bullish"}`;
      let subjectName = 'MARKETS', mainElement = 'gold coins and a rising arrow chart', sentiment = 'neutral';
      try {
        const extractRes = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: extractPrompt });
        const match = (extractRes.text || '').match(/\{[\s\S]*?\}/);
        if (match) { const d = JSON.parse(match[0]); if (d.subjectName) subjectName = String(d.subjectName).toUpperCase(); if (d.mainElement) mainElement = String(d.mainElement); if (d.sentiment) sentiment = String(d.sentiment); }
      } catch { /* fallback */ }
      const accentMap: Record<string,string> = { bullish: 'emerald green', bearish: 'crimson red', neutral: 'silver white' };
      const moodMap: Record<string,string> = { bullish: 'optimistic, energetic, upward momentum', bearish: 'tense, dramatic, downward pressure', neutral: 'professional, analytical, balanced' };
      const brief = `A professional financial advertisement poster for IST Markets brand.\nBACKGROUND: deep royal purple gradient — dark violet #150033 at the edges blending to rich purple #3d0066 in the center. The background MUST remain purple throughout.\nFOREGROUND: cinematic 3D rendered composition of ${mainElement} leaning against large bold 3D metallic silver letters spelling "${subjectName}". The ${mainElement} has subtle ${accentMap[sentiment]??accentMap.neutral} rim lighting and small ${accentMap[sentiment]??accentMap.neutral} glowing particles around it.\nDECORATIVE: elegant thin white abstract wave lines and floating light particles on the purple background.\nMOOD: ${moodMap[sentiment]??moodMap.neutral}.\nSTYLE: Studio-quality lighting, sharp shadows, cinematic depth of field, 8K resolution, minimalist corporate luxury style. Photorealistic render. No captions, no overlaid text, no news headlines — only the 3D composition.`;
      res.json(brief);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/ai/generate-image', checkAuth, async (req: any, res: any) => {
    try {
      const { brief, aspectRatio = '1:1' } = req.body;
      if (!brief) return res.status(400).json({ error: 'Missing brief' });
      const VALID_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9'];
      const ratio = VALID_RATIOS.includes(aspectRatio) ? aspectRatio : '1:1';
      const response = await ai.models.generateImages({ model: 'imagen-4.0-fast-generate-001', prompt: brief, config: { numberOfImages: 1, aspectRatio: ratio } });
      const imageBytes = response.generatedImages?.[0]?.image?.imageBytes;
      if (!imageBytes) throw new Error('Failed to generate image');
      res.json({ imageData: `data:image/png;base64,${imageBytes}` });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/ai/social-caption', checkAuth, async (req: any, res: any) => {
    try {
      const { headline, caption } = req.body;
      if (!headline || !caption) return res.status(400).json({ error: 'Missing fields' });
      const prompt = `Convert the following news article into a social media caption package for Instagram.\n\nHeadline: ${headline}\nEditorial Caption: ${caption}\n\nRequirements:\n1. Opening Hook: A punchy, attention-grabbing first line.\n2. Article Summary: A concise 2-3 sentence summary of the key news.\n3. CTA: A clear call to action.\n4. Hashtags: 5-7 relevant hashtags.\n\nProvide output in both English and natural, professional Arabic.\n\nOUTPUT FORMAT (JSON ONLY):\n{\n  "en": { "hook": "...", "summary": "...", "cta": "...", "hashtags": ["..."] },\n  "ar": { "hook": "...", "summary": "...", "cta": "...", "hashtags": ["..."] }\n}`;
      const socialSchema = { type: Type.OBJECT, properties: { en: { type: Type.OBJECT, properties: { hook: { type: Type.STRING }, summary: { type: Type.STRING }, cta: { type: Type.STRING }, hashtags: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ['hook','summary','cta','hashtags'] }, ar: { type: Type.OBJECT, properties: { hook: { type: Type.STRING }, summary: { type: Type.STRING }, cta: { type: Type.STRING }, hashtags: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ['hook','summary','cta','hashtags'] } }, required: ['en','ar'] };
      const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config: { responseMimeType: 'application/json', responseSchema: socialSchema } });
      res.json(JSON.parse(response.text || '{}'));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  RSS / NEWS SOURCES
  // ═══════════════════════════════════════════════════════════════════════════

  const RSS_SOURCES: Record<string, { label: string; url: string; category: string }> = {
    'bloomberg':      { label: 'Bloomberg Markets',     url: 'https://feeds.bloomberg.com/markets/news.rss',                            category: 'General'       },
    'yahoo':          { label: 'Yahoo Finance',          url: 'https://finance.yahoo.com/rss/topfinstories',                            category: 'General'       },
    'cnbc':           { label: 'CNBC Markets',           url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html',                  category: 'General'       },
    'bbc':            { label: 'BBC Business',           url: 'https://feeds.bbci.co.uk/news/business/rss.xml',                        category: 'General'       },
    'marketwatch':    { label: 'MarketWatch',            url: 'https://feeds.content.dowjones.io/public/rss/mw_realtimeheadlines',      category: 'General'       },
    'zerohedge':      { label: 'Zero Hedge',             url: 'https://cms.zerohedge.com/fullrss2.xml',                                category: 'General'       },
    'oilprice':       { label: 'OilPrice.com',           url: 'https://oilprice.com/rss/main',                                         category: 'Energy'        },
    'coindesk':       { label: 'CoinDesk',               url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',                       category: 'Crypto'        },
    'cointelegraph':  { label: 'CoinTelegraph',          url: 'https://cointelegraph.com/rss',                                         category: 'Crypto'        },
    'cryptoslate':    { label: 'CryptoSlate',            url: 'https://cryptoslate.com/feed/',                                         category: 'Crypto'        },
    'bitcoinmagazine':{ label: 'Bitcoin Magazine',       url: 'https://bitcoinmagazine.com/.rss/full/',                                category: 'Crypto'        },
    'fed':            { label: 'Federal Reserve',        url: 'https://www.federalreserve.gov/feeds/press_all.xml',                    category: 'Central Banks' },
    'ecb':            { label: 'ECB',                    url: 'https://www.ecb.europa.eu/rss/press.html',                              category: 'Central Banks' },
    'bbc_ar':         { label: 'BBC عربي — اقتصاد',     url: 'https://feeds.bbci.co.uk/arabic/business/rss.xml',                      category: 'Arabic'        },
    'rt_ar':          { label: 'RT عربي — اقتصاد',      url: 'https://arabic.rt.com/rss/business/',                                   category: 'Arabic'        },
    'forexlive':      { label: 'ForexLive',              url: 'https://www.forexlive.com/feed/',                                       category: 'Forex News'    },
    'fxstreet':       { label: 'FXStreet',               url: 'https://www.fxstreet.com/rss/news',                                    category: 'Forex News'    },
    'dailyfx':        { label: 'DailyFX',                url: 'https://www.dailyfx.com/feeds/all',                                    category: 'Forex News'    },
    'nasdaq_news':    { label: 'Nasdaq Markets News',    url: 'https://www.nasdaq.com/feed/rssoutbound?category=Markets',              category: 'General'       },
    'fxempire':       { label: 'FX Empire',              url: 'https://www.fxempire.com/api/v1/en/articles/rss',                      category: 'Forex News'    },
  };

  const fetchRSSFeed = async (sourceKey: string): Promise<{ title: string; content: string; url: string; date: string; source: string }[]> => {
    const src = RSS_SOURCES[sourceKey];
    if (!src) throw new Error(`Unknown RSS source: ${sourceKey}`);
    const response = await axios.get(src.url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/rss+xml, application/xml, application/atom+xml, text/xml, */*',
      },
      responseType: 'text', maxRedirects: 5,
    });
    const body = String(response.data || '');
    if (!body.trim().startsWith('<') && !body.includes('<rss') && !body.includes('<feed')) {
      throw new Error(`Non-XML response from ${src.label}`);
    }
    const parser = new XMLParser({ ignoreAttributes: false, textNodeName: '#text', processEntities: false });
    const result = parser.parse(body);
    const items: any[] = result?.rss?.channel?.item || result?.feed?.entry || [];
    const itemArr = Array.isArray(items) ? items : [items];
    return itemArr.slice(0, 15).map((item: any) => {
      const title   = (typeof item.title === 'object' ? item.title?.['#text'] : item.title) || '';
      const content = item['content:encoded'] || (typeof item.description === 'object' ? item.description?.['#text'] : item.description) || item.summary?.['#text'] || item.summary || '';
      const link    = (typeof item.link === 'object' ? item.link?.['@_href'] || item.link?.['#text'] : item.link) || (typeof item.guid === 'object' ? item.guid?.['#text'] : item.guid) || '';
      const date    = item.pubDate || item.published || item.updated || new Date().toISOString();
      return { title: String(title).trim(), content: String(content).replace(/<[^>]*>/g, ' ').trim(), url: String(link).trim(), date: String(date).trim(), source: src.label };
    }).filter(i => i.title && i.url);
  };

  const ASSETS = ['BTC', 'ETH', 'GOLD', 'OIL', 'EUR', 'USD', 'GBP', 'JPY', 'FED', 'INFLATION', 'CPI', 'GDP', 'OPEC', 'S&P 500', 'NASDAQ'];
  const POLITICAL_REJECTION = ['ELECTION', 'SENATE', 'PARLIAMENT', 'CABINET', 'WHITE HOUSE', 'COUP', 'PROTEST', 'SCANDAL', 'CORRUPTION'];
  const MARKET_IMPACT_PHRASES = ['MARKET IMPACT', 'PRICE ACTION', 'INVESTOR SENTIMENT', 'ECONOMIC OUTLOOK', 'TRADING VOLUME'];

  const classifyTheme = (text: string): string => {
    const t = text.toUpperCase();
    if (t.includes('OIL') || t.includes('GAS') || t.includes('OPEC')) return 'Energy Markets';
    if (t.includes('GOLD') || t.includes('SILVER')) return 'Precious Metals';
    if (t.includes('FED') || t.includes('INTEREST RATE')) return 'Fed Policy';
    if (t.includes('BITCOIN') || t.includes('ETH') || t.includes('CRYPTO')) return 'Crypto Markets';
    if (t.includes('EUR') || t.includes('USD') || t.includes('FOREX')) return 'Forex Markets';
    if (t.includes('INFLATION') || t.includes('CPI')) return 'Inflation Watch';
    return 'Market Update';
  };

  const runSafetyFilter = (headline: string, body: string): { status: 'safe' | 'unsafe' | 'conditional'; reason?: string } => {
    const h = headline.toUpperCase();
    const b = body.toUpperCase();
    if (ASSETS.some(a => h.includes(a))) return { status: 'safe' };
    if (POLITICAL_REJECTION.some(w => h.includes(w))) {
      const impactCount = MARKET_IMPACT_PHRASES.filter(p => b.includes(p)).length;
      if (impactCount >= 2) return { status: 'conditional', reason: 'Political context with high market impact' };
      return { status: 'unsafe', reason: 'Political keyword without asset reference' };
    }
    return { status: 'safe' };
  };

  // GET /api/news/sources
  app.get('/api/news/sources', checkAuth, (req, res) => {
    res.json(RSS_SOURCES);
  });

  // GET /api/news/fetch  (FMP API)
  app.get('/api/news/fetch', checkAuth, async (req: any, res: any) => {
    try {
      const apiKey = process.env.FMP_API_KEY;
      if (!apiKey) return res.status(400).json({ error: 'FMP_API_KEY not configured' });
      const sessionId = randomUUID();
      const fmpResponse = await axios.get('https://financialmodelingprep.com/stable/fmp-articles', {
        params: { limit: 10, apikey: apiKey }
      });
      const rawNews = Array.isArray(fmpResponse.data) ? fmpResponse.data : (fmpResponse.data.content || []);
      let approvedCount = 0, rejectedCount = 0;

      for (const article of rawNews) {
        const title   = article.title || 'No Title';
        const content = article.content || article.body || '';
        const url     = article.link || article.url || `https://financialmodelingprep.com/news/${Date.now()}`;
        const source  = article.site || article.source || 'FMP';
        const date    = article.date || article.publishedDate || new Date().toISOString();
        const safety  = runSafetyFilter(title, content);
        const theme   = classifyTheme(title + ' ' + content);
        const assets  = ASSETS.filter(a => (title + ' ' + content).toUpperCase().includes(a));

        const [existing] = await pool.query<mysql.RowDataPacket[]>('SELECT id FROM news WHERE article_url = ?', [url]);
        if (!existing.length) {
          await pool.query(
            'INSERT INTO news (id, headline, article_body, article_url, source_name, published_at_source, session_id, theme, asset_tags, safety_status, rejection_reason, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
            [randomUUID(), title, content, url, source, date, sessionId, theme, JSON.stringify(assets),
             safety.status, safety.reason || null, safety.status === 'unsafe' ? 'rejected' : 'pending']
          );
          safety.status === 'unsafe' ? rejectedCount++ : approvedCount++;
        }
      }
      await pool.query(
        'INSERT INTO fetch_sessions (id, fetched_by, fetched_at, total_articles, approved_articles, rejected_articles) VALUES (?,?,NOW(),?,?,?)',
        [sessionId, req.user.id, rawNews.length, approvedCount, rejectedCount]
      );
      res.json({ message: 'News fetch complete', approved: approvedCount, rejected: rejectedCount, sessionId });
    } catch (e: any) {
      console.error('[news/fetch]', e.message);
      res.status(500).json({ error: 'Failed to fetch news' });
    }
  });

  // GET /api/news/fetch-rss
  app.get('/api/news/fetch-rss', checkAuth, async (req: any, res: any) => {
    const sourceKey = (req.query.source as string) || 'bloomberg';
    try {
      if (!RSS_SOURCES[sourceKey]) return res.status(400).json({ error: `Unknown source: ${sourceKey}` });
      const sessionId = randomUUID();
      const rawItems  = await fetchRSSFeed(sourceKey);
      let approvedCount = 0, rejectedCount = 0;

      for (const item of rawItems) {
        const safety = runSafetyFilter(item.title, item.content);
        const theme  = classifyTheme(item.title + ' ' + item.content);
        const assets = ASSETS.filter(a => (item.title + ' ' + item.content).toUpperCase().includes(a));
        const [existing] = await pool.query<mysql.RowDataPacket[]>('SELECT id FROM news WHERE article_url = ?', [item.url]);
        if (!existing.length) {
          await pool.query(
            'INSERT INTO news (id, headline, article_body, article_url, source_name, source_key, published_at_source, session_id, theme, asset_tags, safety_status, rejection_reason, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [randomUUID(), item.title, item.content, item.url, item.source, sourceKey, item.date,
             sessionId, theme, JSON.stringify(assets), safety.status, safety.reason || null,
             safety.status === 'unsafe' ? 'rejected' : 'pending']
          );
          safety.status === 'unsafe' ? rejectedCount++ : approvedCount++;
        }
      }
      await pool.query(
        'INSERT INTO fetch_sessions (id, source, fetched_by, fetched_at, total_articles, approved_articles, rejected_articles) VALUES (?,?,?,NOW(),?,?,?)',
        [sessionId, sourceKey, req.user.id, rawItems.length, approvedCount, rejectedCount]
      );
      res.json({ message: 'RSS fetch complete', source: sourceKey, approved: approvedCount, rejected: rejectedCount, sessionId });
    } catch (e: any) {
      console.error(`[news/fetch-rss:${sourceKey}]`, e.message);
      res.status(500).json({ error: `Failed to fetch from ${RSS_SOURCES[sourceKey]?.label || sourceKey}: ${e.message}` });
    }
  });

  // GET /api/news/articles  (list all non-rejected news)
  app.get('/api/news/articles', checkAuth, async (req: any, res: any) => {
    try {
      const [rows] = await pool.query<mysql.RowDataPacket[]>(
        'SELECT * FROM news ORDER BY published_at_source DESC, created_at DESC LIMIT 500'
      );
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // GET /api/news/articles/:id  (single article)
  app.get('/api/news/articles/:id', checkAuth, async (req: any, res: any) => {
    try {
      const [rows] = await pool.query<mysql.RowDataPacket[]>('SELECT * FROM news WHERE id = ?', [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'Article not found' });
      res.json(rows[0]);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/news/articles  (manual article entry)
  app.post('/api/news/articles', checkAuth, async (req: any, res: any) => {
    try {
      const data = req.body;
      const id = randomUUID();
      await pool.query(
        'INSERT INTO news (id, headline, article_body, article_url, source_name, published_at_source, theme, asset_tags, safety_status, status) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [id, data.headline, data.article_body, data.article_url || `manual-${id}`,
         data.source_name || 'Manual Entry', new Date().toISOString(),
         data.theme || 'Market Update', JSON.stringify(data.asset_tags || []),
         'safe', 'pending']
      );
      res.json({ success: true, id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // PATCH /api/news/articles/:id  (update status)
  app.patch('/api/news/articles/:id', checkAuth, async (req: any, res: any) => {
    const { id } = req.params;
    const { status } = req.body;
    const valid = ['pending', 'processed', 'rejected'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    try {
      await pool.query('UPDATE news SET status = ? WHERE id = ?', [status, id]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // POST /api/news/articles/:id/select
  app.post('/api/news/articles/:id/select', checkAuth, async (req: any, res: any) => {
    const { id } = req.params;
    try {
      const [rows] = await pool.query<mysql.RowDataPacket[]>('SELECT * FROM news WHERE id = ?', [id]);
      if (!rows.length) return res.status(404).json({ error: 'Article not found' });
      await pool.query('UPDATE news SET status = ? WHERE id = ?', ['processed', id]);
      await logAction(req.user.id, 'SELECT_ARTICLE', 'news', id, '', rows[0], { ...rows[0], status: 'processed' });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: 'Selection failed' });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  STORIES
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/stories', checkAuth, async (req: any, res: any) => {
    try {
      const [rows] = await pool.query<mysql.RowDataPacket[]>('SELECT * FROM stories ORDER BY created_at DESC LIMIT 200');
      res.json(rows);
    } catch (e: any) {
      console.error('[/api/stories]', e.message);
      res.status(500).json({ error: 'Failed to fetch stories' });
    }
  });

  app.get('/api/stories/:id', checkAuth, async (req: any, res: any) => {
    try {
      const [rows] = await pool.query<mysql.RowDataPacket[]>('SELECT * FROM stories WHERE id = ?', [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'Story not found' });
      res.json(rows[0]);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/stories', checkAuth, async (req: any, res: any) => {
    try {
      const data = req.body;
      const id   = data.id || randomUUID();
      await pool.query(
        `INSERT INTO stories (id, news_id, headline_en, headline_ar, caption_en, caption_ar,
          hashtags_en, hashtags_ar, hook_en, hook_ar, hook_hashtags_en, hook_hashtags_ar,
          image_url, visual_brief, theme, format, status, platform, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
          headline_en=VALUES(headline_en), headline_ar=VALUES(headline_ar),
          caption_en=VALUES(caption_en), caption_ar=VALUES(caption_ar),
          hashtags_en=VALUES(hashtags_en), hashtags_ar=VALUES(hashtags_ar),
          hook_en=VALUES(hook_en), hook_ar=VALUES(hook_ar),
          hook_hashtags_en=VALUES(hook_hashtags_en), hook_hashtags_ar=VALUES(hook_hashtags_ar),
          image_url=VALUES(image_url), visual_brief=VALUES(visual_brief),
          theme=VALUES(theme), format=VALUES(format), status=VALUES(status),
          platform=VALUES(platform), updated_at=NOW()`,
        [id, data.news_id || null, data.headline_en || null, data.headline_ar || null,
         data.caption_en || null, data.caption_ar || null,
         data.hashtags_en ? JSON.stringify(data.hashtags_en) : null,
         data.hashtags_ar ? JSON.stringify(data.hashtags_ar) : null,
         data.hook_en || null, data.hook_ar || null,
         data.hook_hashtags_en ? JSON.stringify(data.hook_hashtags_en) : null,
         data.hook_hashtags_ar ? JSON.stringify(data.hook_hashtags_ar) : null,
         data.image_url || null, data.visual_brief || null,
         data.theme || null, data.format || 'Post',
         data.status || 'draft', data.platform || null,
         data.created_by || req.user.id]
      );
      res.json({ success: true, id });
    } catch (e: any) {
      console.error('[POST /api/stories]', e.message);
      res.status(500).json({ error: e.message });
    }
  });

  app.patch('/api/stories/:id', checkAuth, async (req: any, res: any) => {
    try {
      const { id } = req.params;
      const data = req.body;
      const fields: string[] = [];
      const values: any[] = [];
      const jsonFields = ['hashtags_en', 'hashtags_ar', 'hook_hashtags_en', 'hook_hashtags_ar', 'asset_tags', 'social_package', 'target_accounts'];
      for (const [k, v] of Object.entries(data)) {
        if (k === 'id') continue;
        fields.push(`${k} = ?`);
        values.push(jsonFields.includes(k) && typeof v !== 'string' ? JSON.stringify(v) : v);
      }
      if (!fields.length) return res.status(400).json({ error: 'No fields to update' });
      fields.push('updated_at = NOW()');
      values.push(id);
      await pool.query(`UPDATE stories SET ${fields.join(', ')} WHERE id = ?`, values);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/stories/:id', checkAuth, checkRole(['editor', 'senior-editor', 'admin', 'super-admin']), async (req: any, res: any) => {
    try {
      await pool.query('DELETE FROM stories WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Publish a story
  app.post('/api/stories/:id/publish', checkAuth, checkRole(['senior-editor', 'admin', 'super-admin']), async (req: any, res: any) => {
    try {
      const [rows] = await pool.query<mysql.RowDataPacket[]>('SELECT * FROM stories WHERE id = ?', [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'Story not found' });
      await pool.query('UPDATE stories SET status = ?, published_at = NOW() WHERE id = ?', ['published', req.params.id]);
      await logAction(req.user.id, 'STORY_PUBLISHED', 'story', req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  DASHBOARD & AUDIT LOGS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/dashboard/metrics', checkAuth, async (req: any, res: any) => {
    try {
      const [[storiesRow]] = await pool.query<mysql.RowDataPacket[]>('SELECT COUNT(*) as total FROM stories') as any;
      const [[newsRow]]    = await pool.query<mysql.RowDataPacket[]>('SELECT COUNT(*) as total FROM news') as any;
      const [[pubRow]]     = await pool.query<mysql.RowDataPacket[]>('SELECT COUNT(*) as total FROM stories WHERE status = ?', ['published']) as any;
      const [[rejRow]]     = await pool.query<mysql.RowDataPacket[]>('SELECT COUNT(*) as total FROM news WHERE status = ?', ['rejected']) as any;
      const [themeRows]    = await pool.query<mysql.RowDataPacket[]>('SELECT theme, COUNT(*) as cnt FROM stories WHERE theme IS NOT NULL GROUP BY theme') as any;
      const [fmtRows]      = await pool.query<mysql.RowDataPacket[]>('SELECT format, COUNT(*) as cnt FROM stories GROUP BY format') as any;

      const themeDistribution: any = {};
      for (const r of themeRows) themeDistribution[r.theme] = r.cnt;
      const formatDistribution: any = {};
      for (const r of fmtRows) formatDistribution[r.format || 'Post'] = r.cnt;

      res.json({
        totalNews: newsRow.total, totalStories: storiesRow.total,
        publishedCount: pubRow.total,
        rejectionRate: newsRow.total > 0 ? (rejRow.total / newsRow.total) * 100 : 0,
        themeDistribution, formatDistribution, productionTrend: [],
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/audit-logs', checkAuth, checkRole(['admin', 'super-admin']), async (req: any, res: any) => {
    try {
      const [rows] = await pool.query<mysql.RowDataPacket[]>('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100');
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════

  app.get('/api/settings/:key', checkAuth, async (req: any, res: any) => {
    try {
      const [rows] = await pool.query<mysql.RowDataPacket[]>('SELECT value FROM settings WHERE key_name = ?', [req.params.key]);
      if (!rows.length) return res.json(null);
      res.json(rows[0].value);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/settings/:key', checkAuth, checkRole(['admin', 'super-admin']), async (req: any, res: any) => {
    try {
      const id = randomUUID();
      await pool.query(
        'INSERT INTO settings (id, key_name, value) VALUES (?,?,?) ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()',
        [id, req.params.key, JSON.stringify(req.body)]
      );
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  METRICOOL PROXY
  // ═══════════════════════════════════════════════════════════════════════════

  const METRICOOL_BASE = 'https://app.metricool.com/api';
  const metricoolHeaders = () => ({
    'X-Mc-Auth': process.env.METRICOOL_USER_TOKEN!,
    'Content-Type': 'application/json',
  });

  app.get('/api/metricool/brands', checkAuth, async (req: any, res: any) => {
    try {
      const userId = process.env.METRICOOL_USER_ID;
      if (!userId || !process.env.METRICOOL_USER_TOKEN) {
        return res.status(500).json({ error: 'Metricool credentials not configured' });
      }
      const response = await axios.get(`${METRICOOL_BASE}/admin/simpleProfiles`, {
        params: { userId }, headers: metricoolHeaders(),
      });
      res.json(response.data);
    } catch (e: any) {
      res.status(500).json({ error: e.response?.data?.message || e.message });
    }
  });

  app.get('/api/metricool/accounts/:blogId', checkAuth, async (req: any, res: any) => {
    try {
      const userId = process.env.METRICOOL_USER_ID;
      const { blogId } = req.params;
      const response = await axios.get(`${METRICOOL_BASE}/admin/profiles-auth`, {
        params: { userId, blogId }, headers: metricoolHeaders(),
      });
      res.json(response.data);
    } catch (e: any) {
      res.status(500).json({ error: e.response?.data?.message || e.message });
    }
  });

  app.post('/api/metricool/schedule', checkAuth, async (req: any, res: any) => {
    try {
      const { blogId, networks, imageUrl, caption, scheduledAt } = req.body;
      if (!blogId || !networks?.length || !imageUrl || !caption) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      const providers = (networks as string[]).map((n: string) => ({ network: n.toUpperCase() }));
      const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;
      const pubDate  = scheduledAt ? new Date(scheduledAt) : new Date(Date.now() + 5 * 60 * 1000);
      const dubaiDate = new Date(pubDate.getTime() + DUBAI_OFFSET_MS);
      const pad = (n: number) => String(n).padStart(2, '0');
      const dateTimeStr = `${dubaiDate.getUTCFullYear()}-${pad(dubaiDate.getUTCMonth()+1)}-${pad(dubaiDate.getUTCDate())}T${pad(dubaiDate.getUTCHours())}:${pad(dubaiDate.getUTCMinutes())}:00`;
      const payload = {
        text: caption,
        publicationDate: { dateTime: dateTimeStr, timezone: 'Asia/Dubai' },
        providers, media: [imageUrl], autoPublish: true, targetBrandId: Number(blogId),
      };
      const response = await axios.post(`${METRICOOL_BASE}/v2/scheduler/posts`, payload, {
        params: { userId: process.env.METRICOOL_USER_ID, blogId: Number(blogId) },
        headers: metricoolHeaders(),
      });
      res.json({ success: true, data: response.data });
    } catch (e: any) {
      const detail = e.response?.data || e.message;
      res.status(500).json({ error: typeof detail === 'object' ? JSON.stringify(detail) : detail });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  //  VITE / STATIC
  // ═══════════════════════════════════════════════════════════════════════════

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
