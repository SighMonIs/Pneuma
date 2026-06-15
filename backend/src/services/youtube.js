import { google } from 'googleapis';
import { pool } from '../db/index.js';

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3001/api/auth/callback'
  );
}

export function getAuthUrl() {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/youtube.readonly'],
    prompt: 'consent',
  });
}

export async function exchangeCode(code) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  // Delete old tokens and save new ones
  await pool.query('DELETE FROM oauth_tokens');
  await pool.query(
    `INSERT INTO oauth_tokens (access_token, refresh_token, token_type, expiry_date, scope, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [
      tokens.access_token,
      tokens.refresh_token,
      tokens.token_type,
      tokens.expiry_date,
      tokens.scope,
    ]
  );

  return tokens;
}

export async function getAuthStatus() {
  const result = await pool.query('SELECT id FROM oauth_tokens LIMIT 1');
  return result.rows.length > 0;
}

export async function getYouTubeClient() {
  const result = await pool.query('SELECT * FROM oauth_tokens LIMIT 1');
  if (result.rows.length === 0) {
    throw new Error('Not authenticated');
  }

  const tokenRow = result.rows[0];
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: tokenRow.access_token,
    refresh_token: tokenRow.refresh_token,
    token_type: tokenRow.token_type,
    expiry_date: tokenRow.expiry_date,
    scope: tokenRow.scope,
  });

  // Listen for token refresh events and persist to DB
  oauth2Client.on('tokens', async (newTokens) => {
    console.log('[YouTube] Tokens refreshed, saving to DB');
    try {
      await pool.query(
        `UPDATE oauth_tokens SET
          access_token = COALESCE($1, access_token),
          refresh_token = COALESCE($2, refresh_token),
          expiry_date = COALESCE($3, expiry_date),
          updated_at = NOW()
         WHERE id = $4`,
        [newTokens.access_token, newTokens.refresh_token, newTokens.expiry_date, tokenRow.id]
      );
    } catch (err) {
      console.error('[YouTube] Failed to update refreshed tokens:', err.message);
    }
  });

  return google.youtube({ version: 'v3', auth: oauth2Client });
}

export async function syncSubscriptions() {
  const youtube = await getYouTubeClient();
  let pageToken = undefined;
  let totalSynced = 0;

  do {
    const response = await youtube.subscriptions.list({
      part: ['snippet'],
      mine: true,
      maxResults: 50,
      pageToken,
    });

    const items = response.data.items || [];

    for (const item of items) {
      const channelId = item.snippet.resourceId.channelId;
      const title = item.snippet.title;
      const description = item.snippet.description;
      const thumbnail =
        item.snippet.thumbnails?.default?.url ||
        item.snippet.thumbnails?.medium?.url ||
        null;

      await pool.query(
        `INSERT INTO subscriptions (id, title, description, thumbnail_url, last_synced_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           thumbnail_url = EXCLUDED.thumbnail_url,
           last_synced_at = NOW()`,
        [channelId, title, description, thumbnail]
      );
      totalSynced++;
    }

    pageToken = response.data.nextPageToken;
  } while (pageToken);

  console.log(`[YouTube] Synced ${totalSynced} subscriptions`);
  return totalSynced;
}

export function parseDuration(isoDuration) {
  if (!isoDuration) return 0;
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');
  return hours * 3600 + minutes * 60 + seconds;
}

function detectShort(title, description, durationSeconds) {
  // Shorts detection: <= 60s and not a premiere, or #shorts in title/description
  const lowerTitle = (title || '').toLowerCase();
  const lowerDesc = (description || '').toLowerCase();

  if (lowerTitle.includes('#shorts') || lowerDesc.includes('#shorts')) {
    return true;
  }

  if (
    durationSeconds <= 60 &&
    durationSeconds > 0 &&
    !lowerTitle.includes('premiere')
  ) {
    return true;
  }

  return false;
}

export async function fetchVideosForChannel(channelId, maxResults = 20) {
  const youtube = await getYouTubeClient();

  // Get uploads playlist ID
  const channelResponse = await youtube.channels.list({
    part: ['contentDetails'],
    id: [channelId],
  });

  const channel = channelResponse.data.items?.[0];
  if (!channel) {
    throw new Error(`Channel ${channelId} not found`);
  }

  const uploadsPlaylistId = channel.contentDetails.relatedPlaylists.uploads;

  // Get recent video IDs from uploads playlist
  const playlistResponse = await youtube.playlistItems.list({
    part: ['snippet', 'contentDetails'],
    playlistId: uploadsPlaylistId,
    maxResults,
  });

  const videoIds = (playlistResponse.data.items || [])
    .map(item => item.contentDetails.videoId)
    .filter(Boolean);

  if (videoIds.length === 0) return 0;

  // Get detailed video info
  const videosResponse = await youtube.videos.list({
    part: ['snippet', 'contentDetails', 'statistics'],
    id: videoIds,
  });

  const videos = videosResponse.data.items || [];
  let count = 0;

  for (const video of videos) {
    const durationSeconds = parseDuration(video.contentDetails?.duration);
    const title = video.snippet?.title || '';
    const description = video.snippet?.description || '';
    const isShort = detectShort(title, description, durationSeconds);
    const thumbnail =
      video.snippet?.thumbnails?.medium?.url ||
      video.snippet?.thumbnails?.default?.url ||
      null;
    const publishedAt = video.snippet?.publishedAt || null;
    const viewCount = parseInt(video.statistics?.viewCount || '0');
    const likeCount = parseInt(video.statistics?.likeCount || '0');

    await pool.query(
      `INSERT INTO videos (id, channel_id, title, description, thumbnail_url, published_at, duration_seconds, is_short, view_count, like_count, fetched_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       ON CONFLICT (id) DO UPDATE SET
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         thumbnail_url = EXCLUDED.thumbnail_url,
         published_at = EXCLUDED.published_at,
         duration_seconds = EXCLUDED.duration_seconds,
         is_short = EXCLUDED.is_short,
         view_count = EXCLUDED.view_count,
         like_count = EXCLUDED.like_count,
         fetched_at = NOW()`,
      [video.id, channelId, title, description, thumbnail, publishedAt, durationSeconds, isShort, viewCount, likeCount]
    );
    count++;
  }

  return count;
}

export async function fetchAllVideos() {
  const result = await pool.query('SELECT id FROM subscriptions ORDER BY title');
  const channels = result.rows;
  let totalFetched = 0;
  const batchSize = 5;

  for (let i = 0; i < channels.length; i += batchSize) {
    const batch = channels.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(ch => fetchVideosForChannel(ch.id))
    );

    for (let j = 0; j < results.length; j++) {
      const res = results[j];
      if (res.status === 'fulfilled') {
        totalFetched += res.value;
      } else {
        console.error(`[YouTube] Failed to fetch videos for channel ${batch[j].id}:`, res.reason?.message);
      }
    }
  }

  console.log(`[YouTube] Fetched ${totalFetched} videos total`);
  return totalFetched;
}
