import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ExternalLink, RefreshCw, Check, Eye, EyeOff, Scissors,
  ChevronDown, ChevronRight, Settings, Trash2, Star, LayoutGrid, List,
  ArrowDown, ArrowUp, AlertTriangle, X, AlertCircle, RotateCcw, PlaySquare,
} from 'lucide-react';
import {
  getChannel, getVideos, fetchChannel, refreshChannelInfo,
  markAllWatched, deleteSubscription, updateSubscription,
  markWatched, unmarkWatched, saveProgress,
} from '../services/api.js';
import VideoCard from './VideoCard.jsx';

function formatSubscriberCount(n) {
  if (!n) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M subscribers`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K subscribers`;
  return `${n} subscribers`;
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const diffDays = Math.floor((Date.now() - new Date(dateString)) / 86400000);
  if (diffDays < 1) return 'today';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

function formatViewCount(count) {
  if (!count || count <= 0) return '';
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return `${count}`;
}

function loadBool(key) {
  try { return localStorage.getItem(key) === 'true'; } catch { return false; }
}
function saveBool(key, val) {
  try { localStorage.setItem(key, String(val)); } catch {}
}
function loadStr(key, def) {
  try { return localStorage.getItem(key) || def; } catch { return def; }
}
function saveStr(key, val) {
  try { localStorage.setItem(key, val); } catch {}
}

function VideoTableRow({ video, onWatchedChange, videoMode, onVideoSelect, thumbnailQuality }) {
  const [isWatched, setIsWatched] = useState(video.is_watched);
  const [toggling, setToggling] = useState(false);

  const handleWatchedToggle = async (e) => {
    e.preventDefault(); e.stopPropagation();
    if (toggling) return;
    setToggling(true);
    try {
      if (isWatched) { await unmarkWatched(video.id); setIsWatched(false); }
      else { await markWatched(video.id); setIsWatched(true); }
      onWatchedChange?.(video.id, !isWatched);
    } catch {}
    finally { setToggling(false); }
  };

  const handleClick = (e) => {
    if (videoMode === 'embed') {
      e.preventDefault();
      if (onVideoSelect) onVideoSelect(video);
      else window.open(`https://www.youtube.com/watch?v=${video.id}`, '_blank', 'noopener,noreferrer');
    }
  };

  const thumbnailUrl = `https://i.ytimg.com/vi/${video.id}/${thumbnailQuality}.jpg`;
  const ytUrl = `https://www.youtube.com/watch?v=${video.id}`;

  return (
    <tr className={`border-b border-gray-800/50 hover:bg-[#1a1a1a] transition-colors group ${isWatched ? 'opacity-50' : ''}`}>
      <td className="py-2 px-3">
        <a href={ytUrl} onClick={handleClick} className="block" target="_blank" rel="noopener noreferrer">
          <div className="relative w-20 rounded overflow-hidden bg-gray-800" style={{ aspectRatio: '16/9' }}>
            <img src={thumbnailUrl} alt={video.title} className="w-full h-full object-cover" loading="lazy" decoding="async" />
            {!isWatched && (video.percent_watched || 0) > 0.01 && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/40">
                <div className="h-full bg-red-500" style={{ width: `${Math.min((video.percent_watched || 0) * 100, 100)}%` }} />
              </div>
            )}
          </div>
        </a>
      </td>
      <td className="py-2 px-3 max-w-[320px]">
        <a href={ytUrl} onClick={handleClick} className="text-white text-sm line-clamp-2 hover:text-gray-200 leading-snug" target="_blank" rel="noopener noreferrer">
          {video.title}
        </a>
      </td>
      <td className="py-2 px-3 text-gray-500 text-xs whitespace-nowrap">{formatRelativeTime(video.published_at)}</td>
      <td className="py-2 px-3 text-gray-500 text-xs font-mono whitespace-nowrap">{formatDuration(video.duration_seconds) || '—'}</td>
      <td className="py-2 px-3 text-gray-500 text-xs whitespace-nowrap">{formatViewCount(video.view_count) || '—'}</td>
      <td className="py-2 px-3 text-right">
        <button
          onClick={handleWatchedToggle}
          disabled={toggling}
          className={`p-1.5 rounded-full transition-colors ${isWatched ? 'text-green-400 hover:text-gray-400' : 'text-gray-700 group-hover:text-gray-500 hover:text-green-400'}`}
          aria-label={isWatched ? 'Mark unwatched' : 'Mark watched'}
          title={isWatched ? 'Mark unwatched' : 'Mark watched'}
        >
          {isWatched ? <RotateCcw size={13} /> : <Check size={13} />}
        </button>
      </td>
    </tr>
  );
}

