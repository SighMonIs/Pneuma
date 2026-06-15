import { useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { saveCookies, importCsv, addChannel } from '../services/api.js';

const TABS = [
  { id: 'cookies', label: 'YouTube Cookies', icon: 'Cookie' },
  { id: 'csv', label: 'Import CSV', icon: 'FileSpreadsheet' },
  { id: 'manual', label: 'Add Manually', icon: 'Plus' },
];

export default function SetupPage({ onComplete }) {
  const [activeTab, setActiveTab] = useState('cookies');

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center">
          <LucideIcons.Tv2 size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-white font-bold text-2xl tracking-tight">Pneuma</h1>
          <p className="text-gray-500 text-sm">YouTube subscription reader</p>
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-lg bg-[#1a1a1a] border border-gray-800 rounded-2xl overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          {TABS.map(tab => {
            const Icon = LucideIcons[tab.icon];
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-white border-b-2 border-red-500 bg-[#242424]'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <Icon size={15} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Panel */}
        <div className="p-6">
          {activeTab === 'cookies' && <CookiesPanel onComplete={onComplete} />}
          {activeTab === 'csv' && <CsvPanel onComplete={onComplete} />}
          {activeTab === 'manual' && <ManualPanel onComplete={onComplete} />}
        </div>
      </div>
    </div>
  );
}

function CookiesPanel({ onComplete }) {
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    setError('');
    try {
      await saveCookies(content);
      onComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-white font-semibold mb-1">Connect with cookies</h2>
        <p className="text-gray-400 text-sm leading-relaxed">
          Export your YouTube cookies using the{' '}
          <span className="text-gray-200 font-medium">Get cookies.txt LOCALLY</span>{' '}
          extension (Chrome/Firefox), then paste the contents below.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-gray-400 text-xs font-medium uppercase tracking-wider">cookies.txt</label>
          <span className="text-gray-600 text-xs">{content.split('\n').length} lines</span>
        </div>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="# Netscape HTTP Cookie File&#10;# http://curl.haxx.se/rfc/cookie_spec.html&#10;..."
          rows={8}
          className="w-full bg-[#0f0f0f] border border-gray-700 rounded-lg p-3 text-gray-300 text-xs font-mono placeholder-gray-700 focus:outline-none focus:border-gray-500 resize-none"
        />
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg p-3">
          {error}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={!content.trim() || saving}
        className="flex items-center justify-center gap-2 w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors"
      >
        {saving ? (
          <><LucideIcons.RefreshCw size={14} className="animate-spin" /> Saving...</>
        ) : (
          <><LucideIcons.Cookie size={14} /> Save Cookies &amp; Continue</>
        )}
      </button>

      <p className="text-gray-600 text-xs text-center">
        Cookies are stored locally and only used to talk to YouTube.
      </p>
    </div>
  );
}

function CsvPanel({ onComplete }) {
  const [content, setContent] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleImport = async () => {
    if (!content.trim()) return;
    setImporting(true);
    setError('');
    setResult(null);
    try {
      const res = await importCsv(content);
      setResult(res);
      if (res.count > 0) setTimeout(onComplete, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setContent(ev.target.result);
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-white font-semibold mb-1">Import from Google Takeout</h2>
        <p className="text-gray-400 text-sm leading-relaxed">
          Go to{' '}
          <span className="text-gray-200 font-medium">takeout.google.com</span>,
          export YouTube data, then upload or paste your{' '}
          <span className="text-gray-200 font-mono text-xs">subscriptions.csv</span>.
        </p>
      </div>

      <label className="flex items-center gap-2 px-3 py-2 bg-[#242424] border border-gray-700 rounded-lg text-gray-400 text-sm cursor-pointer hover:border-gray-500 hover:text-gray-200 transition-colors w-fit">
        <LucideIcons.Upload size={14} />
        Choose file
        <input type="file" accept=".csv" onChange={handleFile} className="hidden" />
      </label>

      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Channel Id,Channel Url,Channel Title&#10;UCxxxxxx,https://youtube.com/channel/UCxxxxxx,Channel Name"
        rows={6}
        className="w-full bg-[#0f0f0f] border border-gray-700 rounded-lg p-3 text-gray-300 text-xs font-mono placeholder-gray-700 focus:outline-none focus:border-gray-500 resize-none"
      />

      {error && (
        <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg p-3">
          {error}
        </div>
      )}

      {result && (
        <div className="text-green-400 text-sm bg-green-900/20 border border-green-800 rounded-lg p-3">
          Imported {result.count} channels. {result.errors?.length > 0 && `(${result.errors.length} failed)`}
        </div>
      )}

      <button
        onClick={handleImport}
        disabled={!content.trim() || importing}
        className="flex items-center justify-center gap-2 w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors"
      >
        {importing ? (
          <><LucideIcons.RefreshCw size={14} className="animate-spin" /> Importing...</>
        ) : (
          <><LucideIcons.FileSpreadsheet size={14} /> Import CSV</>
        )}
      </button>
    </div>
  );
}

function ManualPanel({ onComplete }) {
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState([]);
  const [error, setError] = useState('');

  const handleAdd = async () => {
    if (!url.trim()) return;
    setAdding(true);
    setError('');
    try {
      const channel = await addChannel(url.trim());
      setAdded(prev => [...prev, channel]);
      setUrl('');
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-white font-semibold mb-1">Add channels manually</h2>
        <p className="text-gray-400 text-sm leading-relaxed">
          Paste a YouTube channel URL or handle to add it directly.
        </p>
      </div>

      <div className="flex gap-2">
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
          {adding
            ? <LucideIcons.RefreshCw size={14} className="animate-spin" />
            : <LucideIcons.Plus size={14} />}
          Add
        </button>
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg p-3">
          {error}
        </div>
      )}

      {added.length > 0 && (
        <div className="flex flex-col gap-1">
          {added.map(ch => (
            <div key={ch.id} className="flex items-center gap-2 text-sm text-green-400">
              <LucideIcons.Check size={14} />
              {ch.title}
            </div>
          ))}
        </div>
      )}

      {added.length > 0 && (
        <button
          onClick={onComplete}
          className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#242424] hover:bg-[#2e2e2e] border border-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <LucideIcons.ArrowRight size={14} />
          Go to app ({added.length} channel{added.length !== 1 ? 's' : ''} added)
        </button>
      )}
    </div>
  );
}
