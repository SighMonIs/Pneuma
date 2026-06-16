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
  errorList: [],
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

export async function syncSubscriptions({ fetchSinceMode = 'default', fetchSinceDate = null } = {}) {
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
      INSERT INTO subscriptions (id, title, thumbnail_url, fetch_since_mode, fetch_since_date, last_synced_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        thumbnail_url = COALESCE(EXCLUDED.thumbnail_url, subscriptions.thumbnail_url),
        last_synced_at = NOW()
    `, [id, title, thumbnail, fetchSinceMode, fetchSinceDate]);
    count++;
  }
  return count;
}

function formatYtdlpDate(d) {
  const date = d instanceof Date ? d : new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

export function resolveDateAfter(sub, globalMode, globalDate) {
  const mode = sub.fetch_since_mode === 'default' ? globalMode : sub.fetch_since_mode;
  if (mode === 'beginning') return null;
  if (mode === 'added') return formatYtdlpDate(sub.created_at);
  if (mode === 'date') {
    const d = (sub.fetch_since_mode !== 'default' && sub.fetch_since_date) ? sub.fetch_since_date : globalDate;
    return d ? formatYtdlpDate(d) : null;
  }
  return null;
}

export async function fetchChannelInfo(channelId) {
  const args = [
    '-J', '--flat-playlist', '--playlist-end', '0',
    '--no-warnings', '--quiet',
    ...(await cookieArgs()),
    `https://www.youtube.com/channel/${channelId}`,
  ];
  const output = await runYtDlp(args);
  const data = JSON.parse(output.trim());

  // Thumbnails: banner has very wide aspect ratio (width/height > 4) or has 'banner' in its id
  const bannerThumb = data.thumbnails?.find(t =>
    (t.id && t.id.includes('banner')) || (t.width && t.height && t.width / t.height > 4)
  );
  const avatarThumb = bestThumbnail(data.thumbnails?.filter(t => !(t.id && t.id.includes('banner'))));

  const banner = bannerThumb?.url ?? null;
  const avatar = avatarThumb ?? null;
  const about = data.description ?? null;
  const subscriberCount = data.channel_follower_count ?? null;
  const customUrl = data.uploader_id ? `@${data.uploader_id}` : null;

  await pool.query(`
    UPDATE subscriptions SET
      description = COALESCE($1, description),
      thumbnail_url = COALESCE($2, thumbnail_url),
      banner_url = COALESCE($3, banner_url),
      subscriber_count = COALESCE($4, subscriber_count),
      custom_url = COALESCE($5, custom_url)
    WHERE id = $6
  `, [about, avatar, banner, subscriberCount, customUrl, channelId]);

  return { description: about, thumbnail_url: avatar, banner_url: banner, subscriber_count: subscriberCount, custom_url: customUrl };
}

export async function fetchVideosForChannel(channelId, { dateAfter = null } = {}) {
  const dateArgs = dateAfter
    ? ['--dateafter', dateAfter, '--break-on-reject']
    : ['--playlist-end', '500'];

  const args = [
    '--flat-playlist', '--dump-json', '--no-warnings', '--quiet',
    ...dateArgs,
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
  const { rows: subs } = await pool.query(
    'SELECT id, fetch_since_mode, fetch_since_date, created_at FROM subscriptions ORDER BY title',
  );

  const { rows: settingRows } = await pool.query('SELECT key, value FROM app_settings');
  const globalSettings = {};
  settingRows.forEach(r => (globalSettings[r.key] = r.value));
  const globalMode = globalSettings.fetch_since_mode || 'added';
  const globalDate = globalSettings.fetch_since_date || null;

  fetchProgress.running = true;
  fetchProgress.total = subs.length;
  fetchProgress.done = 0;
  fetchProgress.errors = 0;
  fetchProgress.errorList = [];
  fetchProgress.startedAt = new Date();

  let total = 0;
  const batchSize = 3;

  for (let i = 0; i < subs.length; i += batchSize) {
    const batch = subs.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(sub => fetchVideosForChannel(sub.id, { dateAfter: resolveDateAfter(sub, globalMode, globalDate) })),
    );
    results.forEach((r, j) => {
      if (r.status === 'fulfilled') { total += r.value; }
      else {
        const sub = batch[j];
        const msg = r.reason?.message || 'Unknown error';
        console.error(`[yt-dlp] Failed ${sub.id}:`, msg);
        fetchProgress.errors++;
        fetchProgress.errorList.push({ channelId: sub.id, channelTitle: sub.title || sub.id, message: msg });
      }
      fetchProgress.done++;
    });
  }

  fetchProgress.running = false;
  return total;
}

export async function addChannelByUrl(url, { fetchSinceMode = 'default', fetchSinceDate = null } = {}) {
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
    INSERT INTO subscriptions (id, title, fetch_since_mode, fetch_since_date, last_synced_at)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (id) DO UPDATE SET
      title = COALESCE(EXCLUDED.title, subscriptions.title),
      last_synced_at = NOW()
  `, [channelId, title, fetchSinceMode, fetchSinceDate]);

  // Fetch channel thumbnail
  const thumbnail = await fetchChannelThumbnail(channelId);
  if (thumbnail) {
    await pool.query('UPDATE subscriptions SET thumbnail_url = $1 WHERE id = $2', [thumbnail, channelId]);
  }

  return { id: channelId, title, thumbnail_url: thumbnail };
}
