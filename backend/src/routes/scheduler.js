import { Router } from 'express';
import cron from 'node-cron';
import { pool } from '../db/index.js';
import { scheduleJob, unscheduleJob, runJobNow } from '../services/scheduler.js';

const router = Router();

const VALID_ACTIONS = ['sync_subscriptions', 'fetch_videos'];

// GET /api/scheduler — list all jobs
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM scheduled_jobs ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('[Scheduler] GET / failed:', err.message);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// POST /api/scheduler — create job
router.post('/', async (req, res) => {
  const { name, action, cron_expression, enabled = true } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }
  if (!action || !VALID_ACTIONS.includes(action)) {
    return res.status(400).json({ error: `Action must be one of: ${VALID_ACTIONS.join(', ')}` });
  }
  if (!cron_expression || !cron.validate(cron_expression)) {
    return res.status(400).json({ error: 'Invalid cron expression' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO scheduled_jobs (name, action, cron_expression, enabled)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name.trim(), action, cron_expression, enabled]
    );

    const job = result.rows[0];

    if (job.enabled) {
      await scheduleJob(job);
    }

    // Refetch to get updated next_run_at
    const updated = await pool.query('SELECT * FROM scheduled_jobs WHERE id = $1', [job.id]);
    res.status(201).json(updated.rows[0]);
  } catch (err) {
    console.error('[Scheduler] POST / failed:', err.message);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

// PATCH /api/scheduler/:id — update job
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, action, cron_expression, enabled } = req.body;

  // Validate if provided
  if (action !== undefined && !VALID_ACTIONS.includes(action)) {
    return res.status(400).json({ error: `Action must be one of: ${VALID_ACTIONS.join(', ')}` });
  }
  if (cron_expression !== undefined && !cron.validate(cron_expression)) {
    return res.status(400).json({ error: 'Invalid cron expression' });
  }

  const updates = [];
  const values = [];
  let paramCount = 1;

  if (name !== undefined) { updates.push(`name = $${paramCount++}`); values.push(name.trim()); }
  if (action !== undefined) { updates.push(`action = $${paramCount++}`); values.push(action); }
  if (cron_expression !== undefined) { updates.push(`cron_expression = $${paramCount++}`); values.push(cron_expression); }
  if (enabled !== undefined) { updates.push(`enabled = $${paramCount++}`); values.push(enabled); }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE scheduled_jobs SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const job = result.rows[0];

    // Reschedule
    unscheduleJob(parseInt(id));
    if (job.enabled) {
      await scheduleJob(job);
    }

    // Refetch to get updated next_run_at
    const updated = await pool.query('SELECT * FROM scheduled_jobs WHERE id = $1', [id]);
    res.json(updated.rows[0]);
  } catch (err) {
    console.error('[Scheduler] PATCH failed:', err.message);
    res.status(500).json({ error: 'Failed to update job' });
  }
});

// DELETE /api/scheduler/:id — delete job
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    unscheduleJob(parseInt(id));

    const result = await pool.query(
      'DELETE FROM scheduled_jobs WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({ success: true, id });
  } catch (err) {
    console.error('[Scheduler] DELETE failed:', err.message);
    res.status(500).json({ error: 'Failed to delete job' });
  }
});

// POST /api/scheduler/:id/run — run job immediately
router.post('/:id/run', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('SELECT * FROM scheduled_jobs WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const job = result.rows[0];
    await runJobNow(job);

    const updated = await pool.query('SELECT * FROM scheduled_jobs WHERE id = $1', [id]);
    res.json({ success: true, job: updated.rows[0] });
  } catch (err) {
    console.error('[Scheduler] Run job failed:', err.message);
    res.status(500).json({ error: `Failed to run job: ${err.message}` });
  }
});

export default router;
