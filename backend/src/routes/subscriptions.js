import { Router } from 'express';
import { pool } from '../db/index.js';
import { syncSubscriptions, addChannelByUrl, fetchChannelInfo, fetchVideosForChannel, resolveDateAfter } from '../services/ytdlp.js';

const VALID_MODES = ['default', 'added', 'date', 'beginning'];

const router = Router();

// GET /api/subscriptions â€” all subscriptions with category IDs and watched count
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        s.*,
        COALESCE(
          JSON_AGG(DISTINCT cc.category_id) FILTER (WHERE cc.category_id IS NOT NULL),
          '[]'::json
        ) AS category_ids,
        COUNT(DISTINCT wv.video_id)::int AS watched_count
      FROM subscriptions s
      LEFT JOIN channel_categories cc ON cc.channel_id = s.id
      LEFT JOIN videos v ON v.channel_id = s.id
      LEFT JOIN watched_videos wv ON wv.video_id = v.id
      GROUP BY s.id
      ORDER BY s.title
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('[Subscriptions] GET / failed:', err.message);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

// POST /api/subscriptions/sync â€” sync from YouTube feed (requires cookies)
router.post('/sync', async (req, res) => {
  const { fetch_since_mode, fetch_since_date } = req.body || {};
  const sinceMode = VALID_MODES.includes(fetch_since_mode) ? fetch_since_mode : 'default';
  const sinceDate = fetch_since_date || null;
  try {
    const count = await syncSubscriptions({ fetchSinceMode: sinceMode, fetchSinceDate: sinceDate });
    res.json({ count, message: `Synced ${count} subscriptions` });
  } catch (err) {
    console.error('[Subscriptions] Sync failed:', err.message);
    res.status(500).json({ error: err.message || 'Failed to sync subscriptions' });
  }
});

// POST /api/subscriptions/add â€” add a single channel by YouTube URL or @handle
router.post('/add', async (req, res) => {
  const { url, fetch_since_mode, fetch_since_date } = req.body;
  if (!url?.trim()) {
    return res.status(400).json({ error: 'url is required' });
  }
  if (fetch_since_mode && !VALID_MODES.includes(fetch_since_mode)) {
    return res.status(400).json({ error: 'Invalid fetch_since_mode' });
  }
  try {
    const channel = await addChannelByUrl(url.trim(), {
      fetchSinceMode: fetch_since_mode || 'default',
      fetchSinceDate: fetch_since_date || null,
    });
    res.json(channel);
  } catch (err) {
    console.error('[Subscriptions] Add channel failed:', err.message);
    res.status(500).json({ error: err.message || 'Failed to add channel' });
  }
});

// POST /api/subscriptions/import-csv â€” import Google Takeout subscriptions.csv
router.post('/import-csv', async (req, res) => {
  const { csv } = req.body;
  if (!csv?.trim()) {
    return res.status(400).json({ error: 'csv content is required' });
  }

  const lines = csv.trim().split('\n').slice(1);
  let count = 0;
  const errors = [];

  const { fetch_since_mode, fetch_since_date } = req.body;
  const sinceMode = VALID_MODES.includes(fetch_since_mode) ? fetch_since_mode : 'default';
  const sinceDate = fetch_since_date || null;

  for (const line of lines) {
    const parts = parseCsvLine(line);
    const channelId = parts[0]?.trim();
    const title = parts[2]?.trim();
    if (!channelId || !channelId.startsWith('UC')) continue;

    try {
      await pool.query(`
        INSERT INTO subscriptions (id, title, fetch_since_mode, fetch_since_date, last_synced_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (id) DO UPDATE SET
          title = COALESCE(EXCLUDED.title, subscriptions.title),
          last_synced_at = NOW()
      `, [channelId, title || channelId, sinceMode, sinceDate]);
      count++;
    } catch (err) {
      errors.push(channelId);
    }
  }

  res.json({ count, errors });
});

// POST /api/subscriptions/reset-display â€” apply banner/about defaults to all channels
router.post('/reset-display', async (req, res) => {
  const { show_banner = true, show_about = false } = req.body;
  try {
    const result = await pool.query(
      'UPDATE subscriptions SET show_banner = $1, show_about = $2',
      [show_banner, show_about]
    );
    res.json({ updated: result.rowCount });
  } catch (err) {
    console.error('[Subscriptions] reset-display failed:', err.message);
    res.status(500).json({ error: 'Failed to reset display defaults' });
  }
});


// GET /api/subscriptions/fetch-errors -- channels with a stored fetch error
router.get('/fetch-errors', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, title, thumbnail_url, last_fetch_error
      FROM subscriptions
      WHERE last_fetch_error IS NOT NULL
      ORDER BY title
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('[Subscriptions] GET /fetch-errors failed:', err.message);
    res.status(500).json({ error: 'Failed to fetch errors' });
  }
});

