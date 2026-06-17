import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Search, Scissors, Eye, EyeOff, RefreshCw,
  ArrowDown, ArrowUp, LayoutGrid, List, Check, RotateCcw, X,
} from 'lucide-react';
import { getVideos } from '../services/api.js';
import VideoCard from './VideoCard.jsx';

function tablerClass(iconName) {
  if (!iconName) return 'folder';
  if (iconName === iconName.toLowerCase() || iconName.includes('-')) return iconName;
  return iconName.replace(/([A-Z])/g, (m, p1, offset) => (offset > 0 ? '-' : '') + p1.toLowerCase());
}

function loadBool(key, def = false) {
  try { const v = localStorage.getItem(key); return v === null ? def : v === 'true'; } catch { return def; }
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

import { markWatched, unmarkWatched } from '../services/api.js';

function VideoTableRow({ video, onWatchedChange }) {
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

  const handleClick = () => {
    window.open(`https://www.youtube.com/watch?v=${video.id}`, '_blank', 'noopener,noreferrer');
  };

  const quality = loadStr('pneuma_thumbnail_quality', 'hqdefault');
  const thumbnailUrl = `https://i.ytimg.com/vi/${video.id}/${quality}.jpg`;

  return (
    <tr className={`border-b border-gray-800/50 hover:bg-[#1a1a1a] transition-colors group ${isWatched ? 'opacity-50' : ''}`}>
      <td className="py-2 px-3">
        <div onClick={handleClick} className="cursor-pointer relative w-20 rounded overflow-hidden bg-gray-800" style={{ aspectRatio: '16/9' }}>
          <img src={thumbnailUrl} className="w-full h-full object-cover" loading="lazy"
            onError={e => { e.currentTarget.src = `https://i.ytimg.com/vi/${video.id}/mqdefault.jpg`; }} />
        </div>
      </td>
      <td className="py-2 px-3 max-w-[320px]">
        <div onClick={handleClick} className="text-white text-sm line-clamp-2 hover:text-gray-200 leading-snug cursor-pointer">{video.title}</div>
      </td>
      <td className="py-2 px-3">
        <Link to={`/channel/${video.channel_id}`} className="flex items-center gap-1.5 min-w-[100px] hover:opacity-80" onClick={e => e.stopPropagation()}>
          {video.channel_thumbnail
            ? <img src={video.channel_thumbnail} className="w-5 h-5 rounded-full flex-shrink-0" />
            : <div className="w-5 h-5 rounded-full bg-gray-700 flex-shrink-0 flex items-center justify-center"><span className="text-[9px] text-gray-400">{video.channel_title?.[0]}</span></div>
          }
          <span className="text-gray-400 text-xs truncate">{video.channel_title}</span>
        </Link>
      </td>
      <td className="py-2 px-3 text-gray-500 text-xs whitespace-nowrap">{formatRelativeTime(video.published_at)}</td>
      <td className="py-2 px-3 text-gray-500 text-xs font-mono whitespace-nowrap">{formatDuration(video.duration_seconds) || '—'}</td>
      <td className="py-2 px-3 text-gray-500 text-xs whitespace-nowrap">{formatViewCount(video.view_count) || '—'}</td>
      <td className="py-2 px-3 text-right">
        <button onClick={handleWatchedToggle} disabled={toggling}
          className={`p-1.5 rounded-full transition-colors ${isWatched ? 'text-green-400 hover:text-gray-400' : 'text-gray-700 group-hover:text-gray-500 hover:text-green-400'}`}
          title={isWatched ? 'Mark unwatched' : 'Mark watched'}>
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

export default function CategoryPage({ subscriptions, categories }) {
  const { id } = useParams();
  const categoryId = parseInt(id);

  const category = categories?.find(c => c.id === categoryId);

  const [videos, setVideos] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [hideShorts, setHideShortsRaw] = useState(() => loadBool('pneuma_hide_shorts'));
  const [hideWatched, setHideWatchedRaw] = useState(() => loadBool('pneuma_hide_watched'));
  const [sortBy, setSortByRaw] = useState(() => loadStr('pneuma_sort_by', 'published_at'));
  const [sortOrder, setSortOrderRaw] = useState(() => loadStr('pneuma_sort_order', 'desc'));
  const [viewMode, setViewModeRaw] = useState(() => loadStr('pneuma_view_mode', 'grid'));
  const [error, setError] = useState('');

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
        categoryId: String(categoryId),
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
      setError(err.message || 'Failed to load videos');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [categoryId, hideShorts, hideWatched, debouncedSearch, sortBy, sortOrder]);

  useEffect(() => { loadVideos(1, false); }, [loadVideos]);

  const handleWatchedChange = (videoId, nowWatched) => {
    if (hideWatched && nowWatched) {
      setVideos(prev => prev.filter(v => v.id !== videoId));
      setTotal(prev => prev - 1);
    } else {
      setVideos(prev => prev.map(v => v.id === videoId ? { ...v, is_watched: nowWatched } : v));
    }
  };

  const tablerName = category ? tablerClass(category.icon) : 'folder';

  return (
    <main className="flex-1 min-h-screen flex flex-col">
      {/* Sticky header: category title + filter bar */}
      <div className="sticky top-0 z-10 bg-[#0f0f0f]/95 backdrop-blur border-b border-gray-700">
        {/* Title bar */}
        <div className="flex items-center gap-3 px-6 py-3">
          {category ? (
            <>
              <i className={`ti ti-${tablerName} flex-shrink-0`} style={{ fontSize: 20, color: category.color }} />
              <h1 className="text-white font-semibold text-lg truncate flex-1 min-w-0">{category.name}</h1>
              {!loading && <span className="text-gray-500 text-sm flex-shrink-0">{total.toLocaleString()} video{total !== 1 ? 's' : ''}</span>}
            </>
          ) : (
            <span className="text-gray-500 text-sm">Category not found</span>
          )}
        </div>

        {/* Progress bar */}
        {loading && (
          <div className="h-0.5 w-full bg-gray-800 overflow-hidden">
            <div className="h-full bg-red-500" style={{ width: '40%', animation: 'indeterminate 1.4s ease-in-out infinite' }} />
          </div>
        )}
        <style>{`@keyframes indeterminate{0%{transform:translateX(-100%)}100%{transform:translateX(350%)}}`}</style>

        {/* Filter bar */}
        <div className="px-6 py-3 flex items-center gap-2 flex-wrap border-t border-gray-800">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search videos..."
              className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg pl-8 pr-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-red-600/60 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                <X size={13} />
              </button>
            )}
          </div>

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
            {hideWatched ? <EyeOff size={12} /> : <Eye size={12} />}
            {hideWatched ? 'Show Watched' : 'Hide Watched'}
          </button>

          <div className="flex-1" />

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
            >
              {sortOrder === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
              {sortOrder === 'desc' ? 'Desc' : 'Asc'}
            </button>
          </div>

          <div className="flex items-center bg-[#1a1a1a] border border-gray-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors ${viewMode === 'grid' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}
            >
              <LayoutGrid size={12} /> Grid
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors ${viewMode === 'table' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-white'}`}
            >
              <List size={12} /> Table
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={`${viewMode === 'table' ? 'p-0' : 'p-6'} flex-1`}>
        {error && <div className="m-6 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">{error}</div>}

        {loading ? (
          viewMode === 'grid' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="flex flex-col bg-[#1a1a1a] rounded-lg overflow-hidden animate-pulse">
                  <div className="aspect-video bg-gray-800/60" />
                  <div className="p-3 flex flex-col gap-2">
                    <div className="h-3.5 bg-gray-800/60 rounded w-full" />
                    <div className="h-3.5 bg-gray-800/60 rounded w-3/4" />
                    <div className="h-2.5 bg-gray-800/60 rounded w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-1 p-4">
              {Array.from({ length: 15 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-800/40 rounded animate-pulse" />
              ))}
            </div>
          )
        ) : videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="text-gray-700 mb-3"><Search size={40} /></div>
            <h3 className="text-gray-400 font-medium mb-2">No videos found</h3>
            <p className="text-gray-600 text-sm max-w-sm">
              {debouncedSearch ? `No results for "${debouncedSearch}".` : 'Fetch videos to see content from channels in this category.'}
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
                  <VideoTableRow key={video.id} video={video} onWatchedChange={handleWatchedChange} />
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
                  {loadingMore ? <span className="flex items-center gap-2"><RefreshCw size={14} className="animate-spin" />Loading...</span> : `Load More (${total - videos.length} remaining)`}
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {videos.map(video => (
                <VideoCard key={video.id} video={video} onWatchedChange={handleWatchedChange} videoMode="youtube" />
              ))}
            </div>
            {page < totalPages && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={() => { if (!loadingMore) loadVideos(page + 1, true); }}
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
    </main>
  );
}
