# Pneuma

A self-hosted YouTube subscription reader. No YouTube Data API key required — uses [yt-dlp](https://github.com/yt-dlp/yt-dlp) under the hood.

Organise your subscriptions into categories, filter out Shorts, track watched videos, and schedule automatic feed refreshes — all in a clean RSS-style interface.

## Stack

- **Frontend** — React + Vite + Tailwind CSS + Lucide icons
- **Backend** — Node.js + Express + yt-dlp
- **Database** — PostgreSQL
- **Infra** — Docker Compose + nginx

## Running

```bash
docker compose up --build
```

Then open **http://localhost:5173**.

No environment variables are required. The only optional one is `FRONTEND_URL` if you change the port.

## First-time setup

On first run the app shows a setup screen with three options:

### Option 1 — YouTube Cookies (recommended)
Lets you sync your full subscription list automatically.

1. Install the **Get cookies.txt LOCALLY** extension ([Chrome](https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc) / [Firefox](https://addons.mozilla.org/en-US/firefox/addon/get-cookies-txt-locally/))
2. Visit **youtube.com** while logged in
3. Click the extension → export cookies
4. Paste the contents into the Cookies tab in Pneuma
5. Hit **Sync subscriptions** (↻ in the sidebar) to import your channels

Cookies are stored in a Docker volume and persist across restarts. Refresh them when they expire (typically weeks–months).

### Option 2 — Google Takeout CSV
1. Go to [takeout.google.com](https://takeout.google.com)
2. Select **YouTube and YouTube Music** → **Subscriptions**
3. Export and download the archive
4. Upload or paste `subscriptions.csv` into the Import CSV tab

### Option 3 — Add manually
Paste any YouTube channel URL or `@handle` to add channels one at a time.

## Features

- **Subscription sync** — pulls your full YouTube subscription list via yt-dlp
- **Video feed** — fetches recent videos per channel (up to 20 by default), no API quota
- **Categories** — create categories with a name, colour, and icon (60+ Lucide icons); assign channels to one or more categories
- **Dashboard** — responsive video grid sorted by publish date
  - Search across video titles, descriptions, and channel names
  - Global "Hide Shorts" toggle
  - Global "Hide Watched" toggle
  - Per-channel "Hide Shorts" setting
- **Watched tracking** — mark/unmark videos as watched; data stored locally
- **Job scheduler** — CRUD interface for cron jobs; built-in actions: `sync_subscriptions` and `fetch_videos`
- **Settings page** — manage cookies, add channels, and import CSV at any time

## Development

Requirements: Node 20+, PostgreSQL, yt-dlp installed locally.

```bash
# Terminal 1 — database
docker run --rm -p 5432:5432 \
  -e POSTGRES_DB=pneuma -e POSTGRES_USER=pneuma -e POSTGRES_PASSWORD=pneuma \
  postgres:16-alpine

# Terminal 2 — backend
cd backend
DATA_DIR=./data npm run dev

# Terminal 3 — frontend
npm run dev
```

The Vite dev server proxies `/api` to `http://localhost:3001`.

## Docker images

CI builds and pushes two images to GHCR on every push to `main`:

| Image | Description |
|-------|-------------|
| `ghcr.io/sighmonIs/pneuma-frontend:latest` | nginx serving the Vite build |
| `ghcr.io/sighmonIs/pneuma-backend:latest` | Node.js + yt-dlp API |
