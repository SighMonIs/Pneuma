import { useState, useMemo } from 'react';
import { X, Search } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

const ICON_NAMES = [
  'Folder', 'FolderOpen', 'Star', 'Heart', 'Bookmark', 'Tag', 'Music', 'Film',
  'Gamepad2', 'Code2', 'BookOpen', 'Newspaper', 'Trophy', 'Flame', 'Zap',
  'Globe', 'Home', 'User', 'Users', 'Coffee', 'Camera', 'Mic', 'Radio', 'Tv',
  'Monitor', 'Headphones', 'Podcast', 'ChefHat', 'Car', 'Plane', 'Bike',
  'Dumbbell', 'Palette', 'Scissors', 'Wrench', 'Package', 'ShoppingCart',
  'DollarSign', 'TrendingUp', 'BarChart2', 'PieChart', 'Briefcase',
  'GraduationCap', 'FlaskConical', 'Leaf', 'Mountain', 'Sun', 'Cloud', 'Moon',
  'Sparkles', 'Laugh', 'Smile', 'ThumbsUp', 'Clock', 'Calendar', 'Map',
  'Compass', 'Anchor', 'Shield', 'Award', 'Gift', 'Bell', 'Flag',
];

const PRESET_COLORS = [
  '#6366f1', // indigo
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#8b5cf6', // violet
  '#ec4899', // pink
];

export default function CategoryModal({ category, onSave, onClose }) {
  const [name, setName] = useState(category?.name || '');
  const [selectedIcon, setSelectedIcon] = useState(category?.icon || 'Folder');
  const [color, setColor] = useState(category?.color || '#6366f1');
  const [iconSearch, setIconSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const filteredIcons = useMemo(() => {
    if (!iconSearch.trim()) return ICON_NAMES;
    return ICON_NAMES.filter(name =>
      name.toLowerCase().includes(iconSearch.toLowerCase())
    );
  }, [iconSearch]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({ name: name.trim(), icon: selectedIcon, color });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-semibold text-lg">
            {category ? 'Edit Category' : 'New Category'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          {/* Name */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Category name"
              className="w-full bg-[#242424] border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-gray-500"
              autoFocus
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full border-2 transition-all"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? 'white' : 'transparent',
                    transform: color === c ? 'scale(1.15)' : 'scale(1)',
                  }}
                  title={c}
                />
              ))}
              <div className="flex items-center gap-2 ml-1">
                <input
                  type="color"
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  className="w-7 h-7 rounded cursor-pointer bg-transparent border border-gray-600"
                  title="Custom color"
                />
                <span className="text-xs text-gray-500">{color}</span>
              </div>
            </div>
          </div>

          {/* Icon picker */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Icon</label>
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={iconSearch}
                onChange={e => setIconSearch(e.target.value)}
                placeholder="Search icons..."
                className="w-full bg-[#242424] border border-gray-700 rounded-lg pl-8 pr-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-gray-500"
              />
            </div>
            <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto bg-[#242424] rounded-lg p-2 border border-gray-700">
              {filteredIcons.map(iconName => {
                const Icon = LucideIcons[iconName];
                if (!Icon) return null;
                const isSelected = selectedIcon === iconName;
                return (
                  <button
                    key={iconName}
                    onClick={() => setSelectedIcon(iconName)}
                    title={iconName}
                    className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                      isSelected
                        ? 'bg-indigo-600 text-white'
                        : 'text-gray-400 hover:bg-[#2e2e2e] hover:text-white'
                    }`}
                    style={isSelected ? { backgroundColor: color } : {}}
                  >
                    <Icon size={16} />
                  </button>
                );
              })}
              {filteredIcons.length === 0 && (
                <p className="col-span-8 text-center text-gray-500 text-xs py-4">No icons found</p>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">Selected: {selectedIcon}</p>
          </div>

          {/* Preview */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Preview</label>
            <div className="flex items-center gap-2 bg-[#242424] rounded-lg px-3 py-2 border border-gray-700">
              {(() => {
                const Icon = LucideIcons[selectedIcon];
                return Icon ? (
                  <Icon size={16} style={{ color }} />
                ) : null;
              })()}
              <span className="text-white text-sm">{name || 'Category name'}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-800 flex flex-col gap-3">
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
