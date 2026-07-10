const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const { getDb } = require('../db');
const YTDLP = require('../lib/ytdlp');

function ytdlpSearch(query) {
  return new Promise((resolve, reject) => {
    const args = ['--flat-playlist', '-j', `ytsearch10:${query}`];
    const proc = spawn(YTDLP, args, { timeout: 30000 });
    let out = '';
    let err = '';
    proc.stdout.on('data', d => { out += d; });
    proc.stderr.on('data', d => { err += d; });
    proc.on('close', () => {
      const results = [];
      for (const line of out.trim().split('\n').filter(Boolean)) {
        try {
          const item = JSON.parse(line);
          results.push({
            yt_id:       item.id,
            title:       item.title,
            channel_id:  item.channel_id || item.uploader_id,
            channel:     item.channel || item.uploader,
            thumbnail:   item.thumbnail || `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`,
            duration:    item.duration,
            view_count:  item.view_count,
            published:   item.upload_date,
          });
        } catch {}
      }
      resolve(results);
    });
    proc.on('error', reject);
  });
}

// GET /api/search?q=query
router.get('/', async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) return res.json({ local: { channels: [], videos: [] }, youtube: [] });

  const db = getDb();
  const term = `%${q.trim()}%`;

  // Local results
  const localChannels = db.prepare(`
    SELECT id, name, thumbnail_url, yt_channel_id FROM channels
    WHERE name LIKE ? ORDER BY name LIMIT 10
  `).all(term);

  const localVideos = db.prepare(`
    SELECT v.id, v.title, v.thumbnail_url, v.published_at, v.watched_at,
           c.name AS channel_name, c.id AS channel_id
    FROM videos v JOIN channels c ON c.id = v.channel_id
    WHERE v.title LIKE ? ORDER BY v.published_at DESC LIMIT 20
  `).all(term);

  res.json({ local: { channels: localChannels, videos: localVideos }, youtube: null });
});

// GET /api/search/youtube?q=query — separate endpoint so client can stream it progressively
router.get('/youtube', async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) return res.json([]);

  const db = getDb();
  const searchEnabled = db.prepare("SELECT value FROM settings WHERE key='search_youtube'").get()?.value;
  if (searchEnabled === 'false') return res.json({ disabled: true });

  try {
    const results = await ytdlpSearch(q.trim());
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
