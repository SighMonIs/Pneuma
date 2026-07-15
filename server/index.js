require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');

const { getDb } = require('./db');
const { pollAllFeeds } = require('./jobs/rss-poller');
const { syncMissingVideos } = require('./jobs/ytdlp-sync');
const { syncThumbnails } = require('./jobs/thumbnail-sync');
const { syncDurations } = require('./jobs/duration-sync');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'client')));

app.use('/api/categories', require('./routes/categories'));
app.use('/api/channels',   require('./routes/channels'));
app.use('/api/videos',     require('./routes/videos'));
app.use('/api/search',     require('./routes/search'));
app.use('/api/settings',   require('./routes/settings'));
app.use('/api/shortcut',   require('./routes/shortcut'));

// Catch-all: serve the SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  getDb();
  console.log(`Pneuma running at http://localhost:${PORT}`);
  scheduleJobs();
  // Poll feeds immediately on startup so videos appear without waiting for the first cron tick
  setTimeout(async () => {
    console.log('Running initial RSS poll…');
    try { await pollAllFeeds(); console.log('Initial RSS poll complete.'); }
    catch (e) { console.error('Initial RSS poll error:', e.message); }
  }, 1000);
});

function scheduleJobs() {
  const db = getDb();
  const intervalSec = parseInt(db.prepare("SELECT value FROM settings WHERE key='poll_interval'").get()?.value || '3600', 10);
  const intervalMin = Math.max(1, Math.round(intervalSec / 60));

  cron.schedule(`*/${intervalMin} * * * *`, async () => {
    try { await pollAllFeeds(); } catch (e) { console.error('RSS poll error:', e.message); }
  });

  // yt-dlp gap-fill: daily at 4am (catches videos RSS's 15-item window missed; heavy, so not hourly)
  cron.schedule('0 4 * * *', async () => {
    try { await syncMissingVideos(); } catch (e) { console.error('yt-dlp sync error:', e.message); }
  });

  // Thumbnail sync: runs every 15 s, batch of 6 (running flag prevents overlap)
  setInterval(async () => {
    try { await syncThumbnails(6); } catch (e) { console.error('Thumbnail sync error:', e.message); }
  }, 15_000);

  // Duration backfill: runs every 15 s, batch of 6 (running flag prevents overlap)
  setInterval(async () => {
    try { await syncDurations(6); } catch (e) { console.error('Duration sync error:', e.message); }
  }, 15_000);
}
