FROM node:24-alpine

# ffmpeg used by yt-dlp for post-processing; python3 runs the yt-dlp zipapp
RUN apk add --no-cache ffmpeg python3

# yt-dlp zipapp — runs directly via python3, no pip install required
RUN wget -q -O /usr/local/bin/yt-dlp \
      https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    && chmod +x /usr/local/bin/yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# /data is mounted as a volume so the SQLite DB persists across container restarts
VOLUME ["/data"]

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/data/pneuma.db

EXPOSE 3000

CMD ["node", "server/index.js"]
