import { Router } from 'express';
import { pool } from '../db/index.js';
import { syncSubscriptions, addChannelByUrl } from '../services/ytdlp.js';

const router = Router();

// GET /api/subscriptions — all subscriptions with category IDs
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        s.*,
        COALESCE(
          JSON_AGG(cc.category_id) FILTER (WHERE cc.category_id IS NOT NULL),
          '[]'::json
        ) AS category_ids
      FROM subscriptions s
      LEFT JOIN channel_categories cc ON cc.channel_id = s.id
      GROUP BY s.id
      ORDER BY s.title
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('[Subscriptions] GET / failed:', err.message);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

// POST /api/subscriptions/sync — sync from YouTube feed (requires cookies)
router.post('/sync', async (req, res) => {
  try {
    const count = await syncSubscriptions();
    res.json({ count, message: `Synced ${count} subscriptions` });
  } catch (err) {
    console.error('[Subscriptions] Sync failed:', err.message);
    res.status(500).json({ error: err.message || 'Failed to sync subscriptions' });
  }
});

// POST /api/subscriptions/add — add a single channel by YouTube URL or @handle
router.post('/add', async (req, res) => {
  const { url } = req.body;
  if (!url?.trim()) {
    return res.status(400).json({ error: 'url is required' });
  }
  try {
    const channel = await addChannelByUrl(url.trim());
    res.json(channel);
  } catch (err) {
    console.error('[Subscriptions] Add channel failed:', err.message);
    res.status(500).json({ error: err.message || 'Failed to add channel' });
  }
});

// POST /api/subscriptions/import-csv — import Google Takeout subscriptions.csv
router.post('/import-csv', async (req, res) => {
  const { csv } = req.body;
  if (!csv?.trim()) {
    return res.status(400).json({ error: 'csv content is required' });
  }

  // Google Takeout format: Channel Id,Channel Url,Channel Title
  const lines = csv.trim().split('\n').slice(1); // skip header
  let count = 0;
  const errors = [];

  for (const line of lines) {
    const parts = parseCsvLine(line);
    const channelId = parts[0]?.trim();
    const title = parts[2]?.trim();
    if (!channelId || !channelId.startsWith('UC')) continue;

    try {
      await pool.query(`
        INSERT INTO subscriptions (id, title, last_synced_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (id) DO UPDATE SET
          title = COALESCE(EXCLUDED.title, subscriptions.title),
          last_synced_at = NOW()
      `, [channelId, title || channelId]);
      count++;
    } catch (err) {
      errors.push(channelId);
    }
  }

  res.json({ count, errors });
});

// PATCH /api/subscriptions/:id — update channel settings
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { hide_shorts } = req.body;

  try {
    const result = await pool.query(
      'UPDATE subscriptions SET hide_shorts = $1 WHERE id = $2 RETURNING *',
      [hide_shorts, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[Subscriptions] PATCH failed:', err.message);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
});

// POST /api/subscriptions/:id/categories — set category assignments
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

// DELETE /api/subscriptions/:id — remove subscription and its videos
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
