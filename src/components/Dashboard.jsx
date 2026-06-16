import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Scissors, Eye, EyeOff, RefreshCw, X } from 'lucide-react';
import { getVideos, fetchVideos, getFetchStatus } from '../services/api.js';
import VideoCard from './VideoCard.jsx';

function SkeletonCard() {
  return (
    <div className="flex flex-col bg-[#242424] rounded-lg overflow-hidden animate-pulse">
      <div className="aspect-video bg-[#2e2e2e]" />
      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#2e2e2e]" />
          <div className="h-3 bg-[#2e2e2e] rounded w-24" />
        </div>
        <div className="h-4 bg-[#2e2e2e] rounded w-full" />
        <div className="h-4 bg-[#2e2e2e] rounded w-3/4" />
        <div className="h-3 bg-[#2e2e2e] rounded w-20" />
      </div>
    </div>
  );
}

function loadBool(key) {
  try { return localStorage.getItem(key) === 'true'; } catch { return false; }
}
function saveBool(key, val) {
  try { localStorage.setItem(key, String(val)); } catch {}
}

export default function Dashboard({ selectedChannelId, onClearChannel, subscriptions }) {
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
  const [error, setError] = useState('');
  const pollRef = useRef(null);

  const setHideShorts = (val) => { setHideShortsRaw(val); saveBool('pneuma_hide_shorts', val); };
  const setHideWatched = (val) => { setHideWatchedRaw(val); saveBool('pneuma_hide_watched', val); };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const loadVideos = useCallback(async (pageNum = 1, append = false) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);
    setError('');
    try {
      const data = await getVideos({
        page: pageNum,
        limit: 50,
        hideShorts: hideShorts ? 'true' : undefined,
        hideWatched: hideWatched ? 'true' : undefined,
        search: debouncedSearch || undefined,
        channelId: selectedChannelId || undefined,
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
  }, [hideShorts, hideWatched, debouncedSearch, selectedChannelId]);

  useEffect(() => { loadVideos(1, false); }, [loadVideos]);

  // Clean up poll on unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

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
            clearInterval(pollRef.current);
            pollRef.current = null;
            await loadVideos(1, false);
            setFetching(false);
            setFetchProgress(null);
          }
        } catch {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setFetching(false);
          setFetchProgress(null);
        }
      }, 1500);
    } catch (err) {
      console.error('Fetch videos failed:', err);
      setFetching(false);
      setFetchProgress(null);
    }
  };

  const handleLoadMore = () => {
    if (page < totalPages && !loadingMore) loadVideos(page + 1, true);
  };

  const handleWatchedChange = (videoId, nowWatched) => {
    if (hideWatched && nowWatched) {
      setVideos(prev => prev.filter(v => v.id !== videoId));
      setTotal(prev => prev - 1);
    } else {
      setVideos(prev => prev.map(v => v.id === videoId ? { ...v, is_watched: nowWatched } : v));
    }
  };

  const selectedChannel = selectedChannelId
    ? subscriptions.find(s => s.id === selectedChannelId)
    : null;

  const progressPct = fetchProgress?.total > 0
    ? Math.round((fetchProgress.done / fetchProgress.total) * 100)
    : 0;

  return (
    <main className="flex-1 min-h-screen flex flex-col">
      {/* Filter bar */}
      <div className="sticky top-0 z-10 bg-[#0f0f0f]/95 backdrop-blur border-b border-gray-700 px-6 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
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
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Channel filter chip */}
          {selectedChannel && (
            <div className="flex items-center gap-1.5 bg-red-600/20 border border-red-600/40 text-red-400 px-3 py-1.5 rounded-full text-xs">
              <span>{selectedChannel.title}</span>
              <button onClick={onClearChannel} className="hover:text-white"><X size={12} /></button>
            </div>
          )}

          {/* Toggle buttons */}
          <button
            onClick={() => setHideShorts(!hideShorts)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors border ${
              hideShorts
                ? 'bg-red-600/20 border-red-600/50 text-red-400'
                : 'bg-[#1a1a1a] border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
            }`}
          >
            <Scissors size={14} />
            Hide Shorts
          </button>

          <button
            onClick={() => setHideWatched(!hideWatched)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors border ${
              hideWatched
                ? 'bg-indigo-600/20 border-indigo-600/50 text-indigo-400'
                : 'bg-[#1a1a1a] border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
            }`}
          >
            {hideWatched ? <EyeOff size={14} /> : <Eye size={14} />}
            {hideWatched ? 'Show Watched' : 'Hide Watched'}
          </button>

          {/* Fetch button */}
          <button
            onClick={handleFetchVideos}
            disabled={fetching}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-[#1a1a1a] border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={fetching ? 'animate-spin' : ''} />
            {fetching ? 'Fetching...' : 'Fetch Videos'}
          </button>
        </div>

        {/* Fetch progress bar */}
        {fetchProgress && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-gray-400">
                Fetching videos —{' '}
                <span className="text-white font-medium">{fetchProgress.done}</span>
                <span className="text-gray-600"> / {fetchProgress.total} channels</span>
              </span>
              {fetchProgress.errors > 0 && (
                <span className="text-red-400">{fetchProgress.errors} failed</span>
              )}
              <span className="text-gray-500">{progressPct}%</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-red-600 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Stats */}
        {!loading && !fetchProgress && (
          <div className="mt-2 text-xs text-gray-500">
            <span className="text-gray-300 font-medium">{total.toLocaleString()}</span>
            {' '}video{total !== 1 ? 's' : ''}
            {selectedChannel ? <span className="text-gray-600"> from <span className="text-gray-400">{selectedChannel.title}</span></span> : ''}
            {debouncedSearch ? <span className="text-gray-600"> matching <span className="text-gray-400">"{debouncedSearch}"</span></span> : ''}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6 flex-1">
        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="text-gray-700 mb-3"><Search size={40} /></div>
            <h3 className="text-gray-400 font-medium mb-2">No videos found</h3>
            <p className="text-gray-600 text-sm max-w-sm">
              {debouncedSearch
                ? `No results for "${debouncedSearch}". Try a different search.`
                : 'Click "Fetch Videos" to import recent videos from your subscriptions.'
              }
            </p>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {videos.map(video => (
                <VideoCard key={video.id} video={video} onWatchedChange={handleWatchedChange} />
              ))}
            </div>

            {page < totalPages && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-6 py-3 bg-[#1a1a1a] border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {loadingMore ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw size={14} className="animate-spin" />
                      Loading...
                    </span>
                  ) : (
                    `Load More (${total - videos.length} remaining)`
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
