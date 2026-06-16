import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { pool } from '../db/index.js';

const execFileAsync = promisify(execFile);
const DATA_DIR = process.env.DATA_DIR || '/app/data';
const COOKIES_FILE = path.join(DATA_DIR, 'cookies.txt');

export const fetchProgress = {
  running: false,
  total: 0,
  done: 0,
  errors: 0,
  startedAt: null,
};

export async function hasCookies() {
  try { await fs.access(COOKIES_FILE); return true; }
  catch { return false; }
}

export async function saveCookies(content) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(COOKIES_FILE, content, 'utf-8');
}

export async function deleteCookies() {
  try { await fs.unlink(COOKIES_FILE); } catch {}
}

async function cookieArgs() {
  return (await hasCookies()) ? ['--cookies', COOKIES_FILE] : [];
}

async function runYtDlp(args) {
  try {
    const { stdout, stderr } = await execFileAsync('yt-dlp', args, {
      maxBuffer: 100 * 1024 * 1024,
    });
    if (stderr) console.log('[yt-dlp]', stderr.slice(0, 300));
    return stdout;
  } catch (err) {
    if (err.stdout) return err.stdout;
    throw new Error(`yt-dlp failed: ${err.stderr?.slice(0, 200) || err.message}`);
  }
}

function parseJsonLines(output) {
  return (output || '').trim().split('\n')
    .filter(l => l.trim().startsWith('{'))
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

function detectShort(title, desc, secs) {
  const lower = (title + ' ' + desc).toLowerCase();
  if (lower.includes('#shorts')) return true;
  if (secs > 0 && secs <= 60 && !lower.includes('premiere')) return true;
  return false;
}

function bestThumbnail(thumbnails) {
  if (!thumbnails?.length) return null;
  return [...thumbnails].sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url ?? null;
}

async function fetchChannelThumbnail(channelId) {
  const args = [
    '-J', '--flat-playlist', '--no-warnings', '--quiet',
    '--playlist-end', '1',
    ...(await cookieArgs()),
    `https://www.youtube.com/channel/${channelId}`,
  ];
  try {
    const output = await runYtDlp(args);
    const data = JSON.parse(output.trim());
    return bestThumbnail(data.thumbnails);
  } catch {
    return null;
  }
}

export async function syncSubscriptions() {
  const args = [
    '--flat-playlist', '--dump-json', '--no-warnings', '--quiet',
    ...(await cookieArgs()),
    'https://www.youtube.com/feed/channels',
  ];

  const output = await runYtDlp(args);
  const items = parseJsonLines(output);
  let count = 0;

  for (const item of items) {
    const id = item.channel_id || item.id;
    const title = item.channel || item.uploader || item.title;
    const thumbnail = bestThumbnail(item.thumbnails);
    if (!id) continue;

    await pool.query(`
      INSERT INTO subscriptions (id, title, thumbnail_url, last_synced_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        thumbnail_url = COALESCE(EXCLUDED.thumbnail_url, subscriptions.thumbnail_url),
        last_synced_at = NOW()
    `, [id, title, thumbnail]);
    count++;
  }
  return count;
}

export async function fetchVideosForChannel(channelId, maxResults = 20) {
  const args = [
    '--flat-playlist', '--dump-json', '--no-warnings', '--quiet',
    '--playlist-end', String(maxResults),
    ...(await cookieArgs()),
    `https://www.youtube.com/channel/${channelId}/videos`,
  ];

  const output = await runYtDlp(args);
  const items = parseJsonLines(output);
  let count = 0;

  for (const item of items) {
    if (!item.id) continue;
    const duration = Number(item.duration) || 0;
    const title = item.title || '';
    const desc = item.description || '';
    const isShort = detectShort(title, desc, duration);
    const thumbnail =
      item.thumbnails?.find(t => t.width >= 320)?.url ??
      `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`;

    let publishedAt = null;
    if (item.upload_date) {
      const d = item.upload_date;
      publishedAt = new Date(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`);
    }

    await pool.query(`
      INSERT INTO videos (id, channel_id, title, description, thumbnail_url, published_at,
        duration_seconds, is_short, view_count, like_count, fetched_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,NOW())
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        thumbnail_url = EXCLUDED.thumbnail_url,
        published_at = EXCLUDED.published_at,
        duration_seconds = EXCLUDED.duration_seconds,
        is_short = EXCLUDED.is_short,
        view_count = EXCLUDED.view_count,
        fetched_at = NOW()
    `, [item.id, channelId, title, desc, thumbnail, publishedAt, duration, isShort, item.view_count || 0]);
    count++;
  }

  // Backfill channel thumbnail if missing
  try {
    const { rows } = await pool.query('SELECT thumbnail_url FROM subscriptions WHERE id = $1', [channelId]);
    if (rows[0] && !rows[0].thumbnail_url) {
      const thumb = await fetchChannelThumbnail(channelId);
      if (thumb) {
        await pool.query('UPDATE subscriptions SET thumbnail_url = $1 WHERE id = $2', [thumb, channelId]);
      }
    }
  } catch {}

  return count;
}

export async function fetchAllVideos() {
  const { rows } = await pool.query('SELECT id FROM subscriptions ORDER BY title');

  fetchProgress.running = true;
  fetchProgress.total = rows.length;
  fetchProgress.done = 0;
  fetchProgress.errors = 0;
  fetchProgress.startedAt = new Date();

  let total = 0;
  const batchSize = 3;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map(r => fetchVideosForChannel(r.id)));
    results.forEach((r, j) => {
      if (r.status === 'fulfilled') { total += r.value; }
      else { console.error(`[yt-dlp] Failed ${batch[j].id}:`, r.reason?.message); fetchProgress.errors++; }
      fetchProgress.done++;
    });
  }

  fetchProgress.running = false;
  return total;
}

export async function addChannelByUrl(url) {
  const isVideo = /watch\?v=|\/shorts\/|\/live\//.test(url);
  const target = isVideo ? url : url.replace(/\/?$/, '/videos');

  const args = [
    '--flat-playlist', '--dump-json', '--no-warnings', '--quiet',
    '--playlist-end', '1',
    ...(await cookieArgs()),
    target,
  ];

  const output = await runYtDlp(args);
  const items = parseJsonLines(output);
  if (!items.length) throw new Error('Could not find channel. Check the URL and try again.');

  const item = items[0];
  const channelId = item.channel_id;
  const title = item.channel || item.uploader;
  if (!channelId) throw new Error('Could not determine channel ID from URL.');

  await pool.query(`
    INSERT INTO subscriptions (id, title, last_synced_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (id) DO UPDATE SET
      title = COALESCE(EXCLUDED.title, subscriptions.title),
      last_synced_at = NOW()
  `, [channelId, title]);

  // Fetch channel thumbnail
  const thumbnail = await fetchChannelThumbnail(channelId);
  if (thumbnail) {
    await pool.query('UPDATE subscriptions SET thumbnail_url = $1 WHERE id = $2', [thumbnail, channelId]);
  }

  return { id: channelId, title, thumbnail_url: thumbnail };
}
