const express = require('express');
const router = express.Router();
const { getDb } = require('../db');

// GET /api/videos
// Query params: channel_id, category_id, filter(all|unwatched|watched), sort(newest|oldest), duration(any|short|medium|long), limit, offset
router.get('/', (req, res) => {
  const {
    channel_id,
    category_id,
    filter   = 'all',
    sort     = 'newest',
    duration = 'any',
    limit    = 50,
    offset   = 0,
  } = req.query;

  const db = getDb();
  const conditions = [];
  const params = [];

  if (channel_id) {
    conditions.push('v.channel_id = ?');
    params.push(channel_id);
  }

  if (category_id) {
    conditions.push('c.category_id = ?');
    params.push(category_id);
  }

  if (filter === 'unwatched') conditions.push('v.watched_at IS NULL');
  if (filter === 'watched')   conditions.push('v.watched_at IS NOT NULL');

  if (duration === 'short')  { conditions.push('v.duration < 300');  }  // < 5 min
  if (duration === 'medium') { conditions.push('v.duration BETWEEN 300 AND 1200'); } // 5-20 min
  if (duration === 'long')   { conditions.push('v.duration > 1200'); } // > 20 min

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const order = sort === 'oldest' ? 'v.published_at ASC' : 'v.published_at DESC';

  const rows = db.prepare(`
    SELECT
      v.id, v.channel_id, v.yt_id, v.title, v.thumbnail_url,
      v.duration, v.published_at, v.watched_at, v.watch_progress_secs, v.created_at,
      c.name        AS channel_name,
      c.thumbnail_url AS channel_thumbnail
    FROM videos v
    JOIN channels c ON c.id = v.channel_id
    ${where}
    ORDER BY ${order}
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), parseInt(offset));

  const total = db.prepare(`
    SELECT COUNT(*) as count
    FROM videos v
    JOIN channels c ON c.id = v.channel_id
    ${where}
  `).get(...params).count;

  res.json({ videos: rows, total, offset: parseInt(offset), limit: parseInt(limit) });
});

// GET /api/videos/by-yt-id/:ytId — look up a video by YouTube ID (must be before /:id)
router.get('/by-yt-id/:ytId', (req, res) => {
  const db = getDb();
  const row = db.prepare(`
    SELECT v.id, v.channel_id, v.yt_id, v.title, v.thumbnail_url,
           v.duration, v.published_at, v.watched_at, v.watch_progress_secs, v.created_at,
           c.name AS channel_name, c.thumbnail_url AS channel_thumbnail
    FROM videos v JOIN channels c ON c.id = v.channel_id
    WHERE v.yt_id = ?
  `).get(req.params.ytId);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// PATCH /api/videos/:id/progress — save watch position
router.patch('/:id/progress', (req, res) => {
  const secs = parseInt(req.body.progress_secs, 10);
  if (isNaN(secs)) return res.status(400).json({ error: 'progress_secs required' });
  const db = getDb();
  db.prepare('UPDATE videos SET watch_progress_secs = ? WHERE id = ?').run(secs, req.params.id);
  res.json({ ok: true });
});

// POST /api/videos/:id/watched
router.post('/:id/watched', (req, res) => {
  const db = getDb();
  db.prepare("UPDATE videos SET watched_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// DELETE /api/videos/:id/watched
router.delete('/:id/watched', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE videos SET watched_at = NULL WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// POST /api/videos/watched-bulk — { ids: [1,2,3] }
router.post('/watched-bulk', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids required' });
  const db = getDb();
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`UPDATE videos SET watched_at = datetime('now') WHERE id IN (${placeholders})`).run(...ids);
  res.json({ ok: true });
});

module.exports = router;
