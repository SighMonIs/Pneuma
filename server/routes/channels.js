const express = require('express');
const router = express.Router();
const multer = require('multer');
const { spawn } = require('child_process');
const YTDLP = require('../lib/ytdlp');
const { getDb, withTransaction } = require('../db');
const { pollAllFeeds, pollChannel, pollEvents, getPollState } = require('../jobs/rss-poller');
const { thumbEmitter } = require('../jobs/thumbnail-sync');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ─── helpers ────────────────────────────────────────────────────────────────

function channelIdFromUrl(url) {
  const m = url.match(/youtube\.com\/channel\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

function rssUrlFromChannelId(channelId) {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
}

function detectInputType(input) {
  const s = input.trim();
  if (/youtube\.com\/watch\?v=|youtu\.be\/[A-Za-z0-9_-]/.test(s)) return 'video-url';
  if (/youtube\.com\/@[^/]+/.test(s)) return 'channel-handle';
  if (/youtube\.com\/channel\/[A-Za-z0-9_-]/.test(s)) return 'channel-id-url';
  if (/youtube\.com\/c\/[^/]+/.test(s)) return 'channel-legacy';
  if (/youtube\.com\/feeds\/videos\.xml/.test(s)) return 'rss-youtube';
  if (/^https?:\/\//.test(s)) return 'url-unknown';
  return 'search-query';
}

function ytdlpJson(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(YTDLP, args, { timeout: 30000 });
    let out = '';
    let err = '';
    proc.stdout.on('data', d => { out += d; });
    proc.stderr.on('data', d => { err += d; });
    proc.on('close', code => {
      const lines = out.trim().split('\n').filter(Boolean);
      const parsed = [];
      for (const line of lines) {
        try { parsed.push(JSON.parse(line)); } catch {}
      }
      if (parsed.length === 0 && code !== 0) return reject(new Error(err || 'yt-dlp failed'));
      resolve(parsed);
    });
    proc.on('error', reject);
  });
}

async function resolveChannelFromUrl(url) {
  const type = detectInputType(url);

  if (type === 'channel-id-url') {
    const channelId = channelIdFromUrl(url);
    if (channelId) {
      return { yt_channel_id: channelId, rss_url: rssUrlFromChannelId(channelId), name: null };
    }
  }

  if (type === 'rss-youtube') {
    const m = url.match(/channel_id=([A-Za-z0-9_-]+)/);
    if (m) {
      return { yt_channel_id: m[1], rss_url: url, name: null };
    }
  }

  // For video URLs, @handles, legacy /c/ — use yt-dlp
  const args = type === 'video-url'
    ? ['-j', '--no-playlist', url]
    : ['--flat-playlist', '--playlist-items', '1', '-j', url];

  const items = await ytdlpJson(args);
  const info = items[0];
  if (!info) throw new Error('Could not resolve channel info');

  const channelId = info.channel_id || info.uploader_id;
  return {
    yt_channel_id: channelId,
    name: info.channel || info.uploader,
    thumbnail_url: info.channel_url ? `https://i.ytimg.com/vi/${info.id}/default.jpg` : null,
    rss_url: channelId ? rssUrlFromChannelId(channelId) : null,
  };
}

function upsertChannel(db, data) {
  const existing = db.prepare('SELECT id FROM channels WHERE yt_channel_id = ?').get(data.yt_channel_id);
  if (existing) return { id: existing.id, created: false };
  const result = db.prepare(`
    INSERT INTO channels (yt_channel_id, name, rss_url, thumbnail_url, category_id, settings_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    data.yt_channel_id,
    data.name || 'Unknown Channel',
    data.rss_url || null,
    data.thumbnail_url || null,
    data.category_id || null,
    data.settings_json || '{}',
  );
  return { id: Number(result.lastInsertRowid), created: true };
}

// ─── routes ─────────────────────────────────────────────────────────────────

// GET /api/channels
router.get('/', (req, res) => {
  const db = getDb();
  const channels = db.prepare(`
    SELECT c.*, COUNT(v.id) as video_count,
           SUM(CASE WHEN v.id IS NOT NULL AND v.watched_at IS NULL THEN 1 ELSE 0 END) as unwatched_count
    FROM channels c
    LEFT JOIN videos v ON v.channel_id = c.id
    GROUP BY c.id
    ORDER BY c.name
  `).all();
  res.json(channels);
});

// GET /api/channels/poll-errors — errors from last poll (must be before /:id)
router.get('/poll-errors', (req, res) => {
  res.json({ errors: getPollState().errors || [] });
});

// GET /api/channels/poll-events — SSE stream (must be before /:id)
router.get('/poll-events', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const cur = getPollState();
  if (cur.running) {
    send({ type: 'start',    total: cur.total });
    send({ type: 'progress', done: cur.done, total: cur.total });
  }

  const onStart    = (d) => send({ type: 'start',    ...d });
  const onProgress = (d) => send({ type: 'progress', ...d });
  const onComplete = (d) => send({ type: 'complete', ...d });

  pollEvents.on('start',    onStart);
  pollEvents.on('progress', onProgress);
  pollEvents.on('complete', onComplete);

  const cleanup = () => {
    pollEvents.off('start',    onStart);
    pollEvents.off('progress', onProgress);
    pollEvents.off('complete', onComplete);
  };

  req.on('close', cleanup);
});

// GET /api/channels/thumb-events — SSE stream for thumbnail sync progress (must be before /:id)
router.get('/thumb-events', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  const onData = (d) => send(d);
  thumbEmitter.on('data', onData);
  req.on('close', () => thumbEmitter.off('data', onData));
});

// GET /api/channels/:id/thumb and /:id/banner — proxy channel images to avoid ORB in Firefox
function makeImageProxy(column) {
  return async (req, res) => {
    const db = getDb();
    const ch = db.prepare(`SELECT ${column} AS url FROM channels WHERE id = ?`).get(req.params.id);
    if (!ch?.url) return res.status(404).end();
    try {
      const upstream = await fetch(ch.url);
      if (!upstream.ok) return res.status(502).end();
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(buf);
    } catch {
      res.status(502).end();
    }
  };
}
router.get('/:id/thumb',  makeImageProxy('thumbnail_url'));
router.get('/:id/banner', makeImageProxy('banner_url'));

// GET /api/channels/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const channel = db.prepare(`
    SELECT c.*, COUNT(v.id) as video_count
    FROM channels c LEFT JOIN videos v ON v.channel_id = c.id
    WHERE c.id = ?
    GROUP BY c.id
  `).get(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Not found' });
  res.json(channel);
});

// POST /api/channels — manual add { name, yt_channel_id, rss_url, category_id }
router.post('/', async (req, res) => {
  const { name, yt_channel_id, rss_url, category_id, settings_json } = req.body;
  if (!yt_channel_id && !rss_url) return res.status(400).json({ error: 'yt_channel_id or rss_url required' });
  const db = getDb();
  const { id, created } = upsertChannel(db, { name, yt_channel_id, rss_url, category_id, settings_json });
  if (created) {
    const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(id);
    pollChannel(channel).catch(e => console.error('Poll error:', e.message));
  }
  res.json({ id, created });
});

// POST /api/channels/add — add by URL or token (iOS shortcut)
router.post('/add', async (req, res) => {
  const url = req.body.url || req.query.url;
  const token = req.body.token || req.query.token;
  const category_id = req.body.category_id || req.query.category_id || null;

  if (token) {
    const db = getDb();
    const stored = db.prepare("SELECT value FROM settings WHERE key = 'api_token'").get()?.value;
    if (token !== stored) return res.status(401).json({ error: 'Invalid token' });
  }

  if (!url) return res.status(400).json({ error: 'url required' });

  try {
    const info = await resolveChannelFromUrl(url);
    const db = getDb();
    const { id, created } = upsertChannel(db, { ...info, category_id });
    const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(id);
    if (created) pollChannel(channel).catch(e => console.error('Poll error:', e.message));
    res.json({ id, created, channel });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/channels/resolve — detect type + return preview (for search bar)
router.post('/resolve', async (req, res) => {
  const { input } = req.body;
  if (!input) return res.status(400).json({ error: 'input required' });
  const type = detectInputType(input.trim());
  if (type === 'search-query') return res.json({ type, detected: false });

  try {
    const info = await resolveChannelFromUrl(input.trim());
    res.json({ type, detected: true, ...info });
  } catch (e) {
    res.json({ type, detected: false, error: e.message });
  }
});

// PUT /api/channels/:id
router.put('/:id', (req, res) => {
  const { name, category_id, settings_json } = req.body;
  const db = getDb();
  db.prepare(`
    UPDATE channels SET
      name          = COALESCE(?, name),
      category_id   = ?,
      settings_json = COALESCE(?, settings_json)
    WHERE id = ?
  `).run(name ?? null, category_id !== undefined ? category_id : db.prepare('SELECT category_id FROM channels WHERE id=?').get(req.params.id)?.category_id, settings_json ?? null, req.params.id);
  res.json({ ok: true });
});

// POST /api/channels/:id/relink — re-resolve channel from a new URL/handle
router.post('/:id/relink', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });
  try {
    const info = await resolveChannelFromUrl(url.trim());
    if (!info.yt_channel_id) return res.status(400).json({ error: 'Could not resolve channel ID' });
    const db = getDb();
    // Check the resolved ID isn't already taken by a different channel
    const conflict = db.prepare('SELECT id FROM channels WHERE yt_channel_id = ? AND id != ?').get(info.yt_channel_id, req.params.id);
    if (conflict) return res.status(409).json({ error: 'That channel is already in your library' });
    db.prepare(`
      UPDATE channels SET
        yt_channel_id = ?,
        rss_url       = ?,
        name          = COALESCE(?, name),
        thumbnail_url = COALESCE(?, thumbnail_url)
      WHERE id = ?
    `).run(info.yt_channel_id, info.rss_url, info.name || null, info.thumbnail_url || null, req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/channels/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM videos WHERE channel_id = ?').run(req.params.id);
  db.prepare('DELETE FROM channels WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Normalise a raw CSV header key → our internal field name.
// Handles Google Takeout ("Channel Id", "Channel Url", "Channel Title")
// and our own format ("channel_id", "channel_url", "name").
function normaliseHeader(h) {
  const s = h.trim().toLowerCase().replace(/['"]/g, '');
  if (s === 'channel id')    return 'channel_id';
  if (s === 'channel url')   return 'channel_url';
  if (s === 'channel title') return 'name';
  return s.replace(/\s+/g, '_'); // collapse any remaining spaces
}

// POST /api/channels/import — CSV upload
// Accepts Google Takeout format (Channel Id, Channel Url, Channel Title)
// and our own format (channel_id / channel_url / name / category).
router.post('/import', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const text = req.file.buffer.toString('utf-8');
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return res.status(400).json({ error: 'CSV must have header + data rows' });

  const header = lines[0].split(',').map(normaliseHeader);
  const rows = lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
    return Object.fromEntries(header.map((h, i) => [h, vals[i] || '']));
  });

  const db = getDb();
  const results = { imported: 0, skipped: 0, errors: [] };

  for (const row of rows) {
    try {
      const channelId = row.channel_id || row.yt_channel_id;
      const channelUrl = row.channel_url || row.url;
      const name = row.name || null;

      let info = {};

      if (channelId) {
        info = { yt_channel_id: channelId, name, rss_url: rssUrlFromChannelId(channelId) };
      } else if (channelUrl) {
        info = await resolveChannelFromUrl(channelUrl);
        if (name) info.name = name;
      } else {
        results.errors.push(`Row missing channel_id/url: ${JSON.stringify(row)}`);
        results.skipped++;
        continue;
      }

      // Resolve category by name if provided
      let category_id = null;
      if (row.category) {
        let cat = db.prepare('SELECT id FROM categories WHERE name = ?').get(row.category);
        if (!cat) {
          const r = db.prepare('INSERT INTO categories (name) VALUES (?)').run(row.category);
          cat = { id: r.lastInsertRowid };
        }
        category_id = cat.id;
      }

      const { created } = upsertChannel(db, { ...info, category_id });
      created ? results.imported++ : results.skipped++;
    } catch (e) {
      results.errors.push(e.message);
      results.skipped++;
    }
  }

  if (results.imported > 0) pollAllFeeds().catch(e => console.error('Poll error:', e.message));
  res.json(results);
});

// POST /api/channels/refresh — trigger a poll (returns immediately, progress via SSE)
router.post('/refresh', (req, res) => {
  pollAllFeeds().catch(e => console.error('Poll error:', e.message));
  res.json({ ok: true });
});

// POST /api/channels/:id/poll — retry polling a single channel
router.post('/:id/poll', async (req, res) => {
  const db = getDb();
  const channel = db.prepare('SELECT * FROM channels WHERE id = ?').get(req.params.id);
  if (!channel) return res.status(404).json({ error: 'Not found' });
  const { added, error } = await pollChannel(channel);
  if (error) return res.json({ ok: false, error });
  res.json({ ok: true, added });
});

module.exports = router;
