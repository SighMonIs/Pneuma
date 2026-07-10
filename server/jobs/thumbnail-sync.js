const { spawn }        = require('child_process');
const { EventEmitter } = require('events');
const { getDb }        = require('../db');
const YTDLP            = require('../lib/ytdlp');

const thumbEmitter = new EventEmitter();

// Fetch channel avatar via the channel URL with -J (full playlist JSON).
// The top-level thumbnails array includes both the avatar (/ytc/ CDN path) and the banner (fcrop64).
// We prefer the /ytc/ URL because it's YouTube's specific CDN path for channel avatars exclusively.
function fetchThumbnailFromChannel(ytChannelId) {
  return new Promise((resolve) => {
    const url = ytChannelId.startsWith('@')
      ? `https://www.youtube.com/${ytChannelId}`
      : `https://www.youtube.com/channel/${ytChannelId}`;

    let resolved = false;
    const done = (val) => { if (!resolved) { resolved = true; resolve(val); } };

    const proc = spawn(YTDLP, [
      '--flat-playlist', '--playlist-end', '1',
      '-J', '--no-warnings',
      url,
    ]);

    let out = '';
    let err = '';
    proc.stdout.on('data', d => { out += d.toString(); });
    proc.stderr.on('data', d => { err += d.toString(); });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (err.trim()) console.error(`[thumb] stderr (${ytChannelId}): ${err.trim().slice(0, 400)}`);
      try {
        const info  = JSON.parse(out.trim());
        const thumbs = Array.isArray(info.thumbnails) ? info.thumbnails : [];

        // /ytc/ is YouTube's CDN prefix for channel avatars — never used for banners
        const avatar = thumbs.find(t => t.url?.includes('/ytc/') && t.url.startsWith('http'));
        if (avatar) { done(avatar.url); return; }

        // Fallback: any non-banner thumbnail (banners contain fcrop64)
        const nonBanner = thumbs.find(t => t.url?.startsWith('http') && !t.url.includes('fcrop64'));
        if (nonBanner) { done(nonBanner.url); return; }

        // Last resort: channel_thumbnail field if it isn't a banner
        const ct = info.channel_thumbnail;
        if (ct?.startsWith('http') && !ct.includes('fcrop64')) { done(ct); return; }

        console.warn(`[thumb] No avatar for ${ytChannelId}. Thumbnails: ${thumbs.map(t => t.url?.slice(0, 60)).join(' | ')}`);
        done(null);
      } catch (e) {
        console.error(`[thumb] parse fail (${ytChannelId}) exit=${code}: ${e.message}. out=${out.slice(0, 200)}`);
        done(null);
      }
    });
    proc.on('error', (e) => { console.error(`[thumb] spawn error: ${e.message}`); done(null); });
    const timer = setTimeout(() => { try { proc.kill(); } catch {} done(null); }, 30_000);
  });
}

let running = false;

async function syncThumbnails(batchSize = 3) {
  if (running) return;
  running = true;

  const db = getDb();

  const remaining = db.prepare(`
    SELECT COUNT(*) as c FROM channels
    WHERE thumbnail_url IS NULL AND yt_channel_id IS NOT NULL
  `).get().c;

  const channels = db.prepare(`
    SELECT id, yt_channel_id, name FROM channels
    WHERE  thumbnail_url IS NULL AND yt_channel_id IS NOT NULL
    LIMIT  ?
  `).all(batchSize);

  if (channels.length > 0) {
    thumbEmitter.emit('data', { type: 'start', remaining });
  }

  // Fetch 3 at a time in parallel to avoid serial yt-dlp bottleneck
  const CONCURRENCY = 3;
  for (let i = 0; i < channels.length; i += CONCURRENCY) {
    const slice = channels.slice(i, i + CONCURRENCY);
    slice.forEach(ch => console.log(`[thumb] Fetching: ${ch.name}`));
    const results = await Promise.all(
      slice.map(ch => fetchThumbnailFromChannel(ch.yt_channel_id).then(url => ({ ch, url })))
    );
    for (const { ch, url } of results) {
      if (url) {
        db.prepare('UPDATE channels SET thumbnail_url = ? WHERE id = ?').run(url, ch.id);
        console.log(`[thumb] Stored: ${ch.name}`);
        thumbEmitter.emit('data', { type: 'fetched', channel_id: ch.id, url });
      } else {
        console.warn(`[thumb] Failed: ${ch.name}`);
      }
    }
  }

  const newRemaining = db.prepare(`
    SELECT COUNT(*) as c FROM channels
    WHERE thumbnail_url IS NULL AND yt_channel_id IS NOT NULL
  `).get().c;

  if (channels.length > 0) {
    thumbEmitter.emit('data', { type: 'done', remaining: newRemaining });
  }

  running = false;
  return channels.length;
}

module.exports = { syncThumbnails, thumbEmitter };
