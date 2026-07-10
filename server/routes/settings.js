const express = require('express');
const router = express.Router();
const { randomUUID } = require('crypto');
const { getDb, withTransaction } = require('../db');

// GET /api/settings
router.get('/', (req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
  // Never expose token over the API in plain GET — only via the setup page
  delete settings.api_token;
  res.json(settings);
});

// GET /api/settings/token — returns token for setup page (local network only)
router.get('/token', (req, res) => {
  const db = getDb();
  const token = db.prepare("SELECT value FROM settings WHERE key='api_token'").get()?.value;
  res.json({ token });
});

// PUT /api/settings — { key: value, ... }
router.put('/', (req, res) => {
  const db = getDb();
  const allowed = [
    'playback_mode', 'poll_interval', 'search_youtube',
    'show_shorts', 'auto_mark_watched', 'default_view',
    'default_filter', 'default_sort',
    'mark_watched_at_enabled', 'mark_watched_at_percent',
  ];
  const update = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  withTransaction(db, () => {
    for (const [key, value] of Object.entries(req.body)) {
      if (allowed.includes(key)) update.run(key, String(value));
    }
  });
  res.json({ ok: true });
});

// POST /api/settings/regenerate-token
router.post('/regenerate-token', (req, res) => {
  const db = getDb();
  const token = randomUUID();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('api_token', ?)").run(token);
  res.json({ token });
});

module.exports = router;
