import { useState, useEffect, useCallback } from 'react';
import { Search, Scissors, Eye, EyeOff, RefreshCw, X } from 'lucide-react';
import { getVideos, fetchVideos } from '../services/api.js';
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

export default function Dashboard({ selectedChannelId, onClearChannel, subscriptions }) {
  const [videos, setVideos] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [hideShorts, setHideShorts] = useState(false);
  const [hideWatched, setHideWatched] = useState(false);
  const [error, setError] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const loadVideos = useCallback(async (pageNum = 1, append = false) => {
    if (pageNum === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError('');

    try {
      const params = {
        page: pageNum,
        limit: 50,
        hideShorts: hideShorts ? 'true' : undefined,
        hideWatched: hideWatched ? 'true' : undefined,
        search: debouncedSearch || undefined,
        channelId: selectedChannelId || undefined,
      };

      const data = await getVideos(params);

      if (append) {
        setVideos(prev => [...prev, ...data.videos]);
      } else {
        setVideos(data.videos);
      }

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

  // Reset and reload when filters change
  useEffect(() => {
    loadVideos(1, false);
  }, [loadVideos]);

  const handleFetchVideos = async () => {
    setFetching(true);
    try {
      const result = await fetchVideos();
      await loadVideos(1, false);
    } catch (err) {
      console.error('Fetch videos failed:', err);
    } finally {
      setFetching(false);
    }
  };

  const handleLoadMore = () => {
    if (page < totalPages && !loadingMore) {
      loadVideos(page + 1, true);
    }
  };

  const handleWatchedChange = (videoId, nowWatched) => {
    if (hideWatched && nowWatched) {
      // Remove from list if hiding watched
      setVideos(prev => prev.filter(v => v.id !== videoId));
      setTotal(prev => prev - 1);
    } else {
      setVideos(prev =>
        prev.map(v => v.id === videoId ? { ...v, is_watched: nowWatched } : v)
      );
    }
  };

  // Get selected channel name
  const selectedChannel = selectedChannelId
    ? subscriptions.find(s => s.id === selectedChannelId)
    : null;

  return (
    <main className="flex-1 min-h-screen flex flex-col">
      {/* Filter bar */}
      <div className="sticky top-0 z-10 bg-[#0f0f0f]/95 backdrop-blur border-b border-gray-800 px-6 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search videos, channels..."
              className="w-full bg-[#1a1a1a] border border-gray-800 rounded-lg pl-9 pr-3 py-2 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-gray-600"
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
            <div className="flex items-center gap-1.5 bg-red-600/20 border border-red-600/30 text-red-400 px-3 py-1.5 rounded-full text-xs">
              <span>{selectedChannel.title}</span>
              <button onClick={onClearChannel} className="hover:text-white">
                <X size={12} />
              </button>
            </div>
          )}

          {/* Toggle buttons */}
          <button
            onClick={() => setHideShorts(!hideShorts)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors border ${
              hideShorts
                ? 'bg-red-600/20 border-red-600/40 text-red-400'
                : 'bg-[#1a1a1a] border-gray-800 text-gray-400 hover:text-white hover:border-gray-600'
            }`}
          >
            <Scissors size={14} />
            Hide Shorts
          </button>

          <button
            onClick={() => setHideWatched(!hideWatched)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors border ${
              hideWatched
                ? 'bg-indigo-600/20 border-indigo-600/40 text-indigo-400'
                : 'bg-[#1a1a1a] border-gray-800 text-gray-400 hover:text-white hover:border-gray-600'
            }`}
          >
            {hideWatched ? <EyeOff size={14} /> : <Eye size={14} />}
            {hideWatched ? 'Show Watched' : 'Hide Watched'}
          </button>

          {/* Fetch button */}
          <button
            onClick={handleFetchVideos}
            disabled={fetching}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-[#1a1a1a] border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={fetching ? 'animate-spin' : ''} />
            {fetching ? 'Fetching...' : 'Fetch Videos'}
          </button>
        </div>

        {/* Stats */}
        {!loading && (
          <div className="mt-2 text-xs text-gray-600">
            {total.toLocaleString()} video{total !== 1 ? 's' : ''}
            {selectedChannel ? ` from ${selectedChannel.title}` : ''}
            {debouncedSearch ? ` matching "${debouncedSearch}"` : ''}
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
            <div className="text-gray-700 mb-3">
              <Search size={40} />
            </div>
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
                <VideoCard
                  key={video.id}
                  video={video}
                  onWatchedChange={handleWatchedChange}
                />
              ))}
            </div>

            {/* Load More */}
            {page < totalPages && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-6 py-3 bg-[#1a1a1a] border border-gray-800 text-gray-300 hover:text-white hover:border-gray-600 rounded-lg text-sm transition-colors disabled:opacity-50"
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
