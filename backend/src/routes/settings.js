import { Router } from 'express';
import { pool } from '../db/index.js';

const router = Router();
const VALID_MODES = ['added', 'date', 'beginning'];

async function loadSettings(client = pool) {
  const { rows } = await client.query('SELECT key, value FROM app_settings');
  const map = {};
  rows.forEach(r => (map[r.key] = r.value));
  return {
    fetch_since_mode: map.fetch_since_mode || 'added',
    fetch_since_date: map.fetch_since_date || null,
  };
}

// GET /api/settings
router.get('/', async (req, res) => {
  try {
    res.json(await loadSettings());
  } catch (err) {
    console.error('[Settings] GET / failed:', err.message);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PATCH /api/settings
router.patch('/', async (req, res) => {
  const { fetch_since_mode, fetch_since_date } = req.body;

  if (fetch_since_mode !== undefined && !VALID_MODES.includes(fetch_since_mode)) {
    return res.status(400).json({ error: 'Invalid fetch_since_mode' });
  }

  try {
    if (fetch_since_mode !== undefined) {
      await pool.query(
        `INSERT INTO app_settings (key, value) VALUES ('fetch_since_mode', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [fetch_since_mode],
      );
    }
    if (fetch_since_date !== undefined) {
      await pool.query(
        `INSERT INTO app_settings (key, value) VALUES ('fetch_since_date', $1)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [fetch_since_date || null],
      );
    }
    res.json(await loadSettings());
  } catch (err) {
    console.error('[Settings] PATCH / failed:', err.message);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// POST /api/settings/apply-default — reset all subscriptions to the global default
router.post('/apply-default', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      `UPDATE subscriptions SET fetch_since_mode = 'default', fetch_since_date = NULL`,
    );
    res.json({ success: true, updated: rowCount });
  } catch (err) {
    console.error('[Settings] apply-default failed:', err.message);
    res.status(500).json({ error: 'Failed to apply default to all channels' });
  }
});

export default router;
