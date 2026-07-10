const Parser = require('rss-parser');
const { EventEmitter } = require('events');
const { getDb, withTransaction } = require('../db');

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; Feedfetcher-Google; +http://www.google.com/feedfetcher.html)',
  },
  customFields: {
    item: [
      ['yt:videoId', 'ytVideoId'],
      ['media:group', 'mediaGroup'],
    ],
  },
});

// Emits: 'start' {total}, 'progress' {done, total, channelName}, 'complete' {added, total, errors}
const pollEvents = new EventEmitter();
pollEvents.setMaxListeners(50);

let pollState = { running: false, done: 0, total: 0, errors: [] };

function getPollState() { return { ...pollState, errors: [...(pollState.errors || [])] }; }

function thumbnailFromId(ytId) {
  return `https://i.ytimg.com/vi/${ytId}/mqdefault.jpg`;
}

function parseDuration(str) {
  if (!str) return null;
  // YouTube RSS gives plain seconds as an integer string
  if (/^\d+$/.test(String(str))) return parseInt(str, 10);
  // Fallback: ISO 8601 (PT1H5M30S)
  const m = String(str).match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return null;
  return (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0);
}

// Returns { added, error } — error is null on success
async function pollChannel(channel) {
  if (!channel.rss_url) return { added: 0, error: null };
  const db = getDb();

  let feed;
  try {
    feed = await parser.parseURL(channel.rss_url);
  } catch (e) {
    console.warn(`RSS fetch failed for ${channel.name}: ${e.message}`);
    return { added: 0, error: e.message };
  }

  const insertVideo = db.prepare(`
    INSERT OR IGNORE INTO videos (channel_id, yt_id, title, thumbnail_url, duration, published_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  let added = 0;
  withTransaction(db, () => {
    for (const item of feed.items || []) {
      const ytId = item.ytVideoId || (item.link?.match(/v=([A-Za-z0-9_-]+)/)?.[1]);
      if (!ytId) continue;

      const duration = parseDuration(
        item.mediaGroup?.['media:content']?.[0]?.['$']?.duration
      );

      const result = insertVideo.run(
        channel.id,
        ytId,
        item.title || 'Untitled',
        thumbnailFromId(ytId),
        duration,
        item.isoDate || item.pubDate || null,
      );
      if (result.changes > 0) added++;
    }
  });

  db.prepare("UPDATE channels SET last_fetched_at = datetime('now') WHERE id = ?").run(channel.id);
  return { added, error: null };
}

async function pollAllFeeds() {
  if (pollState.running) return;

  const db = getDb();
  const channels = db.prepare('SELECT * FROM channels WHERE rss_url IS NOT NULL').all();
  const total = channels.length;

  pollState = { running: true, done: 0, total, errors: [] };
  pollEvents.emit('start', { total });

  let totalAdded = 0;
  const errors = [];

  for (const ch of channels) {
    const { added, error } = await pollChannel(ch);
    totalAdded += added;
    if (error) errors.push({ id: ch.id, name: ch.name, rss_url: ch.rss_url, error });
    pollState.done++;
    pollState.errors = errors;
    pollEvents.emit('progress', { done: pollState.done, total, channelName: ch.name });
    await new Promise(r => setTimeout(r, 150));
  }

  pollState = { running: false, done: total, total, errors };
  pollEvents.emit('complete', { added: totalAdded, total, errors });

  if (totalAdded > 0) console.log(`RSS poll: added ${totalAdded} new videos`);
  if (errors.length > 0) console.log(`RSS poll: ${errors.length} channel(s) failed`);
}

module.exports = { pollAllFeeds, pollChannel, pollEvents, getPollState };