const SORT_OPTIONS = [
  { value: 'published_at', label: 'Date' },
  { value: 'title', label: 'Title' },
  { value: 'view_count', label: 'Views' },
  { value: 'duration_seconds', label: 'Duration' },
];

export default function ChannelPage({ subscriptions, categories, onDataChange }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const [channel, setChannel] = useState(null);
  const [channelLoading, setChannelLoading] = useState(true);
  const [refreshingInfo, setRefreshingInfo] = useState(false);

  const [videos, setVideos] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [videosLoading, setVideosLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [fetching, setFetching] = useState(false);
  const [fetchDone, setFetchDone] = useState(false);
  const [fetchError, setFetchError] = useState('');

  const [markingAll, setMarkingAll] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  // Per-channel display prefs stored locally — initialise from channel after load
  const [showBanner, setShowBannerState] = useState(true);
  const [showAboutSection, setShowAboutSection] = useState(false);
  const [isFavourite, setIsFavourite] = useState(false);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [hideShorts, setHideShortsRaw] = useState(() => loadBool('pneuma_hide_shorts'));
  const [hideWatched, setHideWatchedRaw] = useState(() => loadBool('pneuma_hide_watched'));
  const [sortBy, setSortByRaw] = useState(() => loadStr('pneuma_sort_by', 'published_at'));
  const [sortOrder, setSortOrderRaw] = useState(() => loadStr('pneuma_sort_order', 'desc'));
  const [viewMode, setViewModeRaw] = useState(() => loadStr('pneuma_view_mode', 'grid'));

  const videoMode = loadStr('pneuma_video_mode', 'youtube');
  const thumbnailQuality = loadStr('pneuma_thumbnail_quality', 'hqdefault');

  const setHideShorts = (v) => { setHideShortsRaw(v); saveBool('pneuma_hide_shorts', v); };
  const setHideWatched = (v) => { setHideWatchedRaw(v); saveBool('pneuma_hide_watched', v); };
  const setSortBy = (v) => { setSortByRaw(v); saveStr('pneuma_sort_by', v); };
  const setSortOrder = (v) => { setSortOrderRaw(v); saveStr('pneuma_sort_order', v); };
  const setViewMode = (v) => { setViewModeRaw(v); saveStr('pneuma_view_mode', v); };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const loadChannel = useCallback(async () => {
    setChannelLoading(true);
    try {
      const ch = await getChannel(id);
      setChannel(ch);
      setShowBannerState(ch.show_banner ?? true);
      setShowAboutSection(ch.show_about ?? false);
      setIsFavourite(ch.is_favourite ?? false);
    } catch (err) {
      console.error('Failed to load channel:', err);
    } finally {
      setChannelLoading(false);
    }
  }, [id]);

  const loadVideos = useCallback(async (pageNum = 1, append = false) => {
    if (pageNum === 1) setVideosLoading(true);
    else setLoadingMore(true);
    try {
      const data = await getVideos({
        page: pageNum, limit: 50,
        channelId: id,
        hideShorts: hideShorts ? 'true' : undefined,
        hideWatched: hideWatched ? 'true' : undefined,
        search: debouncedSearch || undefined,
        sortBy: sortBy !== 'published_at' ? sortBy : undefined,
        sortOrder: sortOrder !== 'desc' ? sortOrder : undefined,
      });
      if (append) setVideos(prev => [...prev, ...data.videos]);
      else setVideos(data.videos);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error('Failed to load videos:', err);
    } finally {
      setVideosLoading(false);
      setLoadingMore(false);
    }
  }, [id, hideShorts, hideWatched, debouncedSearch, sortBy, sortOrder]);

  useEffect(() => { loadChannel(); }, [loadChannel]);
  useEffect(() => { loadVideos(1, false); }, [loadVideos]);

  useEffect(() => {
    if (!fetchDone) return;
    const t = setTimeout(() => setFetchDone(false), 3000);
    return () => clearTimeout(t);
  }, [fetchDone]);

  // Auto-refresh channel info if banner/about missing
  const autoRefreshedRef = useRef(false);
  useEffect(() => {
    if (!channelLoading && channel && !channel.banner_url && !autoRefreshedRef.current) {
      autoRefreshedRef.current = true;
      setRefreshingInfo(true);
      refreshChannelInfo(id)
        .then(updated => { setChannel(updated); })
        .catch(() => {})
        .finally(() => setRefreshingInfo(false));
    }
  }, [channel, channelLoading, id]);

  const handleFetchChannel = async () => {
    setFetching(true);
    setFetchError('');
    setFetchDone(false);
    try {
      const res = await fetchChannel(id);
      setFetchDone(true);
      await loadVideos(1, false);
      await loadChannel();
    } catch (err) {
      setFetchError(err.message || 'Fetch failed');
    } finally {
      setFetching(false);
    }
  };

  const handleMarkAllWatched = async () => {
    setMarkingAll(true);
    try {
      await markAllWatched(id);
      await loadVideos(1, false);
      await loadChannel();
    } catch (err) {
      console.error('Mark all watched failed:', err);
    } finally {
      setMarkingAll(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteSubscription(id);
      await onDataChange();
      navigate('/');
    } catch (err) {
      console.error('Delete failed:', err);
      setDeleting(false);
    }
  };

  const handleToggleBanner = async (val) => {
    setShowBannerState(val);
    try { await updateSubscription(id, { show_banner: val }); } catch {}
  };

  const handleToggleAbout = async (val) => {
    setShowAboutSection(val);
    try { await updateSubscription(id, { show_about: val }); } catch {}
  };

  const handleToggleFavourite = async () => {
    const next = !isFavourite;
    setIsFavourite(next);
    try {
      await updateSubscription(id, { is_favourite: next });
      await onDataChange();
    } catch { setIsFavourite(!next); }
  };

  const handleRefreshInfo = async () => {
    setRefreshingInfo(true);
    try {
      const updated = await refreshChannelInfo(id);
      setChannel(updated);
    } catch (err) {
      console.error('Refresh info failed:', err);
    } finally {
      setRefreshingInfo(false);
    }
  };

  const handleWatchedChange = (videoId, nowWatched) => {
    if (hideWatched && nowWatched) {
      setVideos(prev => prev.filter(v => v.id !== videoId));
      setTotal(prev => prev - 1);
    } else {
      setVideos(prev => prev.map(v => v.id === videoId ? { ...v, is_watched: nowWatched } : v));
    }
  };

  const ytChannelUrl = channel?.custom_url
    ? `https://www.youtube.com/${channel.custom_url}`
    : `https://www.youtube.com/channel/${id}`;

  if (channelLoading) {
    return (
      <main className="flex-1 min-h-screen flex flex-col">
        <div className="h-40 bg-gray-800/40 animate-pulse" />
        <div className="p-6 flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gray-800 animate-pulse" />
            <div className="flex flex-col gap-2">
              <div className="h-5 bg-gray-800 rounded w-40 animate-pulse" />
              <div className="h-3 bg-gray-800/60 rounded w-24 animate-pulse" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!channel) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Channel not found</p>
          <button onClick={() => navigate('/')} className="text-red-400 hover:text-red-300 text-sm">
            Back to Dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 min-h-screen flex flex-col">
      {/* Channel settings toggle bar */}
      <div className="sticky top-0 z-20 bg-[#0f0f0f] border-b border-gray-700 px-4 py-2 flex items-center gap-3">
        <span className="text-gray-400 text-sm truncate flex-1 min-w-0 font-medium">{channel.title}</span>
        <button
          onClick={() => setShowSettings(v => !v)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors border ${
            showSettings
              ? 'bg-gray-700 border-gray-600 text-white'
              : 'bg-[#1a1a1a] border-gray-700 text-gray-400 hover:text-white hover:border-gray-600'
          }`}
        >
          <Settings size={13} /> Settings
        </button>
      </div>

      {/* Channel settings panel */}
      {showSettings && (
        <div className="bg-[#161616] border-b border-gray-700 px-6 py-4">
          <div className="max-w-2xl flex flex-col gap-4">
            <h3 className="text-white text-sm font-semibold">Channel Settings</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Show banner toggle */}
              <div className="flex items-center justify-between bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-3">
                <div>
                  <p className="text-white text-sm font-medium">Show banner</p>
                  <p className="text-gray-500 text-xs mt-0.5">Display the channel banner image</p>
                </div>
                <button
                  onClick={() => handleToggleBanner(!showBanner)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-3 ${showBanner ? 'bg-red-600' : 'bg-gray-700'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${showBanner ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {/* Show about toggle */}
              <div className="flex items-center justify-between bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-3">
                <div>
                  <p className="text-white text-sm font-medium">Show about</p>
                  <p className="text-gray-500 text-xs mt-0.5">Display the channel description</p>
                </div>
                <button
                  onClick={() => handleToggleAbout(!showAboutSection)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-3 ${showAboutSection ? 'bg-red-600' : 'bg-gray-700'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${showAboutSection ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleRefreshInfo}
                disabled={refreshingInfo}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#242424] hover:bg-[#2e2e2e] border border-gray-700 text-gray-300 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                <RefreshCw size={13} className={refreshingInfo ? 'animate-spin' : ''} />
                Refresh channel info
              </button>

              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-950/50 hover:bg-red-900/40 border border-red-800 text-red-400 hover:text-red-300 rounded-lg text-sm transition-colors"
              >
                <Trash2 size={13} /> Remove channel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Banner */}
      {showBanner && (
        <div className="relative w-full bg-[#111] overflow-hidden" style={{ height: '180px' }}>
          {refreshingInfo && !channel.banner_url ? (
            <div className="w-full h-full bg-gray-800/40 animate-pulse" />
          ) : channel.banner_url ? (
            <img
              src={channel.banner_url}
              alt=""
              className="w-full h-full object-cover"
              onError={e => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900" />
          )}
        </div>
      )}

      {/* Channel header */}
      <div className="px-6 py-5 border-b border-gray-800">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className={`flex-shrink-0 rounded-full overflow-hidden ${isFavourite ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-[#0f0f0f]' : ''}`}
            style={{ width: 64, height: 64 }}>
            {channel.thumbnail_url ? (
              <img src={channel.thumbnail_url} alt={channel.title} className="w-full h-full object-cover" decoding="async" />
            ) : (
              <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                <span className="text-gray-300 text-xl font-bold">{channel.title?.charAt(0) || '?'}</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-white text-xl font-bold truncate">{channel.title}</h1>
              <button
                onClick={handleToggleFavourite}
                className={`flex-shrink-0 transition-colors ${isFavourite ? 'text-yellow-400' : 'text-gray-600 hover:text-yellow-400'}`}
                aria-label={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
                title={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
              >
                <Star size={16} fill={isFavourite ? 'currentColor' : 'none'} />
              </button>
            </div>

            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {channel.custom_url && (
                <span className="text-gray-500 text-sm">{channel.custom_url}</span>
              )}
              {channel.subscriber_count ? (
                <span className="text-gray-500 text-sm">{formatSubscriberCount(channel.subscriber_count)}</span>
              ) : refreshingInfo ? (
                <span className="text-gray-600 text-xs">Loading…</span>
              ) : null}
              {channel.watched_count > 0 && (
                <span className="text-gray-600 text-sm">{channel.watched_count} watched</span>
              )}
            </div>
          </div>

          {/* YouTube link */}
          <a
            href={ytChannelUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <ExternalLink size={13} /> YouTube
          </a>
        </div>

        {/* About section */}
        {showAboutSection && channel.description && (
          <div className="mt-4">
            <button
              onClick={() => setShowAbout(v => !v)}
              className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors mb-2"
            >
              {showAbout ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              About
            </button>
            {showAbout && (
              <p className="text-gray-400 text-sm leading-relaxed whitespace-pre-wrap max-w-2xl bg-[#1a1a1a] rounded-lg p-4 border border-gray-800">
                {channel.description}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="sticky top-[41px] z-10 bg-[#0f0f0f] border-b border-gray-700 px-6 py-3">
        {/* Row 1: search + fetch + mark all */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[160px]">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search videos…"
              className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg pl-3 pr-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-red-600/60 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                <X size={13} />
              </button>
            )}
          </div>

          <button
            onClick={handleFetchChannel}
            disabled={fetching}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-[#1a1a1a] border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-50 transition-colors flex-shrink-0"
          >
            <RefreshCw size={13} className={fetching ? 'animate-spin' : ''} />
            {fetching ? 'Fetching…' : 'Fetch this channel'}
          </button>

          <button
            onClick={handleMarkAllWatched}
            disabled={markingAll}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-[#1a1a1a] border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-50 transition-colors flex-shrink-0"
          >
            <Check size={13} />
            {markingAll ? 'Marking…' : 'Mark all watched'}
          </button>
        </div>

        {/* Row 2: filters + sort + view */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <button
            onClick={() => setHideShorts(!hideShorts)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors border ${
              hideShorts ? 'bg-red-600/20 border-red-600/50 text-red-400' : 'bg-[#1a1a1a] border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
            }`}
          >
            <Scissors size={12} /> Hide Shorts
          </button>
          <button
            onClick={() => setHideWatched(!hideWatched)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors border ${
              hideWatched ? 'bg-indigo-600/20 border-indigo-600/50 text-indigo-400' : 'bg-[#1a1a1a] border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
            }`}
          >
            <Eye size={12} />
            Hide Watched
          </button>

          <div className="flex-1" />

          {/* Sort */}
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500 text-xs">Sort by:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="bg-[#1a1a1a] border border-gray-700 text-gray-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gray-600 cursor-pointer"
            >
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-[#1a1a1a] border border-gray-700 text-gray-400 hover:text-white rounded-lg text-xs transition-colors"
              aria-label={sortOrder === 'desc' ? 'Sort ascending' : 'Sort descending'}
            >
              {sortOrder === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
              {sortOrder === 'desc' ? 'Desc' : 'Asc'}
            </button>
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-[#1a1a1a] border border-gray-700 rounded-lg overflow-hidden" role="group" aria-label="View mode">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors ${viewMode === 'grid' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}
              aria-pressed={viewMode === 'grid'}
              aria-label="Grid view"
            >
              <LayoutGrid size={12} /> Grid
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors ${viewMode === 'table' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}
              aria-pressed={viewMode === 'table'}
              aria-label="Table view"
            >
              <List size={12} /> Table
            </button>
          </div>
        </div>

        {/* Status messages */}
        {fetchDone && (
          <div className="mt-2 flex items-center gap-2 text-green-400 text-xs">
            <Check size={12} /> Fetch complete
            <button onClick={() => setFetchDone(false)} className="ml-auto text-gray-600 hover:text-gray-400"><X size={11} /></button>
          </div>
        )}
        {fetchError && (
          <div className="mt-2 flex items-center gap-2 text-red-400 text-xs">
            <AlertCircle size={12} /> {fetchError}
            <button onClick={() => setFetchError('')} className="ml-auto text-gray-600 hover:text-gray-400"><X size={11} /></button>
          </div>
        )}

        {!videosLoading && (
          <div className="mt-2 text-xs text-gray-500">
            <span className="text-gray-300 font-medium">{total.toLocaleString()}</span> video{total !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Fetch progress bar */}
      {fetching && (
        <div className="h-0.5 w-full bg-gray-800 overflow-hidden">
          <div className="h-full bg-red-500" style={{ width: '40%', animation: 'indeterminate 1.4s ease-in-out infinite' }} />
        </div>
      )}
      <style>{`@keyframes indeterminate{0%{transform:translateX(-100%)}100%{transform:translateX(350%)}}`}</style>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <DeleteModal
          channelTitle={channel.title}
          deleting={deleting}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
        />
      )}

      {/* Video content */}
      <div className={`${viewMode === 'table' ? 'p-0' : 'p-6'} flex-1`}>
        {videosLoading ? (
          viewMode === 'table' ? (
            <div className="p-6 flex flex-col gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-10 bg-gray-800/40 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="flex flex-col bg-[#1a1a1a] rounded-lg overflow-hidden animate-pulse">
                  <div className="aspect-video bg-gray-800/60" />
                  <div className="p-3 flex flex-col gap-2">
                    <div className="h-3.5 bg-gray-800/60 rounded" />
                    <div className="h-3.5 bg-gray-800/60 rounded w-3/4" />
                    <div className="h-2.5 bg-gray-800/60 rounded w-20" />
                  </div>
                </div>
              ))}
            </div>
          )
        ) : videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="text-gray-700 mb-3"><PlaySquare size={40} /></div>
            <p className="text-gray-400 font-medium mb-2">No videos found</p>
            <p className="text-gray-600 text-sm max-w-sm">
              {debouncedSearch ? `No results for "${debouncedSearch}".` : 'Click "Fetch this channel" to import videos.'}
            </p>
          </div>
        ) : viewMode === 'table' ? (
          <>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="py-2 px-3 text-left text-gray-600 text-xs font-medium uppercase tracking-wider w-[88px]">Thumb</th>
                  <th className="py-2 px-3 text-left text-gray-600 text-xs font-medium uppercase tracking-wider">Title</th>
                  <th className="py-2 px-3 text-left text-gray-600 text-xs font-medium uppercase tracking-wider">Date</th>
                  <th className="py-2 px-3 text-left text-gray-600 text-xs font-medium uppercase tracking-wider">Duration</th>
                  <th className="py-2 px-3 text-left text-gray-600 text-xs font-medium uppercase tracking-wider">Views</th>
                  <th className="py-2 px-3 text-right text-gray-600 text-xs font-medium uppercase tracking-wider">Watched</th>
                </tr>
              </thead>
              <tbody>
                {videos.map(video => (
                  <VideoTableRow
                    key={video.id}
                    video={video}
                    onWatchedChange={handleWatchedChange}
                    videoMode={videoMode}
                    thumbnailQuality={thumbnailQuality}
                  />
                ))}
              </tbody>
            </table>
            {page < totalPages && (
              <div className="flex justify-center p-6">
                <button
                  onClick={() => { if (!loadingMore) loadVideos(page + 1, true); }}
                  disabled={loadingMore}
                  className="px-6 py-3 bg-[#1a1a1a] border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {loadingMore ? 'Loading…' : `Load More (${total - videos.length} remaining)`}
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {videos.map(video => (
                <VideoCard
                  key={video.id}
                  video={video}
                  onWatchedChange={handleWatchedChange}
                  videoMode={videoMode}
                />
              ))}
            </div>
            {page < totalPages && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={() => { if (!loadingMore) loadVideos(page + 1, true); }}
                  disabled={loadingMore}
                  className="px-6 py-3 bg-[#1a1a1a] border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {loadingMore ? 'Loading…' : `Load More (${total - videos.length} remaining)`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function DeleteModal({ channelTitle, deleting, onCancel, onConfirm }) {
  const modalRef = useRef(null);

  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;
    const focusable = Array.from(modal.querySelectorAll('button:not([disabled])'));
    focusable[0]?.focus();
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !deleting) { onCancel(); return; }
      if (e.key === 'Tab' && focusable.length > 0) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [deleting, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
      onClick={() => !deleting && onCancel()}
    >
      <div
        ref={modalRef}
        className="bg-[#1a1a1a] border border-gray-700 rounded-xl shadow-2xl w-full max-w-sm p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <AlertTriangle size={18} className="text-red-400" />
          </div>
          <div>
            <h3 id="delete-modal-title" className="text-white font-semibold text-base">Remove channel?</h3>
            <p className="text-gray-400 text-sm mt-1">
              This will permanently delete <span className="text-white font-medium">{channelTitle}</span> and all its video data. This cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white bg-[#242424] border border-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {deleting ? <><RefreshCw size={12} className="animate-spin" /> Deleting…</> : <><Trash2 size={12} /> Remove channel</>}
          </button>
        </div>
      </div>
    </div>
  );
}
