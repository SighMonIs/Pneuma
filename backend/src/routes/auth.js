import { Router } from 'express';
import { hasCookies, saveCookies, deleteCookies } from '../services/ytdlp.js';
import { pool } from '../db/index.js';

const router = Router();

// GET /api/auth — setup status
router.get('/', async (req, res) => {
  try {
    const cookiesPresent = await hasCookies();
    const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM subscriptions');
    const channelCount = rows[0].count;

    res.json({
      hasCookies: cookiesPresent,
      channelCount,
      isConfigured: channelCount > 0 || cookiesPresent,
    });
  } catch (err) {
    console.error('[Auth] Status check failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/cookies — save cookies.txt content
router.post('/cookies', async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) {
    return res.status(400).json({ error: 'No cookie content provided' });
  }
  try {
    await saveCookies(content.trim());
    res.json({ success: true });
  } catch (err) {
    console.error('[Auth] Save cookies failed:', err.message);
    res.status(500).json({ error: 'Failed to save cookies' });
  }
});

// DELETE /api/auth/cookies — remove cookies
router.delete('/cookies', async (req, res) => {
  try {
    await deleteCookies();
    res.json({ success: true });
  } catch (err) {
    console.error('[Auth] Delete cookies failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
