// Resolves the yt-dlp executable path.
// On Docker/Linux it will be on PATH as 'yt-dlp'.
// On Windows dev machines set YTDLP_PATH in .env to the full path.
module.exports = process.env.YTDLP_PATH || 'yt-dlp';
