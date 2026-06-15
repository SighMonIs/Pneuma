import { useState } from 'react';
import {
  Cookie, FileSpreadsheet, Plus, RefreshCw, Trash2,
  Check, Upload, ArrowRight, AlertCircle,
} from 'lucide-react';
import { saveCookies, deleteCookies, importCsv, addChannel, syncSubscriptions } from '../services/api.js';

export default function SettingsPage({ authStatus, onAuthChange, onDataChange }) {
  return (
    <main className="flex-1 p-8 max-w-2xl">
      <h1 className="text-white text-2xl font-bold mb-8">Settings</h1>

      <div className="flex flex-col gap-6">
        <CookiesSection authStatus={authStatus} onAuthChange={onAuthChange} onDataChange={onDataChange} />
        <AddChannelSection onDataChange={onDataChange} />
        <ImportCsvSection onDataChange={onDataChange} />
      </div>
    </main>
  );
}

function SectionCard({ title, description, icon: Icon, children }) {
  return (
    <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-[#242424] rounded-lg flex items-center justify-center flex-shrink-0">
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

  const flash = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    setError('');
    try {
      await saveCookies(content);
      await onAuthChange();
      setEditing(false);
      setContent('');
      flash('Cookies saved');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Remove cookies? Subscription sync will stop working until you add new cookies.')) return;
    setRemoving(true);
    try {
      await deleteCookies();
      await onAuthChange();
      flash('Cookies removed');
    } catch (err) {
      setError(err.message);
    } finally {
      setRemoving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setError('');
    try {
      const res = await syncSubscriptions();
      await onDataChange();
      flash(`Synced ${res.count} subscriptions`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <SectionCard
      title="YouTube Cookies"
      description="Required for syncing your subscription list from YouTube"
      icon={Cookie}
    >
      {/* Status */}
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-2 h-2 rounded-full ${authStatus?.hasCookies ? 'bg-green-500' : 'bg-gray-600'}`} />
        <span className={`text-sm ${authStatus?.hasCookies ? 'text-green-400' : 'text-gray-500'}`}>
          {authStatus?.hasCookies ? 'Cookies active' : 'No cookies set'}
        </span>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg p-3 mb-3">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 text-green-400 text-sm bg-green-900/20 border border-green-800 rounded-lg p-3 mb-3">
          <Check size={14} />
          {success}
        </div>
      )}

      {editing ? (
        <div className="flex flex-col gap-3">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="# Netscape HTTP Cookie File&#10;..."
            rows={6}
            className="w-full bg-[#0f0f0f] border border-gray-700 rounded-lg p-3 text-gray-300 text-xs font-mono placeholder-gray-700 focus:outline-none focus:border-gray-500 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!content.trim() || saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
              Save
            </button>
            <button
              onClick={() => { setEditing(false); setContent(''); setError(''); }}
              className="px-4 py-2 bg-[#242424] hover:bg-[#2e2e2e] text-gray-400 rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {authStatus?.hasCookies && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#242424] hover:bg-[#2e2e2e] border border-gray-700 text-gray-300 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing...' : 'Sync subscriptions'}
            </button>
          )}
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#242424] hover:bg-[#2e2e2e] border border-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
          >
            <Cookie size={13} />
            {authStatus?.hasCookies ? 'Update cookies' : 'Set cookies'}
          </button>
          {authStatus?.hasCookies && (
            <button
              onClick={handleDelete}
              disabled={removing}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#242424] hover:bg-red-900/30 border border-gray-700 hover:border-red-800 text-gray-500 hover:text-red-400 rounded-lg text-sm transition-colors"
            >
              <Trash2 size={13} />
              Remove
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
    setAdding(true);
    setError('');
    try {
      const ch = await addChannel(url.trim());
      setAdded(prev => [ch, ...prev]);
      setUrl('');
      await onDataChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <SectionCard
      title="Add Channel"
      description="Add a YouTube channel by URL or @handle"
      icon={Plus}
    >
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="https://youtube.com/@channelname"
          className="flex-1 bg-[#0f0f0f] border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-gray-500"
        />
        <button
          onClick={handleAdd}
          disabled={!url.trim() || adding}
          className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {adding ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />}
          Add
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg p-3 mb-2">
          <AlertCircle size={13} />
          {error}
        </div>
      )}

      {added.map((ch, i) => (
        <div key={i} className="flex items-center gap-2 text-sm text-green-400 py-1">
          <Check size={13} />
          {ch.title} added
        </div>
      ))}
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
    setImporting(true);
    setError('');
    setResult(null);
    try {
      const res = await importCsv(content);
      setResult(res);
      await onDataChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <SectionCard
      title="Import from Google Takeout"
      description="Import your subscription list from a Google Takeout subscriptions.csv export"
      icon={FileSpreadsheet}
    >
      <label className="flex items-center gap-2 px-3 py-2 bg-[#242424] border border-gray-700 rounded-lg text-gray-400 text-sm cursor-pointer hover:border-gray-500 hover:text-gray-200 transition-colors w-fit mb-3">
        <Upload size={13} />
        Choose CSV file
        <input type="file" accept=".csv" onChange={handleFile} className="hidden" />
      </label>

      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Channel Id,Channel Url,Channel Title&#10;UCxxxxxx,..."
        rows={4}
        className="w-full bg-[#0f0f0f] border border-gray-700 rounded-lg p-3 text-gray-300 text-xs font-mono placeholder-gray-700 focus:outline-none focus:border-gray-500 resize-none mb-3"
      />

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg p-3 mb-3">
          <AlertCircle size={13} />
          {error}
        </div>
      )}

      {result && (
        <div className="flex items-center gap-2 text-green-400 text-sm bg-green-900/20 border border-green-800 rounded-lg p-3 mb-3">
          <Check size={13} />
          Imported {result.count} channels
          {result.errors?.length > 0 && ` (${result.errors.length} failed)`}
        </div>
      )}

      <button
        onClick={handleImport}
        disabled={!content.trim() || importing}
        className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors"
      >
        {importing ? <RefreshCw size={13} className="animate-spin" /> : <ArrowRight size={13} />}
        {importing ? 'Importing...' : 'Import'}
      </button>
    </SectionCard>
  );
}
