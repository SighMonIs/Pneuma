const { spawn }        = require('child_process');
const { EventEmitter } = require('events');
const { getDb }        = require('../db');
const YTDLP            = require('../lib/ytdlp');

const thumbEmitter = new EventEmitter();

// Fetch channel avatar + banner + about-page metadata via the channel URL with -J (full playlist JSON).
// The top-level thumbnails array includes both the avatar (/ytc/ CDN path) and the banner (fcrop64).
// We prefer the /ytc/ URL because it's YouTube's specific CDN path for channel avatars exclusively.
function fetchChannelMeta(ytChannelId) {
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
        const avatar    = thumbs.find(t => t.url?.includes('/ytc/') && t.url.startsWith('http'));
        const nonBanner = thumbs.find(t => t.url?.startsWith('http') && !t.url.includes('fcrop64'));
        const ct        = info.channel_thumbnail;

        const avatarUrl = avatar?.url
          || nonBanner?.url
          || (ct?.startsWith('http') && !ct.includes('fcrop64') ? ct : null);

        // Banners are the fcrop64-cropped thumbnails; not every channel has one
        const banner = thumbs.find(t => t.url?.startsWith('http') && t.url.includes('fcrop64'));

        if (!avatarUrl) console.warn(`[thumb] No avatar for ${ytChannelId}. Thumbnails: ${thumbs.map(t => t.url?.slice(0, 60)).join(' | ')}`);

        done({
          avatar:          avatarUrl,
          banner:          banner?.url || null,
          description:     info.description || null,
          subscriberCount: info.channel_follower_count ?? null,
          handle:          info.uploader_id?.startsWith('@') ? info.uploader_id : null,
        });
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

// Channels not yet processed for avatar/banner/description/subscriber metadata.
// Keyed off meta_synced_at rather than the data columns themselves — banner_url,
// description etc. can legitimately be null for a channel that has none, and
// re-checking those columns would re-fetch that channel forever.
const PENDING_WHERE = `yt_channel_id IS NOT NULL AND meta_synced_at IS NULL`;

async function syncThumbnails(batchSize = 3) {
  if (running) return;
  running = true;

  const db = getDb();

  const remaining = db.prepare(`SELECT COUNT(*) as c FROM channels WHERE ${PENDING_WHERE}`).get().c;

  const channels = db.prepare(`
    SELECT id, yt_channel_id, name FROM channels
    WHERE  ${PENDING_WHERE}
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
      slice.map(ch => fetchChannelMeta(ch.yt_channel_id).then(meta => ({ ch, meta })))
    );
    for (const { ch, meta } of results) {
      if (meta) {
        db.prepare(`
          UPDATE channels SET
            thumbnail_url    = COALESCE(?, thumbnail_url),
            banner_url       = ?,
            description      = ?,
            subscriber_count = ?,
            handle           = ?,
            meta_synced_at   = datetime('now')
          WHERE id = ?
        `).run(meta.avatar, meta.banner, meta.description, meta.subscriberCount, meta.handle, ch.id);
        console.log(`[thumb] Stored: ${ch.name}`);
        thumbEmitter.emit('data', { type: 'fetched', channel_id: ch.id, url: meta.avatar });
      } else {
        db.prepare(`UPDATE channels SET meta_synced_at = datetime('now') WHERE id = ?`).run(ch.id);
        console.warn(`[thumb] Failed: ${ch.name}`);
      }
    }
  }

  const newRemaining = db.prepare(`SELECT COUNT(*) as c FROM channels WHERE ${PENDING_WHERE}`).get().c;

  if (channels.length > 0) {
    thumbEmitter.emit('data', { type: 'done', remaining: newRemaining });
  }

  running = false;
  return channels.length;
}

module.exports = { syncThumbnails, thumbEmitter };
