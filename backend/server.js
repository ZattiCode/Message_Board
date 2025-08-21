// server.js (ESM) – Railway/Render friendly
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

app.use(cors());
app.use(express.json());

// ---------- Banco (SQLite) ----------
const DB_FILE = process.env.DATABASE_FILE || '/tmp/guestbook.db';
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
console.log('Using DB at:', DB_FILE);

const dbPromise = open({ filename: DB_FILE, driver: sqlite3.Database });

async function init() {
  const db = await dbPromise;
  await db.exec('PRAGMA foreign_keys = ON;');
  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      likes INTEGER DEFAULT 0,
      dislikes INTEGER DEFAULT 0
    );
  `);
  try { await db.exec(`ALTER TABLE messages ADD COLUMN likes INTEGER DEFAULT 0`); } catch {}
  try { await db.exec(`ALTER TABLE messages ADD COLUMN dislikes INTEGER DEFAULT 0`); } catch {}
}
await init();

// ---------- ROTAS DA API (antes do static/fallback) ----------
app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/messages', async (_req, res) => {
  try {
    const db = await dbPromise;
    const rows = await db.all('SELECT * FROM messages ORDER BY created_at DESC');
    res.json(rows);
  } catch (e) {
    console.error('GET /api/messages error:', e);
    res.status(500).json({ error: 'list failed' });
  }
});

app.post('/api/messages', async (req, res) => {
  try {
    const { name, message } = req.body || {};
    if (!name || !message) return res.status(400).json({ error: 'name and message are required' });
    const db = await dbPromise;
    const stmt = await db.run('INSERT INTO messages (name, message) VALUES (?, ?)', [name, message]);
    const inserted = await db.get('SELECT * FROM messages WHERE id = ?', [stmt.lastID]);
    res.status(201).json(inserted);
  } catch (e) {
    console.error('POST /api/messages error:', e);
    res.status(500).json({ error: 'create failed' });
  }
});

// like/dislike com troca idempotente
app.post('/api/messages/:id/vote', async (req, res) => {
  const id = Number(req.params.id);
  const { vote, prev } = req.body || {}; // 'like' | 'dislike' | null
  if (!['like','dislike',null].includes(vote) || !['like','dislike',null].includes(prev)) {
    return res.status(400).json({ error: 'invalid vote payload' });
  }
  const db = await dbPromise;
  await db.exec('BEGIN');
  try {
    if (prev === 'like') {
      await db.run('UPDATE messages SET likes = CASE WHEN likes>0 THEN likes-1 ELSE 0 END WHERE id=?',[id]);
    } else if (prev === 'dislike') {
      await db.run('UPDATE messages SET dislikes = CASE WHEN dislikes>0 THEN dislikes-1 ELSE 0 END WHERE id=?',[id]);
    }
    if (vote === 'like') {
      await db.run('UPDATE messages SET likes = COALESCE(likes,0)+1 WHERE id=?',[id]);
    } else if (vote === 'dislike') {
      await db.run('UPDATE messages SET dislikes = COALESCE(dislikes,0)+1 WHERE id=?',[id]);
    }
    await db.exec('COMMIT');
    const row = await db.get('SELECT * FROM messages WHERE id=?',[id]);
    res.json(row);
  } catch (err) {
    await db.exec('ROLLBACK');
    console.error('POST /api/messages/:id/vote error:', err);
    res.status(500).json({ error: 'vote failed' });
  }
});

// deletar protegido por token
app.delete('/api/messages/:id', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1]; // "Bearer <token>"
  if (token !== ADMIN_TOKEN) return res.status(403).json({ error: 'Forbidden: invalid admin token' });
  const id = Number(req.params.id);
  const db = await dbPromise;
  await db.run('DELETE FROM messages WHERE id=?', [id]);
  res.status(204).send();
});

// ---------- STATIC + FALLBACK (depois das APIs) ----------
const PUBLIC_DIR = path.join(__dirname, 'public'); // coloque seu front em backend/public
app.use(express.static(PUBLIC_DIR));
app.get('*', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

// ---------- Start ----------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on 0.0.0.0:${PORT}`);
});
