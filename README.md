# Pneuma

A self-hosted YouTube subscription reader. No YouTube Data API key required — video metadata is fetched using [yt-dlp](https://github.com/yt-dlp/yt-dlp) running inside the container.

Organise channels into categories, filter out Shorts, track watch progress, play videos in-app, and schedule automatic feed refreshes — all in a clean dark interface.

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite, Tailwind CSS 3, lucide-react |
| Backend | Node.js, Express |
| Database | PostgreSQL 16 |
| Metadata | yt-dlp (Python venv, runs inside the backend container) |
| Containers | Docker Compose, nginx |
| CI | GitHub Actions → GHCR |

---

## Running

**Production — pull pre-built images from GHCR** (only the compose file needed):

```bash
docker compose pull && docker compose up -d
```

**Local development — build from source:**

```bash
git clone https://github.com/SighMonIs/Pneuma.git
cd Pneuma
docker compose -f docker-compose.build.yml up --build
```

Open **http://localhost:5173**.

### Environment variables

Only needed if you change default ports or credentials:

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `postgres` | PostgreSQL hostname |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `pneuma` | Database name |
| `DB_USER` | `pneuma` | Database user |
| `DB_PASSWORD` | `pneuma` | Database password |
| `FRONTEND_URL` | `http://localhost:5173` | Allowed CORS origin |

Cookie data and yt-dlp cache are stored in the `/app/data` volume (`/mnt/data/apps/pneuma/data` on the host by default).

---

## First-time setup

On first run the app shows a setup screen. Pick one of three ways to add channels:

### Option 1 — YouTube cookies (recommended)

Lets you sync your full existing subscription list automatically and access age-restricted or members-only content.

1. Install **Get cookies.txt LOCALLY** ([Chrome](https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc) / [Firefox](https://addons.mozilla.org/en-US/firefox/addon/get-cookies-txt-locally/))
2. Visit **youtube.com** while logged in, click the extension, and export cookies (Netscape format)
3. Paste the cookie text into **Settings → Feeds → Cookie Authentication**
4. Click **↻ Sync** in the sidebar to import all your subscriptions

Cookies are stored in the data volume and persist across restarts. Refresh them when they expire (typically weeks to months).

### Option 2 — Google Takeout CSV

1. Go to [takeout.google.com](https://takeout.google.com) → select **YouTube and YouTube Music → Subscriptions**
2. Download the archive and open `subscriptions.csv`
3. Paste the CSV contents into **Settings → Feeds → Import CSV**

### Option 3 — Add channels manually

Paste any YouTube channel URL or `@handle` into **Settings → Feeds → Add Channel** to subscribe one at a time.

---

## Features

### Feed

- **Video grid or table view** — switch between a card grid and a compact table with thumbnail, title, channel, date, duration, and view count
- **Sort** — by date, title, views, or duration; ascending or descending
- **Search** — filters by video title, description, and channel name in real time
- **Hide Shorts** — global toggle or per-channel setting
- **Hide Watched** — removes already-watched videos from the feed
- **Category filter** — click a category in the sidebar to show only videos from channels in that group
- **Channel filter** — click any channel in the sidebar to narrow the feed to that channel
- **Fetch Videos** — manually trigger a metadata refresh with a live progress bar showing per-channel progress

### Video player

Videos can open on YouTube (default) or in an embedded in-app player (configurable under **Settings → Display**).

In-app player modes:

| Mode | Behaviour |
|------|-----------|
| **Normal** | Player fills the content area up to a comfortable max width |
| **Full** | Player expands to fill the full available height |
| **Float** | Small Picture-in-Picture overlay in the bottom-right corner — keep browsing while the video plays |

- Watch progress is saved to the database every 5 seconds and on pause
- Reopening a video automatically seeks to where you left off
- A thin red progress bar appears on the thumbnail for partially-watched videos
- Videos are automatically marked as watched when playback reaches 95%

### Categories

- Create categories with a custom name, colour, and icon (any Lucide icon name)
- Assign a channel to one or more categories
- Categories appear in the sidebar; clicking the name filters the feed
- Click the chevron to expand/collapse the channel list within a category
- Manage categories under **Settings → Categories** (add, edit, reorder, delete)

### Scheduler

A built-in cron-based job scheduler under the **Scheduler** page. Two built-in actions:

| Action | Description |
|--------|-------------|
| `fetch_videos` | Fetches recent videos for all subscriptions |
| `sync_subscriptions` | Re-syncs the subscription list from YouTube (requires cookies) |

Create jobs with any cron expression. Jobs can be enabled/disabled and triggered manually.

---

## Development

Requirements: Node 20+, PostgreSQL, yt-dlp installed locally.

```bash
# Terminal 1 — database
docker run --rm -p 5432:5432 \
  -e POSTGRES_DB=pneuma -e POSTGRES_USER=pneuma -e POSTGRES_PASSWORD=pneuma \
  postgres:16-alpine

# Terminal 2 — backend (watch mode)
cd backend
npm install
node --watch src/index.js

# Terminal 3 — frontend (hot reload)
npm install
npm run dev
```

The Vite dev server proxies `/api` to `http://localhost:3001`. The database schema is applied automatically on backend startup (`CREATE TABLE IF NOT EXISTS`).

---

## Database schema

| Table | Description |
|-------|-------------|
| `subscriptions` | YouTube channels |
| `categories` | User-defined channel groups |
| `channel_categories` | Many-to-many join between channels and categories |
| `videos` | Fetched video metadata |
| `watched_videos` | Videos marked as watched |
| `video_progress` | Per-video watch position and percentage |
| `scheduled_jobs` | Cron job definitions |
| `oauth_tokens` | Reserved for a future OAuth flow |

---

## Docker images

Built and pushed to GHCR on every push to `main`:

| Image | Description |
|-------|-------------|
| `ghcr.io/sighmonis/pneuma-frontend:latest` | nginx serving the Vite build |
| `ghcr.io/sighmonis/pneuma-backend:latest` | Node.js API + yt-dlp |
