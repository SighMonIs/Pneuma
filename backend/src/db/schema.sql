CREATE TABLE IF NOT EXISTS oauth_tokens (
  id SERIAL PRIMARY KEY,
  access_token TEXT,
  refresh_token TEXT,
  token_type VARCHAR(50),
  expiry_date BIGINT,
  scope TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(80) NOT NULL DEFAULT 'Folder',
  color VARCHAR(7) DEFAULT '#6366f1',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id VARCHAR(50) PRIMARY KEY,
  title VARCHAR(200),
  description TEXT,
  thumbnail_url TEXT,
  custom_url VARCHAR(100),
  hide_shorts BOOLEAN DEFAULT FALSE,
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS channel_categories (
  channel_id VARCHAR(50) REFERENCES subscriptions(id) ON DELETE CASCADE,
  category_id INT REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (channel_id, category_id)
);

CREATE TABLE IF NOT EXISTS videos (
  id VARCHAR(50) PRIMARY KEY,
  channel_id VARCHAR(50) REFERENCES subscriptions(id) ON DELETE CASCADE,
  title TEXT,
  description TEXT,
  thumbnail_url TEXT,
  published_at TIMESTAMP,
  duration_seconds INT,
  is_short BOOLEAN DEFAULT FALSE,
  view_count BIGINT DEFAULT 0,
  like_count BIGINT DEFAULT 0,
  fetched_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS watched_videos (
  video_id VARCHAR(50) PRIMARY KEY,
  watched_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  cron_expression VARCHAR(100) NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  last_run_at TIMESTAMP,
  next_run_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS video_progress (
  video_id VARCHAR(50) PRIMARY KEY,
  position_seconds FLOAT NOT NULL DEFAULT 0,
  duration_seconds FLOAT NOT NULL DEFAULT 0,
  percent_watched FLOAT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);
