import { Router } from 'express';
import { pool } from '../db/index.js';
import { fetchAllVideos, fetchVideosForChannel, fetchProgress } from '../services/ytdlp.js';

const router = Router();

// GET /api/videos — paginated videos with filters
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const { channelId, categoryId, search, hideShorts, hideWatched, sortBy, sortOrder } = req.query;
    const sortColumns = { published_at: 'v.published_at', title: 'v.title', view_count: 'v.view_count', duration_seconds: 'v.duration_seconds' };
    const safeSortBy = sortColumns[sortBy] || 'v.published_at';
    const safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const conditions = [];
    const values = [];
    let paramCount = 1;

    // Channel filter
    if (channelId) {
      conditions.push(`v.channel_id = $${paramCount++}`);
      values.push(channelId);
    }

    // Category filter: join through channel_categories
    if (categoryId) {
      conditions.push(`EXISTS (
        SELECT 1 FROM channel_categories cc2
        WHERE cc2.channel_id = v.channel_id AND cc2.category_id = $${paramCount++}
      )`);
      values.push(categoryId);
    }

    // Search filter
    if (search) {
      conditions.push(`(
        v.title ILIKE $${paramCount} OR
        v.description ILIKE $${paramCount} OR
        s.title ILIKE $${paramCount}
      )`);
      values.push(`%${search}%`);
      paramCount++;
    }

    // Hide shorts: global flag OR per-channel setting
    if (hideShorts === 'true') {
      conditions.push(`v.is_short = FALSE AND s.hide_shorts = FALSE`);
    } else {
      // Even without global flag, respect per-channel setting
      conditions.push(`(v.is_short = FALSE OR s.hide_shorts = FALSE)`);
      // Actually: hide videos that are shorts AND the channel has hide_shorts=true
      conditions.pop();
      conditions.push(`NOT (v.is_short = TRUE AND s.hide_shorts = TRUE)`);
    }

    // Hide watched
    if (hideWatched === 'true') {
      conditions.push(`wv.video_id IS NULL`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count query
    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM videos v
      JOIN subscriptions s ON s.id = v.channel_id
      LEFT JOIN watched_videos wv ON wv.video_id = v.id
      ${whereClause}
    `;

    const countResult = await pool.query(countQuery, values);
    const total = countResult.rows[0].total;

    // Data query
    const dataQuery = `
      SELECT
        v.id,
        v.title,
        v.thumbnail_url,
        v.published_at,
        v.duration_seconds,
        v.is_short,
        v.view_count,
        v.like_count,
        v.channel_id,
        s.title AS channel_title,
        s.thumbnail_url AS channel_thumbnail,
        CASE WHEN wv.video_id IS NOT NULL THEN TRUE ELSE FALSE END AS is_watched,
        COALESCE(vp.position_seconds, 0) AS position_seconds,
        COALESCE(vp.percent_watched, 0) AS percent_watched
      FROM videos v
      JOIN subscriptions s ON s.id = v.channel_id
      LEFT JOIN watched_videos wv ON wv.video_id = v.id
      LEFT JOIN video_progress vp ON vp.video_id = v.id
      ${whereClause}
      ORDER BY ${safeSortBy} ${safeSortOrder}
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const dataResult = await pool.query(dataQuery, [...values, limit, offset]);

    res.json({
      videos: dataResult.rows,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('[Videos] GET / failed:', err.message);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

// POST /api/videos/fetch — start background fetch, returns immediately
router.post('/fetch', (req, res) => {
  if (fetchProgress.running) {
    return res.json({ alreadyRunning: true, ...fetchProgress });
  }
  fetchAllVideos().catch(err => {
    console.error('[Videos] Fetch all failed:', err.message);
    fetchProgress.running = false;
  });
  res.json({ started: true });
});

// GET /api/videos/fetch-status — current fetch progress
router.get('/fetch-status', (req, res) => {
  res.json({ ...fetchProgress });
});

// POST /api/videos/progress — save watch position
router.post('/progress', async (req, res) => {
  const { videoId, positionSeconds, durationSeconds } = req.body;
  if (!videoId || durationSeconds == null) {
    return res.status(400).json({ error: 'videoId and durationSeconds are required' });
  }
  const pct = durationSeconds > 0 ? positionSeconds / durationSeconds : 0;
  try {
    await pool.query(
      `INSERT INTO video_progress (video_id, position_seconds, duration_seconds, percent_watched, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (video_id) DO UPDATE SET
         position_seconds = EXCLUDED.position_seconds,
         duration_seconds = EXCLUDED.duration_seconds,
         percent_watched = EXCLUDED.percent_watched,
         updated_at = NOW()`,
      [videoId, positionSeconds, durationSeconds, pct]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[Videos] Save progress failed:', err.message);
    res.status(500).json({ error: 'Failed to save progress' });
  }
});

// POST /api/videos/watched — mark video as watched
router.post('/watched', async (req, res) => {
  const { videoId } = req.body;

  if (!videoId) {
    return res.status(400).json({ error: 'videoId is required' });
  }

  try {
    await pool.query(
      `INSERT INTO watched_videos (video_id) VALUES ($1)
       ON CONFLICT (video_id) DO NOTHING`,
      [videoId]
    );
    res.json({ success: true, videoId });
  } catch (err) {
    console.error('[Videos] Mark watched failed:', err.message);
    res.status(500).json({ error: 'Failed to mark video as watched' });
  }
});

// DELETE /api/videos/watched/:videoId — unmark video as watched
router.delete('/watched/:videoId', async (req, res) => {
  const { videoId } = req.params;

  try {
    await pool.query('DELETE FROM watched_videos WHERE video_id = $1', [videoId]);
    res.json({ success: true, videoId });
  } catch (err) {
    console.error('[Videos] Unmark watched failed:', err.message);
    res.status(500).json({ error: 'Failed to unmark video as watched' });
  }
});

// POST /api/videos/:id/fetch-channel — fetch videos for a specific channel
router.post('/:id/fetch-channel', async (req, res) => {
  const { id } = req.params;

  try {
    // Look up the video's channel_id
    const videoResult = await pool.query('SELECT channel_id FROM videos WHERE id = $1', [id]);
    let channelId;

    if (videoResult.rows.length > 0) {
      channelId = videoResult.rows[0].channel_id;
    } else {
      // Maybe id is actually a channel id
      const subResult = await pool.query('SELECT id FROM subscriptions WHERE id = $1', [id]);
      if (subResult.rows.length > 0) {
        channelId = subResult.rows[0].id;
      } else {
        return res.status(404).json({ error: 'Channel not found' });
      }
    }

    const count = await fetchVideosForChannel(channelId);
    res.json({ count, channelId });
  } catch (err) {
    console.error('[Videos] Fetch channel failed:', err.message);
    if (err.message === 'Not authenticated') {
      return res.status(401).json({ error: 'Not authenticated with YouTube' });
    }
    res.status(500).json({ error: 'Failed to fetch channel videos' });
  }
});

export default router;
