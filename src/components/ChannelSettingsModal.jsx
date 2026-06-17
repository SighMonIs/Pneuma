import { useState, useEffect } from 'react';
import { X, Plus, RotateCcw, Calendar } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { updateSubscription, updateChannelCategories, createCategory, getSettings } from '../services/api.js';
import CategoryModal from './CategoryModal.jsx';
import { FetchSincePicker } from './SettingsPage.jsx';

function fetchSummaryLabel(mode, date) {
  if (mode === 'added') return 'from when added';
  if (mode === 'beginning') return 'from the beginning';
  if (mode === 'date' && date) return `from ${date}`;
  return mode;
}

export default function ChannelSettingsModal({ channel, categories, onSave, onClose }) {
  const [hideShorts, setHideShorts] = useState(channel.hide_shorts || false);
  const [selectedCategories, setSelectedCategories] = useState(
    new Set(channel.category_ids || [])
  );
  const [localCategories, setLocalCategories] = useState(categories);
  const [showNewCatModal, setShowNewCatModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [fetchMode, setFetchMode] = useState(channel.fetch_since_mode || 'default');
  const [fetchDate, setFetchDate] = useState(channel.fetch_since_date || '');
  const [globalSettings, setGlobalSettings] = useState(null);

  useEffect(() => {
    getSettings().then(s => setGlobalSettings(s)).catch(() => {});
  }, []);

  const globalSummary = globalSettings
    ? fetchSummaryLabel(globalSettings.fetch_since_mode, globalSettings.fetch_since_date)
    : '';

  const toggleCategory = (categoryId) => {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const handleCreateCategory = async (data) => {
    const newCat = await createCategory(data);
    setLocalCategories(prev => [...prev, newCat]);
    setSelectedCategories(prev => new Set([...prev, newCat.id]));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await updateSubscription(channel.id, {
        hide_shorts: hideShorts,
        fetch_since_mode: fetchMode,
        fetch_since_date: fetchMode === 'date' ? fetchDate : null,
      });
      await updateChannelCategories(channel.id, Array.from(selectedCategories));
      onSave();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl w-full max-w-sm flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800 flex-shrink-0">
          <h2 className="text-white font-semibold">Channel Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white p-1 rounded-lg hover:bg-gray-800"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-5 overflow-y-auto">
          {/* Channel info */}
          <div className="flex items-center gap-3">
            {channel.thumbnail_url ? (
              <img
                src={channel.thumbnail_url}
                alt={channel.title}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                <span className="text-gray-400 text-xs">
                  {channel.title?.charAt(0)?.toUpperCase() || '?'}
                </span>
              </div>
            )}
            <div>
              <p className="text-white font-medium text-sm">{channel.title}</p>
              {channel.custom_url && (
                <p className="text-gray-500 text-xs">{channel.custom_url}</p>
              )}
            </div>
          </div>

          {/* Hide Shorts toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-medium">Hide Shorts</p>
              <p className="text-gray-500 text-xs mt-0.5">Hide short videos from this channel</p>
            </div>
            <button
              onClick={() => setHideShorts(!hideShorts)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full ${
                hideShorts ? 'bg-red-600' : 'bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ${
                  hideShorts ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Fetch range */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-gray-500" />
                <p className="text-white text-sm font-medium">Fetch videos from</p>
              </div>
              {fetchMode !== 'default' && (
                <button
                  onClick={() => { setFetchMode('default'); setFetchDate(''); }}
                  className="flex items-center gap-1 text-gray-500 hover:text-gray-300 text-xs"
                  title="Reset to default"
                >
                  <RotateCcw size={11} />
                  Reset to default
                </button>
              )}
            </div>
            <FetchSincePicker
              mode={fetchMode}
              date={fetchDate}
              onModeChange={setFetchMode}
              onDateChange={setFetchDate}
              showDefault
              defaultSummary={globalSummary}
            />
          </div>

          {/* Category assignments */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-white text-sm font-medium">Categories</p>
              <button
                onClick={() => setShowNewCatModal(true)}
                className="text-gray-500 hover:text-white p-1 rounded hover:bg-gray-800"
                title="New category"
              >
                <Plus size={14} />
              </button>
            </div>
            {localCategories.length > 0 ? (
              <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                {localCategories.map(cat => {
                  const Icon = LucideIcons[cat.icon] || LucideIcons.Folder;
                  const isChecked = selectedCategories.has(cat.id);
                  return (
                    <label
                      key={cat.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#242424] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleCategory(cat.id)}
                        className="w-4 h-4 accent-indigo-500 rounded"
                      />
                      <Icon size={14} style={{ color: cat.color }} />
                      <span className="text-gray-300 text-sm">{cat.name}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-600 text-xs px-1">No categories yet. Click + to create one.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-800 flex flex-col gap-3 flex-shrink-0">
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || (fetchMode === 'date' && !fetchDate)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {showNewCatModal && (
        <CategoryModal
          category={null}
          onSave={handleCreateCategory}
          onClose={() => setShowNewCatModal(false)}
        />
      )}
    </div>
  );
}