// DELETE /api/subscriptions/fetch-errors -- clear all stored errors
router.delete('/fetch-errors', async (req, res) => {
  try {
    const result = await pool.query("UPDATE subscriptions SET last_fetch_error = NULL WHERE last_fetch_error IS NOT NULL");
    res.json({ cleared: result.rowCount });
  } catch (err) {
    console.error('[Subscriptions] DELETE /fetch-errors failed:', err.message);
    res.status(500).json({ error: 'Failed to clear errors' });
  }
});
// GET /api/subscriptions/:id â€” single channel with video/watched counts
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT
        s.*,
        COALESCE(
          JSON_AGG(DISTINCT cc.category_id) FILTER (WHERE cc.category_id IS NOT NULL),
          '[]'::json
        ) AS category_ids,
        COUNT(DISTINCT v.id)::int AS video_count,
        COUNT(DISTINCT wv.video_id)::int AS watched_count
      FROM subscriptions s
      LEFT JOIN channel_categories cc ON cc.channel_id = s.id
      LEFT JOIN videos v ON v.channel_id = s.id
      LEFT JOIN watched_videos wv ON wv.video_id = v.id
      WHERE s.id = $1
      GROUP BY s.id
    `, [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Channel not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Subscriptions] GET /:id failed:', err.message);
    res.status(500).json({ error: 'Failed to fetch channel' });
  }
});

// PATCH /api/subscriptions/:id â€” update channel settings
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { hide_shorts, fetch_since_mode, fetch_since_date, is_favourite, show_banner, show_about } = req.body;

  if (fetch_since_mode !== undefined && !VALID_MODES.includes(fetch_since_mode)) {
    return res.status(400).json({ error: 'Invalid fetch_since_mode' });
  }

  const updates = [];
  const values = [];
  let p = 1;

  if (hide_shorts !== undefined) { updates.push(`hide_shorts = $${p++}`); values.push(hide_shorts); }
  if (fetch_since_mode !== undefined) { updates.push(`fetch_since_mode = $${p++}`); values.push(fetch_since_mode); }
  if (fetch_since_date !== undefined) { updates.push(`fetch_since_date = $${p++}`); values.push(fetch_since_date || null); }
  if (is_favourite !== undefined) { updates.push(`is_favourite = $${p++}`); values.push(is_favourite); }
  if (show_banner !== undefined) { updates.push(`show_banner = $${p++}`); values.push(show_banner); }
  if (show_about !== undefined) { updates.push(`show_about = $${p++}`); values.push(show_about); }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE subscriptions SET ${updates.join(', ')} WHERE id = $${p} RETURNING *`,
      values,
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Subscription not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Subscriptions] PATCH failed:', err.message);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

// POST /api/subscriptions/:id/categories â€” set category assignments
router.post('/:id/categories', async (req, res) => {
  const { id } = req.params;
  const { categoryIds } = req.body;

  if (!Array.isArray(categoryIds)) {
    return res.status(400).json({ error: 'categoryIds must be an array' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM channel_categories WHERE channel_id = $1', [id]);
    for (const categoryId of categoryIds) {
      await client.query(
        'INSERT INTO channel_categories (channel_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [id, categoryId]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true, channelId: id, categoryIds });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Subscriptions] Category assignment failed:', err.message);
    res.status(500).json({ error: 'Failed to update category assignments' });
  } finally {
    client.release();
  }
});

// POST /api/subscriptions/:id/refresh-info â€” fetch channel metadata from yt-dlp
router.post('/:id/refresh-info', async (req, res) => {
  const { id } = req.params;
  try {
    await fetchChannelInfo(id);
    const result = await pool.query(`
      SELECT s.*,
        COALESCE(JSON_AGG(DISTINCT cc.category_id) FILTER (WHERE cc.category_id IS NOT NULL), '[]'::json) AS category_ids,
        COUNT(DISTINCT v.id)::int AS video_count,
        COUNT(DISTINCT wv.video_id)::int AS watched_count
      FROM subscriptions s
      LEFT JOIN channel_categories cc ON cc.channel_id = s.id
      LEFT JOIN videos v ON v.channel_id = s.id
      LEFT JOIN watched_videos wv ON wv.video_id = v.id
      WHERE s.id = $1
      GROUP BY s.id
    `, [id]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Subscriptions] refresh-info failed:', err.message);
    res.status(500).json({ error: err.message || 'Failed to fetch channel info' });
  }
});

// POST /api/subscriptions/:id/mark-all-watched â€” mark all channel videos as watched
router.post('/:id/mark-all-watched', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      INSERT INTO watched_videos (video_id)
      SELECT id FROM videos WHERE channel_id = $1
      ON CONFLICT (video_id) DO NOTHING
    `, [id]);
    res.json({ success: true, count: result.rowCount });
  } catch (err) {
    console.error('[Subscriptions] mark-all-watched failed:', err.message);
    res.status(500).json({ error: 'Failed to mark all as watched' });
  }
});

// POST /api/subscriptions/:id/fetch â€” fetch videos for a specific channel
router.post('/:id/fetch', async (req, res) => {
  const { id } = req.params;
  try {
    const subResult = await pool.query('SELECT * FROM subscriptions WHERE id = $1', [id]);
    if (subResult.rows.length === 0) return res.status(404).json({ error: 'Channel not found' });
    const sub = subResult.rows[0];

    const { rows: settingRows } = await pool.query('SELECT key, value FROM app_settings');
    const gs = {};
    settingRows.forEach(r => (gs[r.key] = r.value));
    const globalMode = gs.fetch_since_mode || 'added';
    const globalDate = gs.fetch_since_date || null;

    const dateAfter = resolveDateAfter(sub, globalMode, globalDate);
    const count = await fetchVideosForChannel(id, { dateAfter });
    res.json({ count, channelId: id });
  } catch (err) {
    console.error('[Subscriptions] fetch failed:', err.message);
    res.status(500).json({ error: err.message || 'Failed to fetch channel videos' });
  }
});

// DELETE /api/subscriptions/:id/fetch-error -- dismiss one channel's error
router.delete('/:id/fetch-error', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("UPDATE subscriptions SET last_fetch_error = NULL WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[Subscriptions] DELETE /:id/fetch-error failed:', err.message);
    res.status(500).json({ error: 'Failed to clear error' });
  }
});

// DELETE /api/subscriptions/:id â€” remove subscription and its videos
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM subscriptions WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    res.json({ success: true, id });
  } catch (err) {
    console.error('[Subscriptions] DELETE failed:', err.message);
    res.status(500).json({ error: 'Failed to delete subscription' });
  }
});

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

export default router;


