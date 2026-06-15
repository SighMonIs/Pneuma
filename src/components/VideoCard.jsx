import { useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { markWatched, unmarkWatched } from '../services/api.js';

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSeconds < 60) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  if (diffWeeks < 5) return `${diffWeeks} week${diffWeeks === 1 ? '' : 's'} ago`;
  if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;
  return `${diffYears} year${diffYears === 1 ? '' : 's'} ago`;
}

function formatViewCount(count) {
  if (!count) return '0 views';
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M views`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K views`;
  return `${count} views`;
}

export default function VideoCard({ video, onWatchedChange }) {
  const [isWatched, setIsWatched] = useState(video.is_watched);
  const [hovered, setHovered] = useState(false);
  const [toggling, setToggling] = useState(false);

  const handleWatchedToggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (toggling) return;
    setToggling(true);
    try {
      if (isWatched) {
        await unmarkWatched(video.id);
        setIsWatched(false);
      } else {
        await markWatched(video.id);
        setIsWatched(true);
      }
      if (onWatchedChange) onWatchedChange(video.id, !isWatched);
    } catch (err) {
      console.error('Failed to toggle watched:', err);
    } finally {
      setToggling(false);
    }
  };

  const duration = formatDuration(video.duration_seconds);

  return (
    <div
      className="flex flex-col bg-[#242424] rounded-lg overflow-hidden hover:bg-[#2e2e2e] cursor-pointer group transition-colors"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-[#1a1a1a]">
        <a
          href={`https://www.youtube.com/watch?v=${video.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full h-full"
        >
          {video.thumbnail_url ? (
            <img
              src={video.thumbnail_url}
              alt={video.title}
              className={`w-full h-full object-cover transition-opacity ${isWatched ? 'opacity-50' : 'opacity-100'}`}
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
              <span className="text-gray-600 text-sm">No thumbnail</span>
            </div>
          )}

          {/* Watched overlay */}
          {isWatched && (
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
              <div className="bg-black/60 rounded-full p-2">
                <Check size={20} className="text-green-400" />
              </div>
            </div>
          )}

          {/* Duration badge */}
          {duration && (
            <div className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-mono">
              {duration}
            </div>
          )}

          {/* Shorts badge */}
          {video.is_short && (
            <div className="absolute top-1.5 left-1.5 bg-red-600 text-white text-xs px-1.5 py-0.5 rounded font-bold">
              SHORTS
            </div>
          )}
        </a>

        {/* Watch toggle button (shown on hover) */}
        {hovered && (
          <button
            onClick={handleWatchedToggle}
            disabled={toggling}
            className={`absolute top-1.5 right-1.5 p-1.5 rounded-full text-white transition-colors ${
              isWatched
                ? 'bg-green-600 hover:bg-gray-700'
                : 'bg-black/70 hover:bg-green-600'
            }`}
            title={isWatched ? 'Mark as unwatched' : 'Mark as watched'}
          >
            {isWatched ? <RotateCcw size={14} /> : <Check size={14} />}
          </button>
        )}
      </div>

      {/* Card info */}
      <div className="p-3 flex flex-col gap-2">
        {/* Channel info */}
        <div className="flex items-center gap-2">
          {video.channel_thumbnail ? (
            <img
              src={video.channel_thumbnail}
              alt={video.channel_title}
              className="w-6 h-6 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-gray-700 flex-shrink-0 flex items-center justify-center">
              <span className="text-gray-400 text-xs">
                {video.channel_title?.charAt(0) || '?'}
              </span>
            </div>
          )}
          <span className="text-gray-400 text-xs truncate">{video.channel_title}</span>
        </div>

        {/* Title */}
        <a
          href={`https://www.youtube.com/watch?v=${video.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-white text-sm font-medium leading-snug line-clamp-2 hover:text-gray-200"
        >
          {video.title}
        </a>

        {/* Meta */}
        <div className="flex items-center gap-2 text-gray-500 text-xs">
          <span>{formatRelativeTime(video.published_at)}</span>
          <span>·</span>
          <span>{formatViewCount(video.view_count)}</span>
        </div>
      </div>
    </div>
  );
}
