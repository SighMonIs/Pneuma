import { useState } from 'react';
import {
  Cookie, FileSpreadsheet, Plus, RefreshCw, Trash2,
  Check, Upload, ArrowRight, AlertCircle, Monitor, Rss, Tag,
  ChevronUp, ChevronDown, Settings,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import {
  saveCookies, deleteCookies, importCsv, addChannel, syncSubscriptions,
  createCategory, updateCategory, deleteCategory, reorderCategory,
} from '../services/api.js';
import CategoryModal from './CategoryModal.jsx';

const TABS = [
  { id: 'display', label: 'Display', icon: Monitor },
  { id: 'feeds', label: 'Feeds', icon: Rss },
  { id: 'categories', label: 'Categories', icon: Tag },
];

export default function SettingsPage({ authStatus, onAuthChange, onDataChange, categories }) {
  const [activeTab, setActiveTab] = useState('display');

  return (
    <main className="flex-1 p-8 max-w-2xl">
      <h1 className="text-white text-2xl font-bold mb-6">Settings</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 border-b border-gray-700">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === id
                ? 'border-red-500 text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'display' && <DisplayTab />}
      {activeTab === 'feeds' && (
        <FeedsTab authStatus={authStatus} onAuthChange={onAuthChange} onDataChange={onDataChange} />
      )}
      {activeTab === 'categories' && (
        <CategoriesTab categories={categories} onDataChange={onDataChange} />
      )}
    </main>
  );
}

/* ─── Display Tab ─── */

function loadStr(key, def) {
  try { return localStorage.getItem(key) ?? def; } catch { return def; }
}
function saveStr(key, val) {
  try { localStorage.setItem(key, val); } catch {}
}

function DisplayTab() {
  const [videoMode, setVideoModeRaw] = useState(() => loadStr('pneuma_video_mode', 'youtube'));
  const [showComments, setShowCommentsRaw] = useState(() => loadStr('pneuma_show_comments', 'false') === 'true');

  const setVideoMode = (val) => { setVideoModeRaw(val); saveStr('pneuma_video_mode', val); };
  const setShowComments = (val) => { setShowCommentsRaw(val); saveStr('pneuma_show_comments', String(val)); };

  return (
    <div className="flex flex-col gap-6">
      <SectionCard title="Video Playback" description="Choose what happens when you click on a video" icon={Monitor}>
        <div className="flex flex-col gap-2">
          {[
            { value: 'youtube', label: 'Open in YouTube', desc: 'Opens the video in a new tab on youtube.com' },
            { value: 'embed', label: 'Embedded player', desc: 'Plays the video in an overlay without leaving the app' },
          ].map(opt => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                videoMode === opt.value
                  ? 'border-red-600/50 bg-red-600/10'
                  : 'border-gray-700 hover:border-gray-600 bg-[#242424]'
              }`}
            >
              <input
                type="radio"
                name="videoMode"
                value={opt.value}
                checked={videoMode === opt.value}
                onChange={() => setVideoMode(opt.value)}
                className="mt-0.5 accent-red-500"
              />
              <div>
                <p className="text-white text-sm font-medium">{opt.label}</p>
                <p className="text-gray-500 text-xs mt-0.5">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>

        {videoMode === 'embed' && (
          <div className="mt-4 flex items-center justify-between p-3 bg-[#242424] border border-gray-700 rounded-lg">
            <div>
              <p className="text-white text-sm font-medium">Show comments button</p>
              <p className="text-gray-500 text-xs mt-0.5">
                Show a "View on YouTube" link in the player for accessing comments
              </p>
            </div>
            <button
              onClick={() => setShowComments(!showComments)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-4 ${
                showComments ? 'bg-red-600' : 'bg-gray-700'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${showComments ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/* ─── Feeds Tab ─── */

function FeedsTab({ authStatus, onAuthChange, onDataChange }) {
  return (
    <div className="flex flex-col gap-6">
      <CookiesSection authStatus={authStatus} onAuthChange={onAuthChange} onDataChange={onDataChange} />
      <AddChannelSection onDataChange={onDataChange} />
      <ImportCsvSection onDataChange={onDataChange} />
    </div>
  );
}

/* ─── Categories Tab ─── */

function CategoriesTab({ categories, onDataChange }) {
  const [showModal, setShowModal] = useState(false);
  const [editingCat, setEditingCat] = useState(null);

  const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order);

  const handleSave = async (data) => {
    if (editingCat) {
      await updateCategory(editingCat.id, data);
    } else {
      await createCategory(data);
    }
    await onDataChange();
  };

  const handleDelete = async (cat) => {
    if (!confirm(`Delete "${cat.name}"? Channels will become uncategorized.`)) return;
    await deleteCategory(cat.id);
    await onDataChange();
  };

  const handleReorder = async (cat, direction) => {
    const idx = sorted.findIndex(c => c.id === cat.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const swap = sorted[swapIdx];
    await Promise.all([
      reorderCategory(cat.id, swap.sort_order),
      reorderCategory(swap.id, cat.sort_order),
    ]);
    await onDataChange();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-gray-400 text-sm">{categories.length} categor{categories.length === 1 ? 'y' : 'ies'}</p>
        <button
          onClick={() => { setEditingCat(null); setShowModal(true); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={14} />
          New Category
        </button>
      </div>

      {categories.length === 0 ? (
        <div className="bg-[#1a1a1a] border border-gray-700 rounded-xl p-8 text-center">
          <Tag size={32} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No categories yet.</p>
          <p className="text-gray-600 text-xs mt-1">Create one to organise your channels.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((cat, idx) => {
            const Icon = LucideIcons[cat.icon] || LucideIcons.Folder;
            return (
              <div
                key={cat.id}
                className="flex items-center gap-3 bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3"
              >
                <Icon size={16} style={{ color: cat.color }} className="flex-shrink-0" />
                <span className="text-white text-sm font-medium flex-1">{cat.name}</span>
                <span className="text-gray-600 text-xs">{cat.channel_count ?? 0} channel{cat.channel_count !== 1 ? 's' : ''}</span>

                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={() => handleReorder(cat, 'up')}
                    disabled={idx === 0}
                    className="text-gray-600 hover:text-gray-400 p-1 rounded disabled:opacity-30 transition-colors"
                    title="Move up"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    onClick={() => handleReorder(cat, 'down')}
                    disabled={idx === sorted.length - 1}
                    className="text-gray-600 hover:text-gray-400 p-1 rounded disabled:opacity-30 transition-colors"
                    title="Move down"
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button
                    onClick={() => { setEditingCat(cat); setShowModal(true); }}
                    className="text-gray-600 hover:text-gray-300 p-1 rounded transition-colors ml-1"
                    title="Edit"
                  >
                    <Settings size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(cat)}
                    className="text-gray-600 hover:text-red-400 p-1 rounded transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <CategoryModal
          category={editingCat}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingCat(null); }}
        />
      )}
    </div>
  );
}

/* ─── Shared helpers ─── */

function SectionCard({ title, description, icon: Icon, children }) {
  return (
    <div className="bg-[#1a1a1a] border border-gray-700 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-[#242424] rounded-lg flex items-center justify-center flex-shrink-0 border border-gray-700">
          <Icon size={16} className="text-gray-400" />
        </div>
        <div>
          <h2 className="text-white font-semibold text-sm">{title}</h2>
          {description && <p className="text-gray-500 text-xs mt-0.5">{description}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function CookiesSection({ authStatus, onAuthChange, onDataChange }) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const flash = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true); setError('');
    try { await saveCookies(content); await onAuthChange(); setEditing(false); setContent(''); flash('Cookies saved'); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm('Remove cookies? Subscription sync will stop working until you add new cookies.')) return;
    setRemoving(true);
    try { await deleteCookies(); await onAuthChange(); flash('Cookies removed'); }
    catch (err) { setError(err.message); }
    finally { setRemoving(false); }
  };

  const handleSync = async () => {
    setSyncing(true); setError('');
    try { const res = await syncSubscriptions(); await onDataChange(); flash(`Synced ${res.count} subscriptions`); }
    catch (err) { setError(err.message); }
    finally { setSyncing(false); }
  };

  return (
    <SectionCard title="YouTube Cookies" description="Required for syncing your subscription list from YouTube" icon={Cookie}>
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-2 h-2 rounded-full ${authStatus?.hasCookies ? 'bg-green-500' : 'bg-gray-600'}`} />
        <span className={`text-sm ${authStatus?.hasCookies ? 'text-green-400' : 'text-gray-500'}`}>
          {authStatus?.hasCookies ? 'Cookies active' : 'No cookies set'}
        </span>
      </div>
      {error && <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg p-3 mb-3"><AlertCircle size={14} />{error}</div>}
      {success && <div className="flex items-center gap-2 text-green-400 text-sm bg-green-900/20 border border-green-800 rounded-lg p-3 mb-3"><Check size={14} />{success}</div>}
      {editing ? (
        <div className="flex flex-col gap-3">
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="# Netscape HTTP Cookie File&#10;..." rows={6} className="w-full bg-[#0f0f0f] border border-gray-700 rounded-lg p-3 text-gray-300 text-xs font-mono placeholder-gray-700 focus:outline-none focus:border-gray-600 resize-none" />
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={!content.trim() || saving} className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors">
              {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />} Save
            </button>
            <button onClick={() => { setEditing(false); setContent(''); setError(''); }} className="px-4 py-2 bg-[#242424] hover:bg-[#2e2e2e] text-gray-400 rounded-lg text-sm transition-colors">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {authStatus?.hasCookies && (
            <button onClick={handleSync} disabled={syncing} className="flex items-center gap-1.5 px-3 py-2 bg-[#242424] hover:bg-[#2e2e2e] border border-gray-700 text-gray-300 rounded-lg text-sm transition-colors disabled:opacity-50">
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />{syncing ? 'Syncing...' : 'Sync subscriptions'}
            </button>
          )}
          <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-3 py-2 bg-[#242424] hover:bg-[#2e2e2e] border border-gray-700 text-gray-300 rounded-lg text-sm transition-colors">
            <Cookie size={13} />{authStatus?.hasCookies ? 'Update cookies' : 'Set cookies'}
          </button>
          {authStatus?.hasCookies && (
            <button onClick={handleDelete} disabled={removing} className="flex items-center gap-1.5 px-3 py-2 bg-[#242424] hover:bg-red-900/30 border border-gray-700 hover:border-red-800 text-gray-500 hover:text-red-400 rounded-lg text-sm transition-colors">
              <Trash2 size={13} />Remove
            </button>
          )}
        </div>
      )}
    </SectionCard>
  );
}

function AddChannelSection({ onDataChange }) {
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState([]);
  const [error, setError] = useState('');

  const handleAdd = async () => {
    if (!url.trim()) return;
    setAdding(true); setError('');
    try { const ch = await addChannel(url.trim()); setAdded(prev => [ch, ...prev]); setUrl(''); await onDataChange(); }
    catch (err) { setError(err.message); }
    finally { setAdding(false); }
  };

  return (
    <SectionCard title="Add Channel" description="Add a YouTube channel by URL or @handle" icon={Plus}>
      <div className="flex gap-2 mb-3">
        <input type="text" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} placeholder="https://youtube.com/@channelname" className="flex-1 bg-[#0f0f0f] border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-gray-600" />
        <button onClick={handleAdd} disabled={!url.trim() || adding} className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors">
          {adding ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />} Add
        </button>
      </div>
      {error && <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg p-3 mb-2"><AlertCircle size={13} />{error}</div>}
      {added.map((ch, i) => <div key={i} className="flex items-center gap-2 text-sm text-green-400 py-1"><Check size={13} />{ch.title} added</div>)}
    </SectionCard>
  );
}

function ImportCsvSection({ onDataChange }) {
  const [content, setContent] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setContent(ev.target.result);
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!content.trim()) return;
    setImporting(true); setError(''); setResult(null);
    try { const res = await importCsv(content); setResult(res); await onDataChange(); }
    catch (err) { setError(err.message); }
    finally { setImporting(false); }
  };

  return (
    <SectionCard title="Import from Google Takeout" description="Import your subscription list from a Google Takeout subscriptions.csv export" icon={FileSpreadsheet}>
      <label className="flex items-center gap-2 px-3 py-2 bg-[#242424] border border-gray-700 rounded-lg text-gray-400 text-sm cursor-pointer hover:border-gray-600 hover:text-gray-200 transition-colors w-fit mb-3">
        <Upload size={13} />Choose CSV file
        <input type="file" accept=".csv" onChange={handleFile} className="hidden" />
      </label>
      <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Channel Id,Channel Url,Channel Title&#10;UCxxxxxx,..." rows={4} className="w-full bg-[#0f0f0f] border border-gray-700 rounded-lg p-3 text-gray-300 text-xs font-mono placeholder-gray-700 focus:outline-none focus:border-gray-600 resize-none mb-3" />
      {error && <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg p-3 mb-3"><AlertCircle size={13} />{error}</div>}
      {result && <div className="flex items-center gap-2 text-green-400 text-sm bg-green-900/20 border border-green-800 rounded-lg p-3 mb-3"><Check size={13} />Imported {result.count} channels{result.errors?.length > 0 ? ` (${result.errors.length} failed)` : ''}</div>}
      <button onClick={handleImport} disabled={!content.trim() || importing} className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors">
        {importing ? <RefreshCw size={13} className="animate-spin" /> : <ArrowRight size={13} />}{importing ? 'Importing...' : 'Import'}
      </button>
    </SectionCard>
  );
}
