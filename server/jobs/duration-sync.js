const { spawn } = require('child_process');
const { getDb } = require('../db');
const YTDLP     = require('../lib/ytdlp');

// RSS and the --flat-playlist gap-fill both often omit duration (especially
// for Shorts), so this backfills it with a full per-video yt-dlp lookup.
function fetchDuration(ytId) {
  return new Promise((resolve) => {
    const proc = spawn(YTDLP, ['-j', '--no-playlist', '--no-warnings', `https://www.youtube.com/watch?v=${ytId}`], { timeout: 20000 });
    let out = '';
    proc.stdout.on('data', d => { out += d; });
    proc.on('close', () => {
      try {
        const info = JSON.parse(out.trim());
        resolve(info.duration || null);
      } catch {
        resolve(null);
      }
    });
    proc.on('error', () => resolve(null));
  });
}

let running = false;

// duration_checked_at marks a video as attempted regardless of outcome, so a
// video with no resolvable duration (deleted, private, a livestream) isn't
// retried forever — the same infinite-loop trap the channel-meta sync hit.
const PENDING_WHERE = `duration IS NULL AND duration_checked_at IS NULL`;

async function syncDurations(batchSize = 6) {
  if (running) return;
  running = true;

  const db = getDb();
  const videos = db.prepare(`SELECT id, yt_id FROM videos WHERE ${PENDING_WHERE} ORDER BY published_at DESC LIMIT ?`).all(batchSize);

  const CONCURRENCY = 3;
  for (let i = 0; i < videos.length; i += CONCURRENCY) {
    const slice = videos.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      slice.map(v => fetchDuration(v.yt_id).then(duration => ({ v, duration })))
    );
    for (const { v, duration } of results) {
      db.prepare(`UPDATE videos SET duration = COALESCE(?, duration), duration_checked_at = datetime('now') WHERE id = ?`)
        .run(duration, v.id);
    }
  }

  running = false;
  return videos.length;
}

module.exports = { syncDurations };
