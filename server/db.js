const { DatabaseSync } = require('node:sqlite');
const { randomUUID } = require('crypto');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'pneuma.db');

let db;

function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    migrate(db);
  }
  return db;
}

// Simple transaction helper (node:sqlite has no built-in wrapper)
function withTransaction(db, fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      position      INTEGER DEFAULT 0,
      collapsed     INTEGER DEFAULT 0,
      settings_json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS channels (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      yt_channel_id  TEXT UNIQUE,
      name           TEXT NOT NULL,
      rss_url        TEXT,
      thumbnail_url  TEXT,
      category_id    INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      settings_json  TEXT NOT NULL DEFAULT '{}',
      last_fetched_at TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS videos (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id    INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      yt_id         TEXT UNIQUE NOT NULL,
      title         TEXT NOT NULL,
      thumbnail_url TEXT,
      duration      INTEGER,
      published_at  TEXT,
      watched_at    TEXT,
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_videos_channel   ON videos(channel_id);
    CREATE INDEX IF NOT EXISTS idx_videos_published ON videos(published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_channels_category ON channels(category_id);
  `);

  // Migrations for columns added after initial release
  try { db.exec('ALTER TABLE videos ADD COLUMN watch_progress_secs INTEGER'); } catch (_) {}
  try { db.exec('ALTER TABLE channels ADD COLUMN ytdlp_synced_at TEXT'); } catch (_) {}

  seedSettings(db);
}

function seedSettings(db) {
  const defaults = {
    api_token:         randomUUID(),
    playback_mode:     'embed',
    poll_interval:     '3600',
    search_youtube:    'true',
    show_shorts:       'true',
    auto_mark_watched: 'false',
    default_view:      'grid',
    default_filter:    'all',
    default_sort:      'newest',
  };

  const insert = db.prepare(
    'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
  );
  for (const [key, value] of Object.entries(defaults)) {
    insert.run(key, value);
  }
}

module.exports = { getDb, withTransaction };
