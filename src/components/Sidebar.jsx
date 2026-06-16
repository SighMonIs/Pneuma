import { useState, useMemo, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Clock, Settings, RefreshCw, Search,
  ChevronDown, ChevronRight, Star,
} from 'lucide-react';
import ChannelSettingsModal from './ChannelSettingsModal.jsx';
import { syncSubscriptions, updateSubscription } from '../services/api.js';

function tablerClass(iconName) {
  if (!iconName) return 'folder';
  if (iconName === iconName.toLowerCase() || iconName.includes('-')) return iconName;
  return iconName.replace(/([A-Z])/g, (m, p1, offset) => (offset > 0 ? '-' : '') + p1.toLowerCase());
}

function loadBool(key, def = false) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? def : v === 'true';
  } catch { return def; }
}
function saveBool(key, val) {
  try { localStorage.setItem(key, String(val)); } catch {}
}

export default function Sidebar({ subscriptions, categories, onDataChange, selectedCategoryId, onSelectCategory, authStatus }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [channelSettingsModal, setChannelSettingsModal] = useState(null);
  const showWatchedBadge = loadBool('pneuma_show_watched_badge', true);

  const isActive = (path) => location.pathname === path;

  // All categories expanded by default; persist toggled state
  const [expandedCategories, setExpandedCategories] = useState(() => {
    try {
      const saved = localStorage.getItem('pneuma_sidebar_expanded');
      if (saved) return new Set(JSON.parse(saved));
    } catch {}
    return null; // null = "all expanded" sentinel
  });

  const sortedCategories = useMemo(() =>
    [...categories].sort((a, b) => a.sort_order - b.sort_order),
    [categories]
  );

  // Initialise expansion to all-open on first render or when categories change
  useEffect(() => {
    if (expandedCategories === null && sortedCategories.length > 0) {
      setExpandedCategories(new Set(sortedCategories.map(c => c.id)));
    }
  }, [sortedCategories, expandedCategories]);

  const persistExpanded = (next) => {
    try { localStorage.setItem('pneuma_sidebar_expanded', JSON.stringify([...next])); } catch {}
    setExpandedCategories(next);
  };

  const toggleCategory = (catId) => {
    setExpandedCategories(prev => {
      const current = prev || new Set(sortedCategories.map(c => c.id));
      const next = new Set(current);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      persistExpanded(next);
      return next;
    });
  };

  const expandAll = () => persistExpanded(new Set(sortedCategories.map(c => c.id)));
  const collapseAll = () => persistExpanded(new Set());
  const allExpanded = expandedCategories !== null && sortedCategories.every(c => expandedCategories.has(c.id));

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncSubscriptions();
      await onDataChange();
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleFavourite = async (e, sub) => {
    e.stopPropagation();
    e.preventDefault();
    const next = !sub.is_favourite;
    try {
      await updateSubscription(sub.id, { is_favourite: next });
      await onDataChange();
    } catch (err) {
      console.error('Toggle favourite failed:', err);
    }
  };

  const { categorizedChannels, uncategorized } = useMemo(() => {
    const catMap = {};
    categories.forEach(c => { catMap[c.id] = []; });
    const uncat = [];
    subscriptions.forEach(sub => {
      const catIds = sub.category_ids || [];
      if (catIds.length === 0) {
        uncat.push(sub);
      } else {
        catIds.forEach(cid => { if (catMap[cid]) catMap[cid].push(sub); });
      }
    });
    return { categorizedChannels: catMap, uncategorized: uncat };
  }, [subscriptions, categories]);

  const favourites = useMemo(() =>
    subscriptions.filter(s => s.is_favourite),
    [subscriptions]
  );

  const [favouritesExpanded, setFavouritesExpanded] = useState(true);

  const filterChannel = (sub) => {
    if (!search.trim()) return true;
    return sub.title?.toLowerCase().includes(search.toLowerCase());
  };

  const expanded = expandedCategories || new Set();

  return (
    <aside className="fixed top-0 left-0 bottom-0 w-[260px] bg-[#1a1a1a] border-r border-gray-700 flex flex-col z-10">
      {/* Logo */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <i className="ti ti-device-tv text-white" style={{ fontSize: 16 }} />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">Pneuma</span>
        </div>
      </div>

      {/* Nav links */}
      <nav className="p-2 border-b border-gray-700">
        <Link
          to="/"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            isActive('/') ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#242424]'
          }`}
        >
          <LayoutDashboard size={16} />
          Dashboard
        </Link>
        <Link
          to="/scheduler"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            isActive('/scheduler') ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#242424]'
          }`}
        >
          <Clock size={16} />
          Scheduler
        </Link>
        <Link
          to="/settings"
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            isActive('/settings') ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#242424]'
          }`}
        >
          <Settings size={16} />
          Settings
        </Link>
      </nav>

      {/* Channels header + search */}
      <div className="p-3 border-b border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Channels</span>
            <span className="bg-gray-800 text-gray-300 rounded-full px-2 py-0.5 text-[10px] font-medium border border-gray-700">
              {subscriptions.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={allExpanded ? collapseAll : expandAll}
              className="text-gray-500 hover:text-white p-1 rounded hover:bg-[#242424] transition-colors text-[10px] font-medium"
              title={allExpanded ? 'Collapse all' : 'Expand all'}
            >
              {allExpanded ? '−' : '+'}
            </button>
            {authStatus?.hasCookies && (
              <button
                onClick={handleSync}
                disabled={syncing}
                className="text-gray-500 hover:text-white p-1 rounded hover:bg-[#242424] transition-colors"
                title="Sync subscriptions"
              >
                <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              </button>
            )}
          </div>
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-600" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search channels..."
            className="w-full bg-[#242424] border border-gray-700 rounded-lg pl-7 pr-3 py-1.5 text-white placeholder-gray-600 text-xs focus:outline-none focus:border-gray-600"
          />
        </div>
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto py-1">
        {/* Favourites virtual category */}
        {favourites.length > 0 && (
          <div>
            <div className="flex items-center gap-2 w-full px-4 py-1.5 hover:bg-[#242424] transition-colors">
              <button
                className="flex items-center gap-2 flex-1 text-left min-w-0"
                onClick={() => { onSelectCategory?.(null); navigate('/'); }}
              >
                <Star size={14} className="flex-shrink-0 text-yellow-400" fill="currentColor" />
                <span className="text-white text-sm font-semibold flex-1 truncate">Favourites</span>
                <span className="bg-gray-800 text-gray-400 rounded px-1.5 py-0.5 text-[10px] border border-gray-700/50 flex-shrink-0">
                  {favourites.length}
                </span>
              </button>
              <button onClick={() => setFavouritesExpanded(v => !v)} className="flex-shrink-0 p-0.5 text-gray-600 hover:text-gray-400">
                {favouritesExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
            </div>
            {favouritesExpanded && favourites.filter(filterChannel).map(sub => (
              <ChannelRow
                key={sub.id}
                channel={sub}
                onSettings={() => setChannelSettingsModal(sub)}
                onToggleFavourite={handleToggleFavourite}
                showWatchedBadge={showWatchedBadge}
                indent
              />
            ))}
          </div>
        )}

        {/* Category groups */}
        {sortedCategories.map((cat) => {
          const channels = (categorizedChannels[cat.id] || []).filter(filterChannel);
          const allChannels = categorizedChannels[cat.id] || [];
          const isExpanded = expanded.has(cat.id);
          const tablerName = tablerClass(cat.icon);

          return (
            <div key={cat.id}>
              <div className={`flex items-center gap-2 w-full px-4 py-1.5 transition-colors ${selectedCategoryId === cat.id ? 'bg-[#2e2e2e]' : 'hover:bg-[#242424]'}`}>
                <button
                  className="flex items-center gap-2 flex-1 text-left min-w-0"
                  onClick={() => { onSelectCategory?.(selectedCategoryId === cat.id ? null : cat.id); navigate('/'); }}
                >
                  <i className={`ti ti-${tablerName} flex-shrink-0`} style={{ fontSize: 14, color: cat.color }} />
                  <span className="text-white text-sm font-semibold flex-1 truncate">{cat.name}</span>
                  <span className="bg-gray-800 text-gray-400 rounded px-1.5 py-0.5 text-[10px] border border-gray-700/50 flex-shrink-0">
                    {allChannels.length}
                  </span>
                </button>
                <button onClick={() => toggleCategory(cat.id)} className="flex-shrink-0 p-0.5 text-gray-600 hover:text-gray-400">
                  {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
              </div>

              {isExpanded && channels.map(sub => (
                <ChannelRow
                  key={sub.id}
                  channel={sub}
                  onSettings={() => setChannelSettingsModal(sub)}
                  onToggleFavourite={handleToggleFavourite}
                  showWatchedBadge={showWatchedBadge}
                  indent
                />
              ))}
            </div>
          );
        })}

        {/* Uncategorized */}
        {uncategorized.filter(filterChannel).length > 0 && (
          <div>
            <div className="px-4 py-1.5 flex items-center gap-2">
              <span className="text-gray-500 text-xs font-medium uppercase tracking-wider">Uncategorized</span>
              <span className="bg-gray-800 text-gray-400 rounded px-1.5 py-0.5 text-[10px] border border-gray-700/50">{uncategorized.length}</span>
            </div>
            {uncategorized.filter(filterChannel).map(sub => (
              <ChannelRow
                key={sub.id}
                channel={sub}
                onSettings={() => setChannelSettingsModal(sub)}
                onToggleFavourite={handleToggleFavourite}
                showWatchedBadge={showWatchedBadge}
              />
            ))}
          </div>
        )}

        {subscriptions.length === 0 && (
          <div className="px-4 py-6 text-center">
            <p className="text-gray-600 text-xs">No subscriptions yet.</p>
            <p className="text-gray-700 text-xs mt-1">Go to Settings to add channels.</p>
          </div>
        )}
      </div>

      {channelSettingsModal && (
        <ChannelSettingsModal
          channel={channelSettingsModal}
          categories={categories}
          onSave={onDataChange}
          onClose={() => setChannelSettingsModal(null)}
        />
      )}
    </aside>
  );
}

function ChannelRow({ channel, onSettings, onToggleFavourite, showWatchedBadge, indent }) {
  const location = useLocation();
  const isActive = location.pathname === `/channel/${channel.id}`;

  return (
    <Link
      to={`/channel/${channel.id}`}
      className={`flex items-center gap-2 py-1.5 group rounded-lg mx-1 transition-colors ${
        isActive ? 'bg-[#2e2e2e]' : 'hover:bg-[#242424]'
      } ${indent ? 'pl-7 pr-3' : 'px-4'}`}
    >
      {channel.thumbnail_url ? (
        <img
          src={channel.thumbnail_url}
          alt={channel.title}
          className={`w-6 h-6 rounded-full object-cover flex-shrink-0 ${channel.is_favourite ? 'ring-1 ring-yellow-400' : ''}`}
        />
      ) : (
        <div className={`w-6 h-6 rounded-full bg-gray-700 flex-shrink-0 flex items-center justify-center ${channel.is_favourite ? 'ring-1 ring-yellow-400' : ''}`}>
          <span className="text-gray-400 text-xs">{channel.title?.charAt(0) || '?'}</span>
        </div>
      )}
      <span className="text-gray-300 text-xs truncate flex-1">{channel.title}</span>

      {/* Watched count badge */}
      {showWatchedBadge && channel.watched_count > 0 && (
        <span className="text-[10px] text-gray-600 bg-gray-800 rounded px-1 py-0.5 flex-shrink-0 border border-gray-700/50">
          {channel.watched_count}
        </span>
      )}

      {/* Favourite + settings (shown on hover) */}
      <button
        onClick={(e) => onToggleFavourite(e, channel)}
        className={`hidden group-hover:flex items-center text-xs p-0.5 rounded flex-shrink-0 transition-colors ${
          channel.is_favourite ? 'text-yellow-400' : 'text-gray-600 hover:text-yellow-400'
        }`}
        title={channel.is_favourite ? 'Remove favourite' : 'Add to favourites'}
      >
        <Star size={10} fill={channel.is_favourite ? 'currentColor' : 'none'} />
      </button>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSettings(); }}
        className="hidden group-hover:flex items-center text-gray-600 hover:text-gray-400 p-0.5 rounded flex-shrink-0"
        title="Channel settings"
      >
        <Settings size={11} />
      </button>
    </Link>
  );
}
