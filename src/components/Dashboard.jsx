import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Scissors, Eye, EyeOff, RefreshCw, X,
  ArrowLeft, ExternalLink, Maximize2, Minimize2, PictureInPicture2,
  LayoutGrid, List, ArrowDown, ArrowUp, Check, RotateCcw,
} from 'lucide-react';
import { getVideos, fetchVideos, getFetchStatus, markWatched, unmarkWatched, saveProgress } from '../services/api.js';
import VideoCard from './VideoCard.jsx';

function SkeletonCard() {
  return (
    <div className="flex flex-col bg-[#1a1a1a] rounded-lg overflow-hidden animate-pulse">
      <div className="aspect-video bg-gray-800/60" />
      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gray-800" />
          <div className="h-2.5 bg-gray-800/60 rounded w-24" />
        </div>
        <div className="h-3.5 bg-gray-800/60 rounded w-full" />
        <div className="h-3.5 bg-gray-800/60 rounded w-3/4" />
        <div className="h-2.5 bg-gray-800/60 rounded w-20" />
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-800/50 animate-pulse">
      <td className="py-2 px-3"><div className="w-20 aspect-video bg-gray-800/60 rounded" /></td>
      <td className="py-2 px-3"><div className="h-3.5 bg-gray-800/60 rounded w-48" /></td>
      <td className="py-2 px-3"><div className="h-3 bg-gray-800/60 rounded w-28" /></td>
      <td className="py-2 px-3"><div className="h-3 bg-gray-800/60 rounded w-16" /></td>
      <td className="py-2 px-3"><div className="h-3 bg-gray-800/60 rounded w-12" /></td>
      <td className="py-2 px-3"><div className="h-3 bg-gray-800/60 rounded w-14" /></td>
      <td className="py-2 px-3"><div className="h-5 w-5 bg-gray-800/60 rounded ml-auto" /></td>
    </tr>
  );
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

function VideoTableRow({ video, onWatchedChange, videoMode, onVideoSelect }) {
  const [isWatched, setIsWatched] = useState(video.is_watched);
  const [toggling, setToggling] = useState(false);
  const ytUrl = `https://www.youtube.com/watch?v=${video.id}`;

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
    if (videoMode === 'embed') { e.preventDefault(); onVideoSelect?.(video); }
  };

  return (
    <tr className={`border-b border-gray-800/50 hover:bg-[#1a1a1a] transition-colors group ${isWatched ? 'opacity-50' : ''}`}>
      <td className="py-2 px-3">
        <a href={ytUrl} onClick={handleClick} className="block">
          <div className="relative w-20 rounded overflow-hidden bg-gray-800" style={{ aspectRatio: '16/9' }}>
            {video.thumbnail_url && <img src={video.thumbnail_url} className="w-full h-full object-cover" loading="lazy" />}
            {!isWatched && (video.percent_watched || 0) > 0.01 && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/40">
                <div className="h-full bg-red-500" style={{ width: `${Math.min((video.percent_watched || 0) * 100, 100)}%` }} />
              </div>
            )}
          </div>
        </a>
      </td>
      <td className="py-2 px-3 max-w-[320px]">
        <a href={ytUrl} onClick={handleClick} className="text-white text-sm line-clamp-2 hover:text-gray-200 leading-snug">
          {video.title}
        </a>
      </td>
      <td className="py-2 px-3">
        <div className="flex items-center gap-1.5 min-w-[100px]">
          {video.channel_thumbnail
            ? <img src={video.channel_thumbnail} className="w-5 h-5 rounded-full flex-shrink-0" />
            : <div className="w-5 h-5 rounded-full bg-gray-700 flex-shrink-0 flex items-center justify-center"><span className="text-[9px] text-gray-400">{video.channel_title?.[0]}</span></div>
          }
          <span className="text-gray-400 text-xs truncate">{video.channel_title}</span>
        </div>
      </td>
      <td className="py-2 px-3 text-gray-500 text-xs whitespace-nowrap">{formatRelativeTime(video.published_at)}</td>
      <td className="py-2 px-3 text-gray-500 text-xs font-mono whitespace-nowrap">{formatDuration(video.duration_seconds) || '—'}</td>
      <td className="py-2 px-3 text-gray-500 text-xs whitespace-nowrap">{formatViewCount(video.view_count) || '—'}</td>
      <td className="py-2 px-3 text-right">
        <button
          onClick={handleWatchedToggle}
          disabled={toggling}
          className={`p-1.5 rounded-full transition-colors ${isWatched ? 'text-green-400 hover:text-gray-400' : 'text-gray-700 group-hover:text-gray-500 hover:text-green-400'}`}
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

export default function Dashboard({ selectedChannelId, onClearChannel, selectedCategoryId, onClearCategory, subscriptions, categories }) {
  const [videos, setVideos] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchProgress, setFetchProgress] = useState(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [hideShorts, setHideShortsRaw] = useState(() => loadBool('pneuma_hide_shorts'));
  const [hideWatched, setHideWatchedRaw] = useState(() => loadBool('pneuma_hide_watched'));
  const [sortBy, setSortByRaw] = useState(() => loadStr('pneuma_sort_by', 'published_at'));
  const [sortOrder, setSortOrderRaw] = useState(() => loadStr('pneuma_sort_order', 'desc'));
  const [viewMode, setViewModeRaw] = useState(() => loadStr('pneuma_view_mode', 'grid'));
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [playerSize, setPlayerSize] = useState('normal');
  const embedMode = (() => { try { return localStorage.getItem('pneuma_embed_mode') || 'youtube'; } catch { return 'youtube'; } })();
  const showComments = loadBool('pneuma_show_comments');
  const [error, setError] = useState('');
  const pollRef = useRef(null);

  const setHideShorts = (v) => { setHideShortsRaw(v); saveBool('pneuma_hide_shorts', v); };
  const setHideWatched = (v) => { setHideWatchedRaw(v); saveBool('pneuma_hide_watched', v); };
  const setSortBy = (v) => { setSortByRaw(v); saveStr('pneuma_sort_by', v); };
  const setSortOrder = (v) => { setSortOrderRaw(v); saveStr('pneuma_sort_order', v); };
  const setViewMode = (v) => { setViewModeRaw(v); saveStr('pneuma_view_mode', v); };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const loadVideos = useCallback(async (pageNum = 1, append = false) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);
    setError('');
    try {
      const data = await getVideos({
        page: pageNum, limit: 50,
        hideShorts: hideShorts ? 'true' : undefined,
        hideWatched: hideWatched ? 'true' : undefined,
        search: debouncedSearch || undefined,
        channelId: selectedChannelId || undefined,
        categoryId: selectedCategoryId || undefined,
        sortBy: sortBy !== 'published_at' ? sortBy : undefined,
        sortOrder: sortOrder !== 'desc' ? sortOrder : undefined,
      });
      if (append) setVideos(prev => [...prev, ...data.videos]);
      else setVideos(data.videos);
      setTotal(data.total);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err.message || 'Failed to load videos');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [hideShorts, hideWatched, debouncedSearch, selectedChannelId, selectedCategoryId, sortBy, sortOrder]);

  useEffect(() => { loadVideos(1, false); }, [loadVideos]);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);
  useEffect(() => { setSelectedVideo(null); }, [selectedChannelId, selectedCategoryId]);

  const handleFetchVideos = async () => {
    if (fetching) return;
    setFetching(true);
    setFetchProgress({ running: true, total: 0, done: 0, errors: 0 });
    try {
      await fetchVideos();
      pollRef.current = setInterval(async () => {
        try {
          const status = await getFetchStatus();
          setFetchProgress(status);
          if (!status.running) {
            clearInterval(pollRef.current); pollRef.current = null;
            await loadVideos(1, false);
            setFetching(false); setFetchProgress(null);
          }
        } catch {
          clearInterval(pollRef.current); pollRef.current = null;
          setFetching(false); setFetchProgress(null);
        }
      }, 1500);
    } catch {
      setFetching(false); setFetchProgress(null);
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

  const handleProgressUpdate = (videoId, positionSeconds, durationSeconds) => {
    const pct = durationSeconds > 0 ? positionSeconds / durationSeconds : 0;
    setVideos(prev => prev.map(v =>
      v.id === videoId ? { ...v, position_seconds: positionSeconds, percent_watched: pct } : v
    ));
  };

  const selectedChannel = selectedChannelId ? subscriptions.find(s => s.id === selectedChannelId) : null;
  const selectedCategory = selectedCategoryId ? (categories || []).find(c => c.id === selectedCategoryId) : null;
  const progressPct = fetchProgress?.total > 0 ? Math.round((fetchProgress.done / fetchProgress.total) * 100) : 0;

  if (selectedVideo && playerSize !== 'float') {
    return (
      <VideoPlayerView
        video={selectedVideo}
        showComments={showComments}
        onBack={() => setSelectedVideo(null)}
        onWatchedChange={handleWatchedChange}
        onProgressUpdate={handleProgressUpdate}
        playerSize={playerSize}
        onSizeChange={setPlayerSize}
      />
    );
  }

  return (
    <main className="flex-1 min-h-screen flex flex-col">
      {/* Filter bar */}
      <div className="sticky top-0 z-10 bg-[#0f0f0f]/95 backdrop-blur border-b border-gray-700 px-6 py-3">
        {/* Row 1: search + fetch */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search videos, channels..."
              className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-red-600/60 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={handleFetchVideos}
            disabled={fetching}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-[#1a1a1a] border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-50 transition-colors flex-shrink-0"
          >
            <RefreshCw size={14} className={fetching ? 'animate-spin' : ''} />
            {fetching ? 'Fetching...' : 'Fetch Videos'}
          </button>
        </div>

        {/* Row 2: filters + sort + view */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {/* Active filter chips */}
          {selectedChannel && (
            <div className="flex items-center gap-1.5 bg-red-600/20 border border-red-600/40 text-red-400 px-2.5 py-1 rounded-full text-xs">
              <span>{selectedChannel.title}</span>
              <button onClick={onClearChannel} className="hover:text-white"><X size={11} /></button>
            </div>
          )}
          {selectedCategory && (
            <div className="flex items-center gap-1.5 bg-indigo-600/20 border border-indigo-600/40 text-indigo-400 px-2.5 py-1 rounded-full text-xs">
              <span>{selectedCategory.name}</span>
              <button onClick={onClearCategory} className="hover:text-white"><X size={11} /></button>
            </div>
          )}

          <button
            onClick={() => setHideShorts(!hideShorts)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors border ${
              hideShorts ? 'bg-red-600/20 border-red-600/50 text-red-400' : 'bg-[#1a1a1a] border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
            }`}
          >
            <Scissors size={13} /> Hide Shorts
          </button>

          <button
            onClick={() => setHideWatched(!hideWatched)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors border ${
              hideWatched ? 'bg-indigo-600/20 border-indigo-600/50 text-indigo-400' : 'bg-[#1a1a1a] border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
            }`}
          >
            {hideWatched ? <EyeOff size={13} /> : <Eye size={13} />}
            {hideWatched ? 'Show Watched' : 'Hide Watched'}
          </button>

          <div className="flex-1" />

          {/* Sort */}
          <div className="flex items-center gap-1.5">
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
              title={sortOrder === 'desc' ? 'Descending' : 'Ascending'}
            >
              {sortOrder === 'desc' ? <ArrowDown size={13} /> : <ArrowUp size={13} />}
              {sortOrder === 'desc' ? 'Desc' : 'Asc'}
            </button>
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-[#1a1a1a] border border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors ${viewMode === 'grid' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}
              title="Grid view"
            >
              <LayoutGrid size={13} /> Grid
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors ${viewMode === 'table' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}
              title="Table view"
            >
              <List size={13} /> Table
            </button>
          </div>
        </div>

        {/* Fetch progress bar */}
        {fetchProgress && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-gray-400">
                Fetching — <span className="text-white font-medium">{fetchProgress.done}</span>
                <span className="text-gray-600"> / {fetchProgress.total} channels</span>
              </span>
              {fetchProgress.errors > 0 && <span className="text-red-400">{fetchProgress.errors} failed</span>}
              <span className="text-gray-500">{progressPct}%</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
              <div className="bg-red-600 h-1.5 rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}

        {!loading && !fetchProgress && (
          <div className="mt-2 text-xs text-gray-500">
            <span className="text-gray-300 font-medium">{total.toLocaleString()}</span>{' '}
            video{total !== 1 ? 's' : ''}
            {selectedChannel && <span className="text-gray-600"> from <span className="text-gray-400">{selectedChannel.title}</span></span>}
            {selectedCategory && <span className="text-gray-600"> in <span className="text-gray-400">{selectedCategory.name}</span></span>}
            {debouncedSearch && <span className="text-gray-600"> matching <span className="text-gray-400">"{debouncedSearch}"</span></span>}
          </div>
        )}
      </div>

      {/* Content */}
      <div className={`${viewMode === 'table' ? 'p-0' : 'p-6'} flex-1`}>
        {error && (
          <div className="m-6 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">{error}</div>
        )}

        {loading ? (
          viewMode === 'table' ? (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="py-2 px-3 text-left text-gray-600 text-xs font-medium uppercase tracking-wider w-[88px]">Thumb</th>
                  <th className="py-2 px-3 text-left text-gray-600 text-xs font-medium uppercase tracking-wider">Title</th>
                  <th className="py-2 px-3 text-left text-gray-600 text-xs font-medium uppercase tracking-wider">Channel</th>
                  <th className="py-2 px-3 text-left text-gray-600 text-xs font-medium uppercase tracking-wider">Date</th>
                  <th className="py-2 px-3 text-left text-gray-600 text-xs font-medium uppercase tracking-wider">Duration</th>
                  <th className="py-2 px-3 text-left text-gray-600 text-xs font-medium uppercase tracking-wider">Views</th>
                  <th className="py-2 px-3 text-right text-gray-600 text-xs font-medium uppercase tracking-wider">Watched</th>
                </tr>
              </thead>
              <tbody>{Array.from({ length: 15 }).map((_, i) => <SkeletonRow key={i} />)}</tbody>
            </table>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          )
        ) : videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="text-gray-700 mb-3"><Search size={40} /></div>
            <h3 className="text-gray-400 font-medium mb-2">No videos found</h3>
            <p className="text-gray-600 text-sm max-w-sm">
              {debouncedSearch
                ? `No results for "${debouncedSearch}". Try a different search.`
                : 'Click "Fetch Videos" to import recent videos from your subscriptions.'}
            </p>
          </div>
        ) : viewMode === 'table' ? (
          <>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="py-2 px-3 text-left text-gray-600 text-xs font-medium uppercase tracking-wider w-[88px]">Thumb</th>
                  <th className="py-2 px-3 text-left text-gray-600 text-xs font-medium uppercase tracking-wider">Title</th>
                  <th className="py-2 px-3 text-left text-gray-600 text-xs font-medium uppercase tracking-wider">Channel</th>
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
                    videoMode={embedMode}
                    onVideoSelect={v => { setSelectedVideo(v); setPlayerSize('normal'); }}
                  />
                ))}
              </tbody>
            </table>
            {page < totalPages && (
              <div className="flex justify-center p-6">
                <button
                  onClick={() => { if (page < totalPages && !loadingMore) loadVideos(page + 1, true); }}
                  disabled={loadingMore}
                  className="px-6 py-3 bg-[#1a1a1a] border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {loadingMore ? <span className="flex items-center gap-2"><RefreshCw size={14} className="animate-spin" />Loading...</span> : `Load More (${total - videos.length} remaining)`}
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
                  videoMode={embedMode}
                  onVideoSelect={v => { setSelectedVideo(v); setPlayerSize('normal'); }}
                />
              ))}
            </div>
            {page < totalPages && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={() => { if (page < totalPages && !loadingMore) loadVideos(page + 1, true); }}
                  disabled={loadingMore}
                  className="px-6 py-3 bg-[#1a1a1a] border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {loadingMore ? <span className="flex items-center gap-2"><RefreshCw size={14} className="animate-spin" />Loading...</span> : `Load More (${total - videos.length} remaining)`}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating player overlay */}
      {selectedVideo && playerSize === 'float' && (
        <FloatingPlayer
          video={selectedVideo}
          showComments={showComments}
          onClose={() => setSelectedVideo(null)}
          onExpand={() => setPlayerSize('normal')}
          onWatchedChange={handleWatchedChange}
          onProgressUpdate={handleProgressUpdate}
        />
      )}
    </main>
  );
}

function VideoPlayerView({ video, showComments, onBack, onWatchedChange, onProgressUpdate, playerSize, onSizeChange }) {
  const intervalRef = useRef(null);
  const playerRef = useRef(null);
  const markedRef = useRef(video.is_watched || false);
  const lastProgressRef = useRef({ position: video.position_seconds || 0, duration: 0 });
  const playerId = `yt-player-${video.id}`;
  const ytUrl = `https://www.youtube.com/watch?v=${video.id}`;

  useEffect(() => {
    let destroyed = false;
    markedRef.current = video.is_watched || false;

    const saveCurrentProgress = () => {
      if (!playerRef.current) return;
      try {
        const current = playerRef.current.getCurrentTime();
        const duration = playerRef.current.getDuration();
        if (duration > 0 && current > 0) {
          lastProgressRef.current = { position: Math.floor(current), duration: Math.floor(duration) };
          saveProgress(video.id, Math.floor(current), Math.floor(duration)).catch(() => {});
        }
      } catch {}
    };

    const checkProgress = () => {
      if (!playerRef.current) return;
      try {
        const current = playerRef.current.getCurrentTime();
        const duration = playerRef.current.getDuration();
        if (duration <= 0) return;
        saveCurrentProgress();
        if (!markedRef.current && current / duration >= 0.95) {
          markedRef.current = true;
          clearInterval(intervalRef.current);
          markWatched(video.id).catch(console.error);
          onWatchedChange?.(video.id, true);
        }
      } catch {}
    };

    const createPlayer = () => {
      if (destroyed) return;
      playerRef.current = new window.YT.Player(playerId, {
        videoId: video.id,
        width: '100%',
        height: '100%',
        playerVars: { autoplay: 1, rel: 0 },
        events: {
          onReady: () => {
            if ((video.position_seconds || 0) > 10 && (video.percent_watched || 0) < 0.95) {
              playerRef.current?.seekTo(video.position_seconds, true);
            }
          },
          onStateChange: ({ data }) => {
            if (data === window.YT.PlayerState.PLAYING) {
              intervalRef.current = setInterval(checkProgress, 5000);
            } else {
              clearInterval(intervalRef.current);
              if (data === window.YT.PlayerState.PAUSED) saveCurrentProgress();
              else if (data === window.YT.PlayerState.ENDED) checkProgress();
            }
          },
        },
      });
    };

    if (window.YT?.Player) {
      createPlayer();
    } else {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); createPlayer(); };
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
    }

    return () => {
      destroyed = true;
      clearInterval(intervalRef.current);
      try { playerRef.current?.destroy(); } catch {}
      playerRef.current = null;
    };
  }, [video.id]);

  const handleBack = () => {
    const { position, duration } = lastProgressRef.current;
    if (duration > 0) onProgressUpdate?.(video.id, position, duration);
    onBack();
  };

  const handleSwitchToFloat = () => {
    const { position, duration } = lastProgressRef.current;
    if (duration > 0) onProgressUpdate?.(video.id, position, duration);
    onSizeChange('float');
  };

  const isFull = playerSize === 'full';

  return (
    <main className="flex-1 min-h-screen flex flex-col">
      {/* Back bar */}
      <div className="sticky top-0 z-10 bg-[#0f0f0f]/95 backdrop-blur border-b border-gray-700 px-6 py-3 flex items-center gap-3">
        <button onClick={handleBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm flex-shrink-0">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-gray-400 text-sm truncate">{video.title}</p>
        </div>
        {/* Size controls */}
        <div className="flex items-center gap-1 bg-[#1a1a1a] border border-gray-700 rounded-lg overflow-hidden flex-shrink-0">
          <button
            onClick={() => onSizeChange('normal')}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors ${!isFull ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}
            title="Normal"
          >
            <Minimize2 size={12} /> Normal
          </button>
          <button
            onClick={() => onSizeChange('full')}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors ${isFull ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}
            title="Full view"
          >
            <Maximize2 size={12} /> Full
          </button>
          <button
            onClick={handleSwitchToFloat}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-500 hover:text-white transition-colors"
            title="Float"
          >
            <PictureInPicture2 size={12} /> Float
          </button>
        </div>
        <a href={ytUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-gray-500 hover:text-white text-sm transition-colors flex-shrink-0">
          <ExternalLink size={14} /> YouTube
        </a>
      </div>

      {/* Player */}
      <div className={`flex-1 ${isFull ? 'p-0 flex flex-col' : 'p-6'}`}>
        <div className={isFull ? 'flex-1 bg-black' : 'aspect-video w-full max-w-5xl mx-auto rounded-xl overflow-hidden bg-black mb-5'}>
          {isFull ? (
            <div className="w-full h-full flex flex-col">
              <div className="flex-1 bg-black">
                <div id={playerId} className="w-full h-full" />
              </div>
            </div>
          ) : (
            <div id={playerId} className="w-full h-full" />
          )}
        </div>

        {!isFull && (
          <div className="max-w-5xl mx-auto w-full flex flex-col gap-3">
            <h1 className="text-white text-xl font-semibold leading-snug">{video.title}</h1>
            <div className="flex items-center gap-3">
              {video.channel_thumbnail
                ? <img src={video.channel_thumbnail} alt={video.channel_title} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                : <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0"><span className="text-gray-400 text-xs">{video.channel_title?.[0] || '?'}</span></div>
              }
              <span className="text-gray-300 text-sm font-medium">{video.channel_title}</span>
              {video.published_at && (
                <><span className="text-gray-700">·</span><span className="text-gray-500 text-sm">{new Date(video.published_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</span></>
              )}
            </div>
            {showComments && (
              <div className="mt-2 flex items-center justify-between bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3">
                <p className="text-gray-500 text-sm">Comments are only available on YouTube.</p>
                <a href={ytUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium flex-shrink-0 ml-4 transition-colors">
                  <ExternalLink size={13} /> View comments
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function FloatingPlayer({ video, showComments, onClose, onExpand, onWatchedChange, onProgressUpdate }) {
  const intervalRef = useRef(null);
  const playerRef = useRef(null);
  const markedRef = useRef(video.is_watched || false);
  const lastProgressRef = useRef({ position: video.position_seconds || 0, duration: 0 });
  const playerId = `yt-float-${video.id}`;

  useEffect(() => {
    let destroyed = false;
    markedRef.current = video.is_watched || false;

    const saveCurrentProgress = () => {
      if (!playerRef.current) return;
      try {
        const current = playerRef.current.getCurrentTime();
        const duration = playerRef.current.getDuration();
        if (duration > 0 && current > 0) {
          lastProgressRef.current = { position: Math.floor(current), duration: Math.floor(duration) };
          saveProgress(video.id, Math.floor(current), Math.floor(duration)).catch(() => {});
        }
      } catch {}
    };

    const checkProgress = () => {
      if (!playerRef.current) return;
      try {
        const current = playerRef.current.getCurrentTime();
        const duration = playerRef.current.getDuration();
        if (duration <= 0) return;
        saveCurrentProgress();
        if (!markedRef.current && current / duration >= 0.95) {
          markedRef.current = true;
          clearInterval(intervalRef.current);
          markWatched(video.id).catch(console.error);
          onWatchedChange?.(video.id, true);
        }
      } catch {}
    };

    const createPlayer = () => {
      if (destroyed) return;
      playerRef.current = new window.YT.Player(playerId, {
        videoId: video.id,
        width: '100%',
        height: '100%',
        playerVars: { autoplay: 1, rel: 0 },
        events: {
          onReady: () => {
            if ((video.position_seconds || 0) > 10 && (video.percent_watched || 0) < 0.95) {
              playerRef.current?.seekTo(video.position_seconds, true);
            }
          },
          onStateChange: ({ data }) => {
            if (data === window.YT.PlayerState.PLAYING) {
              intervalRef.current = setInterval(checkProgress, 5000);
            } else {
              clearInterval(intervalRef.current);
              if (data === window.YT.PlayerState.PAUSED) saveCurrentProgress();
              else if (data === window.YT.PlayerState.ENDED) checkProgress();
            }
          },
        },
      });
    };

    if (window.YT?.Player) {
      createPlayer();
    } else {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { prev?.(); createPlayer(); };
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
    }

    return () => {
      destroyed = true;
      clearInterval(intervalRef.current);
      const { position, duration } = lastProgressRef.current;
      if (duration > 0) onProgressUpdate?.(video.id, position, duration);
      try { playerRef.current?.destroy(); } catch {}
      playerRef.current = null;
    };
  }, [video.id]);

  const handleExpand = () => {
    const { position, duration } = lastProgressRef.current;
    if (duration > 0) onProgressUpdate?.(video.id, position, duration);
    onExpand();
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-xl overflow-hidden shadow-2xl border border-gray-700 bg-black w-72">
      <div className="bg-[#1a1a1a] px-3 py-2 flex items-center gap-2">
        <p className="text-white text-xs truncate flex-1">{video.title}</p>
        <button onClick={handleExpand} className="text-gray-400 hover:text-white transition-colors flex-shrink-0" title="Expand">
          <Maximize2 size={13} />
        </button>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors flex-shrink-0" title="Close">
          <X size={13} />
        </button>
      </div>
      <div className="bg-black" style={{ aspectRatio: '16/9' }}>
        <div id={playerId} className="w-full h-full" />
      </div>
    </div>
  );
}
