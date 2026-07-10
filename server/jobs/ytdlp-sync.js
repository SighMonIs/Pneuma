const { spawn } = require('child_process');
const { getDb, withTransaction } = require('../db');
const YTDLP = require('../lib/ytdlp');

// Fetches recent video IDs from a channel via yt-dlp and fills any gaps RSS missed
async function syncChannel(channel) {
  if (!channel.yt_channel_id) return 0;

  return new Promise((resolve) => {
    const channelUrl = `https://www.youtube.com/channel/${channel.yt_channel_id}`;
    const args = ['--flat-playlist', '--playlist-items', '1-30', '-j', channelUrl];
    const proc = spawn(YTDLP, args, { timeout: 60000 });

    let out = '';
    proc.stdout.on('data', d => { out += d; });
    proc.on('close', () => {
      const db = getDb();
      const insertVideo = db.prepare(`
        INSERT OR IGNORE INTO videos (channel_id, yt_id, title, thumbnail_url, duration, published_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      const updateDuration = db.prepare(`
        UPDATE videos SET duration = ? WHERE channel_id = ? AND yt_id = ? AND duration IS NULL
      `);

      let added = 0;
      const lines = out.trim().split('\n').filter(Boolean);
      withTransaction(db, () => {
        for (const line of lines) {
          try {
            const item = JSON.parse(line);
            const ytId = item.id;
            if (!ytId) continue;
            const result = insertVideo.run(
              channel.id,
              ytId,
              item.title || 'Untitled',
              item.thumbnail || `https://i.ytimg.com/vi/${ytId}/mqdefault.jpg`,
              item.duration || null,
              item.upload_date
                ? `${item.upload_date.slice(0,4)}-${item.upload_date.slice(4,6)}-${item.upload_date.slice(6,8)}T00:00:00Z`
                : null,
            );
            if (result.changes > 0) added++;
            else if (item.duration) updateDuration.run(item.duration, channel.id, ytId);
          } catch {}
        }
      });
      db.prepare("UPDATE channels SET ytdlp_synced_at = datetime('now') WHERE id = ?").run(channel.id);
      resolve(added);
    });

    proc.on('error', () => resolve(0));
  });
}

async function syncMissingVideos() {
  const db = getDb();
  // Only sync channels that haven't been yt-dlp synced in the last 55 minutes
  const channels = db.prepare(`
    SELECT * FROM channels
    WHERE yt_channel_id IS NOT NULL
    AND (ytdlp_synced_at IS NULL OR ytdlp_synced_at < datetime('now', '-55 minutes'))
  `).all();

  let total = 0;
  for (const ch of channels) {
    total += await syncChannel(ch);
  }
  if (total > 0) console.log(`yt-dlp sync: added ${total} missing videos`);
}

module.exports = { syncMissingVideos, syncChannel };
