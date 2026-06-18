import { pool } from '../db/index.js';

const feedUrl = (channelId) =>
  `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

async function fetchFeedXml(channelId) {
  const resp = await fetch(feedUrl(channelId), {
    signal: AbortSignal.timeout(15000),
    headers: { Accept: 'application/xml, text/xml, */*' },
  });
  if (!resp.ok) throw new Error(`RSS fetch returned HTTP ${resp.status}`);
  return resp.text();
}

function extractText(xml, tag) {
  const re = new RegExp(
    `<${tag}(?:\\s[^>]*)?>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tag}>`,
    'i',
  );
  const m = re.exec(xml);
  if (!m) return null;
  return (m[1] ?? m[2] ?? '')
    .trim()
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function extractAttr(xml, tag, attr) {
  const re = new RegExp(`<${tag}\\s[^>]*${attr}="([^"]*)"`, 'i');
  const m = re.exec(xml);
  return m ? m[1] : null;
}

function parseEntries(xml) {
  const entries = [];
  const re = /<entry>([\s\S]*?)<\/entry>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const e = m[1];
    const videoId = extractText(e, 'yt:videoId');
    if (!videoId) continue;

    const title = extractText(e, 'media:title') || extractText(e, 'title') || '';
    const published = extractText(e, 'published');
    const description = extractText(e, 'media:description') || '';
    const views = extractAttr(e, 'media:statistics', 'views');
    const thumbnail =
      extractAttr(e, 'media:thumbnail', 'url') ||
      `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;

    entries.push({
      id: videoId,
      title,
      description,
      thumbnail_url: thumbnail,
      published_at: published ? new Date(published) : null,
      view_count: views ? parseInt(views, 10) : 0,
    });
  }
  return entries;
}

function isShortByTitle(title) {
  return (title || '').toLowerCase().includes('#shorts');
}

// Returns { count, gapDetected }
// gapDetected is true when the oldest RSS item is newer than lastFetchedAt by > 2 days,
// meaning videos likely fell off the feed before we could see them.
export async function fetchVideosForChannelViaRss(channelId, { lastFetchedAt = null } = {}) {
  const xml = await fetchFeedXml(channelId);
  const videos = parseEntries(xml);

  if (videos.length === 0) {
    await pool.query(
      'UPDATE subscriptions SET last_fetch_error = NULL, last_fetched_at = NOW() WHERE id = $1',
      [channelId],
    );
    return { count: 0, gapDetected: false };
  }

  let gapDetected = false;
  if (lastFetchedAt) {
    const dates = videos.map(v => v.published_at).filter(Boolean);
    if (dates.length > 0) {
      const oldest = new Date(Math.min(...dates.map(d => d.getTime())));
      const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
      if (oldest - new Date(lastFetchedAt) > TWO_DAYS) {
        gapDetected = true;
      }
    }
  }

  let count = 0;
  for (const video of videos) {
    await pool.query(
      `INSERT INTO videos
         (id, channel_id, title, description, thumbnail_url, published_at,
          duration_seconds, is_short, view_count, like_count, fetched_at)
       VALUES ($1,$2,$3,$4,$5,$6,0,$7,$8,0,NOW())
       ON CONFLICT (id) DO UPDATE SET
         title         = EXCLUDED.title,
         thumbnail_url = EXCLUDED.thumbnail_url,
         published_at  = COALESCE(EXCLUDED.published_at, videos.published_at),
         view_count    = EXCLUDED.view_count,
         fetched_at    = NOW()`,
      [
        video.id, channelId, video.title, video.description,
        video.thumbnail_url, video.published_at,
        isShortByTitle(video.title), video.view_count,
      ],
    );
    count++;
  }

  await pool.query(
    'UPDATE subscriptions SET last_fetch_error = NULL, last_fetched_at = NOW() WHERE id = $1',
    [channelId],
  );
  return { count, gapDetected };
}
