import { useState, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Clock, Settings, RefreshCw, Search,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import ChannelSettingsModal from './ChannelSettingsModal.jsx';
import { syncSubscriptions } from '../services/api.js';

export default function Sidebar({ subscriptions, categories, onDataChange, selectedChannelId, onSelectChannel, selectedCategoryId, onSelectCategory, authStatus }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [channelSettingsModal, setChannelSettingsModal] = useState(null);

  const isActive = (path) => location.pathname === path;

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

  const toggleCategory = (catId) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
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

  const filterChannel = (sub) => {
    if (!search.trim()) return true;
    return sub.title?.toLowerCase().includes(search.toLowerCase());
  };

  const sortedCategories = useMemo(() =>
    [...categories].sort((a, b) => a.sort_order - b.sort_order),
    [categories]
  );

  return (
    <aside className="fixed top-0 left-0 bottom-0 w-[260px] bg-[#1a1a1a] border-r border-gray-700 flex flex-col z-10">
      {/* Logo */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <LucideIcons.Tv2 size={16} className="text-white" />
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
          onClick={() => onSelectChannel(null)}
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

      {/* Subscriptions header + search */}
      <div className="p-3 border-b border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Channels</span>
            <span className="bg-gray-800 text-gray-300 rounded-full px-2 py-0.5 text-[10px] font-medium border border-gray-700">
              {subscriptions.length}
            </span>
          </div>
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
        {sortedCategories.map((cat) => {
          const Icon = LucideIcons[cat.icon] || LucideIcons.Folder;
          const channels = (categorizedChannels[cat.id] || []).filter(filterChannel);
          const allChannels = categorizedChannels[cat.id] || [];
          const isExpanded = expandedCategories.has(cat.id);

          return (
            <div key={cat.id}>
              <div className={`flex items-center gap-2 w-full px-4 py-1.5 transition-colors ${selectedCategoryId === cat.id ? 'bg-[#2e2e2e]' : 'hover:bg-[#242424]'}`}>
                <button
                  className="flex items-center gap-2 flex-1 text-left min-w-0"
                  onClick={() => { onSelectCategory?.(selectedCategoryId === cat.id ? null : cat.id); navigate('/'); }}
                >
                  <Icon size={14} style={{ color: cat.color }} className="flex-shrink-0" />
                  <span className="text-white text-sm font-semibold flex-1 truncate">{cat.name}</span>
                  <span className="bg-gray-800 text-gray-400 rounded px-1.5 py-0.5 text-[10px] border border-gray-700/50 flex-shrink-0">
                    {allChannels.length}
                  </span>
                </button>
                <button onClick={() => toggleCategory(cat.id)} className="flex-shrink-0 p-0.5 text-gray-600 hover:text-gray-400">
                  {isExpanded
                    ? <ChevronDown size={12} />
                    : <ChevronRight size={12} />
                  }
                </button>
              </div>

              {isExpanded && channels.map(sub => (
                <ChannelRow
                  key={sub.id}
                  channel={sub}
                  categories={categories}
                  isSelected={selectedChannelId === sub.id}
                  onSelect={() => onSelectChannel(selectedChannelId === sub.id ? null : sub.id)}
                  onSettings={() => setChannelSettingsModal(sub)}
                  indent
                />
              ))}
            </div>
          );
        })}

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
                categories={categories}
                isSelected={selectedChannelId === sub.id}
                onSelect={() => onSelectChannel(selectedChannelId === sub.id ? null : sub.id)}
                onSettings={() => setChannelSettingsModal(sub)}
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

function ChannelRow({ channel, categories, isSelected, onSelect, onSettings, indent }) {
  return (
    <div
      className={`flex items-center gap-2 py-1.5 group cursor-pointer rounded-lg mx-1 transition-colors ${
        isSelected ? 'bg-[#2e2e2e]' : 'hover:bg-[#242424]'
      } ${indent ? 'pl-7 pr-3' : 'px-4'}`}
      onClick={onSelect}
    >
      {channel.thumbnail_url ? (
        <img src={channel.thumbnail_url} alt={channel.title} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
      ) : (
        <div className="w-6 h-6 rounded-full bg-gray-700 flex-shrink-0 flex items-center justify-center">
          <span className="text-gray-400 text-xs">{channel.title?.charAt(0) || '?'}</span>
        </div>
      )}
      <span className="text-gray-300 text-xs truncate flex-1">{channel.title}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onSettings(); }}
        className="hidden group-hover:block text-gray-600 hover:text-gray-400 p-0.5 rounded flex-shrink-0"
        title="Channel settings"
      >
        <Settings size={12} />
      </button>
    </div>
  );
}
