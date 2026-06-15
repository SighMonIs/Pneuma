import cron from 'node-cron';
import { pool } from '../db/index.js';
import { syncSubscriptions, fetchAllVideos } from './ytdlp.js';

// In-memory map: jobId -> cron task
const runningTasks = new Map();

function getNextRunAt(cronExpression) {
  try {
    // Use node-cron to compute next run time
    // node-cron doesn't have a built-in "next run" calculator, so we approximate
    // by creating a temporary task and checking
    const now = new Date();
    // Parse the cron expression to compute next time
    // Simple approach: create the task and immediately destroy it,
    // using the schedule pattern to calculate
    const parts = cronExpression.trim().split(/\s+/);
    if (parts.length < 5) return null;

    // For simplicity, add 1 minute increments and check against cron pattern
    // This is a basic implementation — use next-cron-time logic manually
    const next = computeNextCronTime(cronExpression, now);
    return next;
  } catch {
    return null;
  }
}

function computeNextCronTime(expression, fromDate) {
  // Advance minute by minute (max 1 year) until cron matches
  const date = new Date(fromDate.getTime() + 60000); // start 1 minute ahead
  date.setSeconds(0, 0);

  for (let i = 0; i < 525600; i++) { // max 1 year in minutes
    if (matchesCron(expression, date)) {
      return date;
    }
    date.setMinutes(date.getMinutes() + 1);
  }
  return null;
}

function matchesCron(expression, date) {
  const parts = expression.trim().split(/\s+/);
  if (parts.length < 5) return false;

  const [min, hour, dom, month, dow] = parts;

  return (
    matchField(min, date.getMinutes(), 0, 59) &&
    matchField(hour, date.getHours(), 0, 23) &&
    matchField(dom, date.getDate(), 1, 31) &&
    matchField(month, date.getMonth() + 1, 1, 12) &&
    matchField(dow, date.getDay(), 0, 6)
  );
}

function matchField(field, value, min, max) {
  if (field === '*') return true;

  // Handle step values: */n or start/n
  if (field.includes('/')) {
    const [range, step] = field.split('/');
    const stepNum = parseInt(step);
    if (range === '*') {
      return value % stepNum === min % stepNum;
    }
    const start = parseInt(range);
    return value >= start && (value - start) % stepNum === 0;
  }

  // Handle ranges: n-m
  if (field.includes('-')) {
    const [start, end] = field.split('-').map(Number);
    return value >= start && value <= end;
  }

  // Handle lists: n,m,o
  if (field.includes(',')) {
    return field.split(',').map(Number).includes(value);
  }

  return parseInt(field) === value;
}

async function runAction(action) {
  console.log(`[Scheduler] Running action: ${action}`);
  if (action === 'sync_subscriptions') {
    return await syncSubscriptions();
  } else if (action === 'fetch_videos') {
    return await fetchAllVideos();
  } else {
    throw new Error(`Unknown action: ${action}`);
  }
}

export async function scheduleJob(job) {
  // Stop existing task if any
  if (runningTasks.has(job.id)) {
    runningTasks.get(job.id).stop();
    runningTasks.delete(job.id);
  }

  if (!job.enabled) return;

  if (!cron.validate(job.cron_expression)) {
    throw new Error(`Invalid cron expression: ${job.cron_expression}`);
  }

  const nextRun = getNextRunAt(job.cron_expression);
  if (nextRun) {
    await pool.query('UPDATE scheduled_jobs SET next_run_at = $1 WHERE id = $2', [nextRun, job.id]);
  }

  const task = cron.schedule(job.cron_expression, async () => {
    console.log(`[Scheduler] Job ${job.id} (${job.name}) triggered`);
    const startTime = new Date();

    try {
      await runAction(job.action);
    } catch (err) {
      console.error(`[Scheduler] Job ${job.id} failed:`, err.message);
    }

    const nextRunAt = getNextRunAt(job.cron_expression);
    await pool.query(
      'UPDATE scheduled_jobs SET last_run_at = $1, next_run_at = $2 WHERE id = $3',
      [startTime, nextRunAt, job.id]
    );
  });

  runningTasks.set(job.id, task);
  console.log(`[Scheduler] Scheduled job ${job.id} (${job.name}) with cron: ${job.cron_expression}`);
}

export function unscheduleJob(jobId) {
  if (runningTasks.has(jobId)) {
    runningTasks.get(jobId).stop();
    runningTasks.delete(jobId);
    console.log(`[Scheduler] Unscheduled job ${jobId}`);
  }
}

export async function initScheduler() {
  const result = await pool.query(
    'SELECT * FROM scheduled_jobs WHERE enabled = TRUE'
  );

  for (const job of result.rows) {
    try {
      await scheduleJob(job);
    } catch (err) {
      console.error(`[Scheduler] Failed to schedule job ${job.id}:`, err.message);
    }
  }

  console.log(`[Scheduler] Initialized with ${result.rows.length} jobs`);
}

export async function rescheduleAll() {
  // Stop all running tasks
  for (const [jobId, task] of runningTasks.entries()) {
    task.stop();
    runningTasks.delete(jobId);
  }

  // Reload and reschedule from DB
  await initScheduler();
}

export async function runJobNow(job) {
  const startTime = new Date();
  try {
    await runAction(job.action);
  } catch (err) {
    console.error(`[Scheduler] Manual run of job ${job.id} failed:`, err.message);
    throw err;
  }

  const nextRunAt = getNextRunAt(job.cron_expression);
  await pool.query(
    'UPDATE scheduled_jobs SET last_run_at = $1, next_run_at = $2 WHERE id = $3',
    [startTime, nextRunAt, job.id]
  );
}
