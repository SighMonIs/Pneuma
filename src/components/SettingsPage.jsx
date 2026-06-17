import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Cookie, FileSpreadsheet, Plus, RefreshCw, Trash2,
  Check, Upload, ArrowRight, AlertCircle, Monitor, Rss, Tag,
  ChevronUp, ChevronDown, Settings, Calendar, RotateCcw,
  ArrowLeft, ListChecks, AlertTriangle, ExternalLink, Image, Eye,
  Clock, Play, ToggleLeft, ToggleRight, X,
} from 'lucide-react';
import {
  saveCookies, deleteCookies, importCsv, addChannel, syncSubscriptions,
  createCategory, updateCategory, deleteCategory, reorderCategory,
  getSettings, updateSettings, applyDefaultFetch,
  getSubscriptions, updateChannelCategories, purgeAndFetch,
  purgeWatch, purgeCategories, purgeBefore,
  resetDisplayDefaults,
  getJobs, createJob, updateJob, deleteJob, runJob,
  getFetchErrors, clearFetchError, clearAllFetchErrors, deleteSubscription,
} from '../services/api.js';
import CategoryModal from './CategoryModal.jsx';

const TABS = [
  { id: 'display', label: 'Display', icon: Monitor },
  { id: 'feeds', label: 'Feeds', icon: Rss },
  { id: 'categories', label: 'Categories', icon: Tag },
  { id: 'scheduler', label: 'Scheduler', icon: Clock },
];

function tablerClass(iconName) {
  if (!iconName) return 'folder';
  if (iconName === iconName.toLowerCase() || iconName.includes('-')) return iconName;
  return iconName.replace(/([A-Z])/g, (m, p1, offset) => (offset > 0 ? '-' : '') + p1.toLowerCase());
}

export default function SettingsPage({ authStatus, onAuthChange, onDataChange, categories }) {
  const [activeTab, setActiveTab] = useState('display');

  return (
    <main className="flex-1 p-8 max-w-2xl">
      <h1 className="text-white text-2xl font-bold mb-6">Settings</h1>

      <div className="flex gap-1 mb-8 border-b border-gray-700">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${
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
      {activeTab === 'scheduler' && <SchedulerTab />}
    </main>
  );
}

/* â”€â”€â”€ Display Tab â”€â”€â”€ */

function loadStr(key, def) {
  try { return localStorage.getItem(key) ?? def; } catch { return def; }
}
function saveStr(key, val) {
  try { localStorage.setItem(key, val); } catch {}
}
function loadBool(key, def = false) {
  try { const v = localStorage.getItem(key); return v === null ? def : v === 'true'; } catch { return def; }
}
function saveBool(key, val) {
  try { localStorage.setItem(key, String(val)); } catch {}
}

function Toggle({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full flex-shrink-0 ${checked ? 'bg-red-600' : 'bg-gray-700'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

const QUALITY_OPTIONS = [
  { value: 'hqdefault', label: 'Low', desc: 'hqdefault â€” fastest, ~480Ã—360' },
  { value: 'sddefault', label: 'Medium', desc: 'sddefault â€” ~640Ã—480' },
  { value: 'maxresdefault', label: 'High', desc: 'maxresdefault â€” up to 1280Ã—720' },
];

function DisplayTab() {
  const [videoMode, setVideoModeRaw] = useState(() => loadStr('pneuma_video_mode', 'youtube'));
  const [showComments, setShowCommentsRaw] = useState(() => loadBool('pneuma_show_comments'));
  const [quality, setQualityRaw] = useState(() => loadStr('pneuma_thumbnail_quality', 'hqdefault'));
  const [showWatchedBadge, setShowWatchedBadgeRaw] = useState(() => loadBool('pneuma_show_watched_badge', true));

  const setVideoMode = (val) => { setVideoModeRaw(val); saveStr('pneuma_video_mode', val); };
  const setShowComments = (val) => { setShowCommentsRaw(val); saveBool('pneuma_show_comments', val); };
  const setQuality = (val) => { setQualityRaw(val); saveStr('pneuma_thumbnail_quality', val); };
  const setShowWatchedBadge = (val) => { setShowWatchedBadgeRaw(val); saveBool('pneuma_show_watched_badge', val); };

  return (
    <div className="flex flex-col gap-6">
      {/* Video Playback */}
      <SectionCard title="Video Playback" description="Choose what happens when you click on a video" icon={Monitor}>
        <div className="flex flex-col gap-2">
          {[
            { value: 'youtube', label: 'Open in YouTube', desc: 'Opens the video in a new tab on youtube.com' },
            { value: 'embed', label: 'Embedded player', desc: 'Plays the video in an overlay without leaving the app' },
          ].map(opt => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${
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
              <p className="text-gray-500 text-xs mt-0.5">Show a "View on YouTube" link in the player for accessing comments</p>
            </div>
            <Toggle checked={showComments} onChange={setShowComments} />
          </div>
        )}
      </SectionCard>

      {/* Thumbnail Quality */}
      <SectionCard title="Image Quality" description="Thumbnail resolution loaded in the video grid" icon={Image}>
        <div className="flex flex-col gap-2">
          {QUALITY_OPTIONS.map(opt => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${
                quality === opt.value
                  ? 'border-red-600/50 bg-red-600/10'
                  : 'border-gray-700 hover:border-gray-600 bg-[#242424]'
              }`}
            >
              <input
                type="radio"
                name="quality"
                value={opt.value}
                checked={quality === opt.value}
                onChange={() => setQuality(opt.value)}
                className="mt-0.5 accent-red-500"
              />
              <div>
                <p className="text-white text-sm font-medium">{opt.label}</p>
                <p className="text-gray-500 text-xs mt-0.5">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </SectionCard>

      {/* Sidebar */}
      <SectionCard title="Sidebar" description="Controls for the channel list" icon={Eye}>
        <div className="flex items-center justify-between p-3 bg-[#242424] border border-gray-700 rounded-lg">
          <div>
            <p className="text-white text-sm font-medium">Show unwatched count badge</p>
            <p className="text-gray-500 text-xs mt-0.5">Display a red badge next to each channel showing how many unwatched videos remain</p>
          </div>
          <Toggle checked={showWatchedBadge} onChange={setShowWatchedBadge} />
        </div>
      </SectionCard>

      {/* Channel Defaults */}
      <ChannelDefaultsSection />
    </div>
  );
}

/* â”€â”€â”€ Channel Defaults Section â”€â”€â”€ */

function ChannelDefaultsSection() {
  const [showBanner, setShowBanner] = useState(true);
  const [showAbout, setShowAbout] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const flash = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const handleReset = async () => {
    setResetting(true); setError('');
    try {
      const res = await resetDisplayDefaults(showBanner, showAbout);
      flash(`Applied to ${res.updated} channel${res.updated !== 1 ? 's' : ''}`);
    } catch (err) {
      setError(err.message || 'Failed to reset defaults');
    } finally {
      setResetting(false);
    }
  };

  return (
    <SectionCard title="Channel Defaults" description="Default display settings applied when resetting channels" icon={Monitor}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between p-3 bg-[#242424] border border-gray-700 rounded-lg">
          <div>
            <p className="text-white text-sm font-medium">Show banner</p>
            <p className="text-gray-500 text-xs mt-0.5">Default: display the channel banner image</p>
          </div>
          <Toggle checked={showBanner} onChange={setShowBanner} />
        </div>
        <div className="flex items-center justify-between p-3 bg-[#242424] border border-gray-700 rounded-lg">
          <div>
            <p className="text-white text-sm font-medium">Show about</p>
            <p className="text-gray-500 text-xs mt-0.5">Default: display the channel description</p>
          </div>
          <Toggle checked={showAbout} onChange={setShowAbout} />
        </div>
        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg p-3">
            <AlertCircle size={13} />{error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 text-green-400 text-sm bg-green-900/20 border border-green-800 rounded-lg p-3">
            <Check size={13} />{success}
          </div>
        )}
        <button
          onClick={handleReset}
          disabled={resetting}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#242424] hover:bg-[#2e2e2e] border border-gray-700 text-gray-300 rounded-lg text-sm disabled:opacity-50 w-fit"
        >
          {resetting ? <RefreshCw size={13} className="animate-spin" /> : <RotateCcw size={13} />}
          Reset all channels to defaults
        </button>
      </div>
    </SectionCard>
  );
}

/* â”€â”€â”€ Scheduler Tab â”€â”€â”€ */

const ACTION_LABELS = {
  sync_subscriptions: 'Sync Subscriptions',
  fetch_videos: 'Fetch Videos',
};

const CRON_EXAMPLES = [
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Every 12 hours', value: '0 */12 * * *' },
  { label: 'Daily at 6am', value: '0 6 * * *' },
  { label: 'Daily at midnight', value: '0 0 * * *' },
  { label: 'Every Monday 8am', value: '0 8 * * 1' },
];

function formatDate(dateString) {
  if (!dateString) return 'Never';
  return new Date(dateString).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function JobForm({ onSave, onCancel }) {
  const [name, setName] = useState('');
  const [action, setAction] = useState('fetch_videos');
  const [cronExpression, setCronExpression] = useState('0 */6 * * *');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try {
      await onSave({ name: name.trim(), action, cron_expression: cronExpression.trim() });
    } catch (err) {
      setError(err.message || 'Failed to create job');
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#1a1a1a] border border-gray-700 rounded-xl p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-medium text-sm">New Scheduled Job</h3>
        <button onClick={onCancel} className="text-gray-500 hover:text-white"><X size={15} /></button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-xs text-gray-400 mb-1">Job Name</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Daily video fetch"
            className="w-full bg-[#242424] border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-gray-500" autoFocus />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Action</label>
          <select value={action} onChange={e => setAction(e.target.value)}
            className="w-full bg-[#242424] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gray-500">
            {Object.entries(ACTION_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Cron Expression</label>
          <input type="text" value={cronExpression} onChange={e => setCronExpression(e.target.value)} placeholder="0 * * * *"
            className="w-full bg-[#242424] border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm font-mono focus:outline-none focus:border-gray-500" />
        </div>
      </div>
      <div className="mt-3">
        <p className="text-xs text-gray-500 mb-1.5">Quick select:</p>
        <div className="flex flex-wrap gap-1.5">
          {CRON_EXAMPLES.map(ex => (
            <button key={ex.value} onClick={() => setCronExpression(ex.value)}
              className={`px-2 py-1 rounded text-xs border ${cronExpression === ex.value ? 'bg-indigo-600/20 border-indigo-600/40 text-indigo-300' : 'bg-[#242424] border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'}`}>
              {ex.label} <span className="font-mono text-gray-600 ml-1">{ex.value}</span>
            </button>
          ))}
        </div>
      </div>
      {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      <div className="flex gap-3 justify-end mt-4">
        <button onClick={onCancel} className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg text-sm">Cancel</button>
        <button onClick={handleSave} disabled={saving}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
          {saving ? 'Creatingâ€¦' : 'Create Job'}
        </button>
      </div>
    </div>
  );
}

function JobCard({ job, onUpdate, onDelete, onRun }) {
  const [running, setRunning] = useState(false);
  const [toggling, setToggling] = useState(false);

  const handleToggle = async () => {
    setToggling(true);
    try { await onUpdate(job.id, { enabled: !job.enabled }); } finally { setToggling(false); }
  };

  const handleRun = async () => {
    setRunning(true);
    try { await onRun(job.id); } finally { setRunning(false); }
  };

  return (
    <div className={`bg-[#1a1a1a] border rounded-xl p-4 ${job.enabled ? 'border-gray-700' : 'border-gray-800/50 opacity-60'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-white font-medium text-sm truncate">{job.name}</h3>
            <span className={`px-1.5 py-0.5 rounded text-xs ${job.enabled ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
              {job.enabled ? 'Active' : 'Disabled'}
            </span>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><Play size={10} />{ACTION_LABELS[job.action] || job.action}</span>
            <span className="flex items-center gap-1 font-mono bg-[#242424] px-1.5 py-0.5 rounded text-gray-300">{job.cron_expression}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><Clock size={11} />Last: {formatDate(job.last_run_at)}</span>
            <span className="flex items-center gap-1"><Clock size={11} />Next: {job.enabled ? formatDate(job.next_run_at) : 'Disabled'}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={handleToggle} disabled={toggling} title={job.enabled ? 'Disable' : 'Enable'}
            className="text-gray-500 hover:text-white p-1.5 rounded-lg hover:bg-[#242424] disabled:opacity-50">
            {job.enabled ? <ToggleRight size={18} className="text-green-500" /> : <ToggleLeft size={18} />}
          </button>
          <button onClick={handleRun} disabled={running} title="Run now"
            className="text-gray-500 hover:text-green-400 p-1.5 rounded-lg hover:bg-[#242424] disabled:opacity-50">
            {running ? <RefreshCw size={15} className="animate-spin" /> : <Play size={15} />}
          </button>
          <button onClick={() => onDelete(job.id)} title="Delete"
            className="text-gray-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-[#242424]">
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

function SchedulerTab() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  const loadJobs = async () => {
    try { const data = await getJobs(); setJobs(data); }
    catch (err) { setError(err.message || 'Failed to load jobs'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadJobs(); }, []);

  const handleCreate = async (data) => {
    const newJob = await createJob(data);
    setJobs(prev => [newJob, ...prev]);
    setShowForm(false);
  };

  const handleUpdate = async (id, data) => {
    const updated = await updateJob(id, data);
    setJobs(prev => prev.map(j => j.id === id ? updated : j));
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this job?')) return;
    await deleteJob(id);
    setJobs(prev => prev.filter(j => j.id !== id));
  };

  const handleRun = async (id) => {
    const result = await runJob(id);
    setJobs(prev => prev.map(j => j.id === id ? result.job : j));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-gray-400 text-sm">Automate subscription syncs and video fetching</p>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium">
            <Plus size={14} /> Add Job
          </button>
        )}
      </div>

      {error && <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">{error}</div>}

      {showForm && <JobForm onSave={handleCreate} onCancel={() => setShowForm(false)} />}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw size={22} className="animate-spin text-gray-600" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-12">
          <Clock size={36} className="text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 font-medium mb-1">No scheduled jobs</p>
          <p className="text-gray-600 text-sm">Create a job to automatically sync subscriptions or fetch videos.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {jobs.map(job => (
            <JobCard key={job.id} job={job} onUpdate={handleUpdate} onDelete={handleDelete} onRun={handleRun} />
          ))}
        </div>
      )}

      <div className="bg-[#1a1a1a] border border-gray-700 rounded-xl p-4 mt-2">
        <h3 className="text-white text-sm font-medium mb-3">Cron Reference</h3>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {CRON_EXAMPLES.map(ex => (
            <div key={ex.value} className="flex items-center gap-2">
              <code className="font-mono text-indigo-300 bg-[#242424] px-1.5 py-0.5 rounded">{ex.value}</code>
              <span className="text-gray-400">{ex.label}</span>
            </div>
          ))}
        </div>
        <p className="text-gray-600 text-xs mt-3">Format: <code className="font-mono text-gray-400">minute hour day-of-month month day-of-week</code></p>
      </div>
    </div>
  );
}

/* â”€â”€â”€ Feeds Tab â”€â”€â”€ */

function FeedsTab({ authStatus, onAuthChange, onDataChange }) {
  return (
    <div className="flex flex-col gap-6">
      <FetchSettingsSection />
      <CookiesSection authStatus={authStatus} onAuthChange={onAuthChange} onDataChange={onDataChange} />
      <AddChannelSection onDataChange={onDataChange} />
      <ImportCsvSection onDataChange={onDataChange} />
      <ChannelErrorsSection />
      <DangerZoneSection />
    </div>
  );
}

/* â”€â”€â”€ Fetch Settings Section â”€â”€â”€ */

function FetchSettingsSection() {
  const [mode, setMode] = useState('added');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const flash = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  useEffect(() => {
    getSettings()
      .then(s => { setMode(s.fetch_since_mode || 'added'); setDate(s.fetch_since_date || ''); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      await updateSettings({ fetch_since_mode: mode, fetch_since_date: mode === 'date' ? date : null });
      flash('Default saved');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleApplyAll = async () => {
    if (!confirm('Reset all channels to use the global default? Any per-channel overrides will be cleared.')) return;
    setApplying(true); setError('');
    try {
      const res = await applyDefaultFetch();
      flash(`Applied to ${res.updated} channel${res.updated !== 1 ? 's' : ''}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setApplying(false);
    }
  };

  return (
    <SectionCard title="Default Fetch Range" description="Controls how far back yt-dlp looks when fetching videos" icon={Calendar}>
      {loading ? (
        <div className="h-6 bg-gray-800 rounded animate-pulse w-40" />
      ) : (
        <div className="flex flex-col gap-3">
          <FetchSincePicker mode={mode} date={date} onModeChange={setMode} onDateChange={setDate} />
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg p-3">
              <AlertCircle size={13} />{error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 text-green-400 text-sm bg-green-900/20 border border-green-800 rounded-lg p-3">
              <Check size={13} />{success}
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleSave}
              disabled={saving || (mode === 'date' && !date)}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium"
            >
              {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
              Save default
            </button>
            <button
              onClick={handleApplyAll}
              disabled={applying}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#242424] hover:bg-[#2e2e2e] border border-gray-700 text-gray-300 rounded-lg text-sm disabled:opacity-50"
            >
              {applying ? <RefreshCw size={13} className="animate-spin" /> : <RotateCcw size={13} />}
              Apply to all channels
            </button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

/* â”€â”€â”€ Categories Tab â”€â”€â”€ */

function CategoriesTab({ categories, onDataChange }) {
  const [showModal, setShowModal] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [manageMode, setManageMode] = useState(false);

  const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order);

  const handleSave = async (data) => {
    if (editingCat) await updateCategory(editingCat.id, data);
    else await createCategory(data);
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

  if (manageMode) {
    return <ManageFeedsView categories={sorted} onBack={() => setManageMode(false)} onDataChange={onDataChange} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-gray-400 text-sm">{categories.length} categor{categories.length === 1 ? 'y' : 'ies'}</p>
        <div className="flex gap-2">
          <button
            onClick={() => setManageMode(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#242424] hover:bg-[#2e2e2e] border border-gray-700 text-gray-300 rounded-lg text-sm"
          >
            <ListChecks size={14} />
            Manage Feeds
          </button>
          <button
            onClick={() => { setEditingCat(null); setShowModal(true); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
          >
            <Plus size={14} />
            New Category
          </button>
        </div>
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
            const tablerName = tablerClass(cat.icon);
            return (
              <div key={cat.id} className="flex items-center gap-3 bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3">
                <i className={`ti ti-${tablerName} flex-shrink-0`} style={{ fontSize: 16, color: cat.color }} />
                <span className="text-white text-sm font-medium flex-1">{cat.name}</span>
                <span className="text-gray-600 text-xs">{cat.channel_count ?? 0} channel{cat.channel_count !== 1 ? 's' : ''}</span>

                <div className="flex items-center gap-1 ml-2">
                  <button
                    onClick={() => handleReorder(cat, 'up')}
                    disabled={idx === 0}
                    className="text-gray-600 hover:text-gray-400 p-1.5 rounded disabled:opacity-30"
                    aria-label={`Move ${cat.name} up`}
                    title="Move up"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    onClick={() => handleReorder(cat, 'down')}
                    disabled={idx === sorted.length - 1}
                    className="text-gray-600 hover:text-gray-400 p-1.5 rounded disabled:opacity-30"
                    aria-label={`Move ${cat.name} down`}
                    title="Move down"
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button
                    onClick={() => { setEditingCat(cat); setShowModal(true); }}
                    className="text-gray-600 hover:text-gray-300 p-1.5 rounded ml-1"
                    aria-label={`Edit ${cat.name}`}
                    title="Edit"
                  >
                    <Settings size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(cat)}
                    className="text-gray-600 hover:text-red-400 p-1.5 rounded"
                    aria-label={`Delete ${cat.name}`}
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

/* â”€â”€â”€ Manage Feeds View â”€â”€â”€ */

function ManageFeedsView({ categories, onBack, onDataChange }) {
  const navigate = useNavigate();
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [setCatId, setSetCatId] = useState('');
  const [applying, setApplying] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const flash = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const loadSubs = async () => {
    const data = await getSubscriptions();
    setSubs(data.sort((a, b) => (a.title || '').localeCompare(b.title || '')));
  };

  useEffect(() => {
    loadSubs().finally(() => setLoading(false));
  }, []);

  const allSelected = subs.length > 0 && selected.size === subs.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(subs.map(s => s.id)));
  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const handleSave = async () => {
    if (!setCatId || selected.size === 0) return;
    setApplying(true); setError('');
    try {
      const catId = parseInt(setCatId);
      for (const sub of subs.filter(s => selected.has(s.id))) {
        await updateChannelCategories(sub.id, [catId]);
      }
      await loadSubs();
      await onDataChange();
      const name = categories.find(c => c.id === catId)?.name || '';
      flash(`Set ${selected.size} channel${selected.size !== 1 ? 's' : ''} to ${name}`);
      setSelected(new Set());
      setSetCatId('');
    } catch (err) {
      setError(err.message);
    } finally {
      setApplying(false);
    }
  };

  const handleCancel = () => { setSelected(new Set()); setSetCatId(''); setError(''); };

  const catLabel = (sub) => {
    const names = (sub.category_ids || [])
      .map(id => categories.find(c => c.id === id)?.name)
      .filter(Boolean);
    return names.length > 0 ? names.join(', ') : null;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm">
          <ArrowLeft size={14} />
          Back to categories
        </button>
        <button onClick={toggleAll} className="text-xs text-gray-500 hover:text-gray-300">
          {allSelected ? 'Deselect all' : 'Select all'}
        </button>
      </div>

      {selected.size > 0 && (
        <div className="bg-[#1a1a1a] border border-gray-700 rounded-xl p-4 flex flex-col gap-3">
          <p className="text-white text-sm font-medium">
            {selected.size} channel{selected.size !== 1 ? 's' : ''} selected
          </p>
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-xs bg-red-900/20 border border-red-800 rounded-lg p-2">
              <AlertCircle size={12} />{error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 text-green-400 text-xs bg-green-900/20 border border-green-800 rounded-lg p-2">
              <Check size={12} />{success}
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs flex-shrink-0">Set category</span>
            <select
              value={setCatId}
              onChange={e => setSetCatId(e.target.value)}
              className="flex-1 bg-[#0f0f0f] border border-gray-700 rounded-lg px-2 py-1.5 text-gray-200 text-sm focus:outline-none focus:border-gray-500"
            >
              <option value="">Chooseâ€¦</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button
              onClick={handleSave}
              disabled={!setCatId || applying}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium flex-shrink-0"
            >
              {applying ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
              Save
            </button>
            <button onClick={handleCancel} className="px-3 py-1.5 bg-[#242424] hover:bg-[#2e2e2e] border border-gray-700 text-gray-400 rounded-lg text-sm flex-shrink-0">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-12 bg-gray-800/40 rounded-lg animate-pulse" />)}
        </div>
      ) : subs.length === 0 ? (
        <div className="bg-[#1a1a1a] border border-gray-700 rounded-xl p-8 text-center">
          <p className="text-gray-500 text-sm">No channels yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          {subs.map(sub => {
            const isSelected = selected.has(sub.id);
            const label = catLabel(sub);
            return (
              <div
                key={sub.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${
                  isSelected ? 'bg-red-600/10 border border-red-600/30' : 'hover:bg-[#1e1e1e] border border-transparent'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(sub.id)}
                  className="w-4 h-4 accent-red-500 flex-shrink-0 cursor-pointer"
                />
                {sub.thumbnail_url ? (
                  <img src={sub.thumbnail_url} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" loading="lazy" decoding="async" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <span className="text-gray-400 text-xs">{sub.title?.charAt(0)?.toUpperCase() || '?'}</span>
                  </div>
                )}
                <span className="text-white text-sm flex-1 min-w-0 truncate">{sub.title}</span>
                {label && <span className="text-gray-600 text-xs truncate max-w-[120px] flex-shrink-0">{label}</span>}
                <button
                  onClick={() => navigate(`/channel/${sub.id}`)}
                  className="text-gray-600 hover:text-gray-400 p-1 rounded flex-shrink-0"
                  title="Open channel page"
                >
                  <ExternalLink size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* â”€â”€â”€ Danger Zone Section â”€â”€â”€ */


/* --- Channel Errors Section --- */

function classifyError(msg) {
  if (!msg) return 'unknown';
  const lower = msg.toLowerCase();
  if (lower.includes('community guidelines') || lower.includes('channel was removed') || lower.includes('terminated')) return 'removed';
  if (lower.includes('does not have a videos tab') || lower.includes('no videos tab')) return 'no-videos';
  if (lower.includes('private')) return 'private';
  return 'other';
}

function stripYtdlpPrefix(msg) {
  if (!msg) return msg;
  // Strip "yt-dlp failed: ERROR: [youtube:tab] UCxxx: "
  return msg.replace(/^yt-dlp failed:\s*ERROR:\s*\[youtube:[^\]]+\]\s*[A-Za-z0-9_-]+:\s*/i, '')
            .replace(/^yt-dlp failed:\s*ERROR:\s*/i, '')
            .replace(/^yt-dlp failed:\s*/i, '')
            .trim();
}

function ChannelErrorsSection() {
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dismissing, setDismissing] = useState(new Set());
  const [removing, setRemoving] = useState(new Set());
  const [clearingAll, setClearingAll] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setErrors(await getFetchErrors()); } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleDismiss = async (id) => {
    setDismissing(prev => new Set(prev).add(id));
    try {
      await clearFetchError(id);
      setErrors(prev => prev.filter(e => e.id !== id));
    } catch {}
    finally { setDismissing(prev => { const n = new Set(prev); n.delete(id); return n; }); }
  };

  const handleRemove = async (id) => {
    setRemoving(prev => new Set(prev).add(id));
    try {
      await deleteSubscription(id);
      setErrors(prev => prev.filter(e => e.id !== id));
    } catch {}
    finally { setRemoving(prev => { const n = new Set(prev); n.delete(id); return n; }); }
  };

  const handleClearAll = async () => {
    setClearingAll(true);
    try { await clearAllFetchErrors(); setErrors([]); } catch {}
    finally { setClearingAll(false); }
  };

  if (loading) return null;
  if (errors.length === 0) return null;

  return (
    <div className="bg-[#1a1a1a] border border-yellow-800/60 rounded-xl p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-yellow-900/40 rounded-lg flex items-center justify-center flex-shrink-0 border border-yellow-800/60">
            <AlertCircle size={16} className="text-yellow-500" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-sm">Channel Fetch Errors</h2>
            <p className="text-gray-500 text-xs mt-0.5">{errors.length} channel{errors.length !== 1 ? 's' : ''} failed on last fetch</p>
          </div>
        </div>
        <button
          onClick={handleClearAll}
          disabled={clearingAll}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-[#242424] border border-gray-700 rounded-lg disabled:opacity-50 flex-shrink-0"
        >
          {clearingAll ? <RefreshCw size={11} className="animate-spin" /> : <X size={11} />}
          Dismiss all
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {errors.map(ch => {
          const kind = classifyError(ch.last_fetch_error);
          const msg = stripYtdlpPrefix(ch.last_fetch_error);
          const isRemoved = kind === 'removed';
          const isDismissing = dismissing.has(ch.id);
          const isRemoving = removing.has(ch.id);

          return (
            <div key={ch.id} className={`border rounded-lg p-3 flex flex-col gap-2 ${isRemoved ? 'border-red-800/60 bg-red-950/20' : 'border-gray-700 bg-[#242424]'}`}>
              <div className="flex items-center gap-2.5">
                {ch.thumbnail_url
                  ? <img src={ch.thumbnail_url} className="w-7 h-7 rounded-full flex-shrink-0 object-cover" loading="lazy" decoding="async" />
                  : <div className="w-7 h-7 rounded-full bg-gray-700 flex-shrink-0 flex items-center justify-center"><span className="text-xs text-gray-400">{ch.title?.[0]}</span></div>
                }
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{ch.title}</p>
                  <p className={`text-xs mt-0.5 line-clamp-2 font-mono ${isRemoved ? 'text-red-400' : 'text-gray-500'}`}>{msg}</p>
                </div>
              </div>

              {isRemoved && (
                <p className="text-red-300 text-xs bg-red-900/20 rounded px-2 py-1">
                  This channel has been removed from YouTube. You can safely remove it from Pneuma.
                </p>
              )}

              <div className="flex items-center gap-2">
                {isRemoved && (
                  <button
                    onClick={() => handleRemove(ch.id)}
                    disabled={isRemoving || isDismissing}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
                  >
                    {isRemoving ? <RefreshCw size={11} className="animate-spin" /> : <Trash2 size={11} />}
                    Remove channel
                  </button>
                )}
                <button
                  onClick={() => handleDismiss(ch.id)}
                  disabled={isDismissing || isRemoving}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-400 hover:text-white bg-[#1a1a1a] border border-gray-700 rounded-lg disabled:opacity-50"
                >
                  {isDismissing ? <RefreshCw size={11} className="animate-spin" /> : <X size={11} />}
                  Dismiss
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function DangerAction({ title, description, confirmText, onConfirm, buttonLabel, successMessage }) {
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [date, setDate] = useState('');

  const needsDate = title === 'Purge videos before date';

  const handleRun = async () => {
    setRunning(true); setError('');
    try {
      await onConfirm(needsDate ? date : undefined);
      setDone(true); setConfirming(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="border border-gray-800 rounded-lg p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-white text-sm font-medium">{title}</p>
          <p className="text-gray-500 text-xs mt-0.5">{description}</p>
        </div>
        {!confirming && !done && (
          <button
            onClick={() => setConfirming(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-950 hover:bg-red-900/60 border border-red-800 text-red-400 hover:text-red-300 rounded-lg text-xs font-medium flex-shrink-0"
          >
            <Trash2 size={12} />
            {buttonLabel}
          </button>
        )}
        {done && (
          <span className="flex items-center gap-1.5 text-green-400 text-xs flex-shrink-0">
            <Check size={12} /> Done
          </span>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-xs bg-red-900/20 border border-red-800 rounded-lg p-2 mt-3">
          <AlertCircle size={12} />{error}
        </div>
      )}

      {confirming && (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-gray-400 text-xs">{confirmText}</p>
          {needsDate && (
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="bg-[#0f0f0f] border border-gray-600 rounded-lg px-2 py-1.5 text-white text-sm w-fit focus:outline-none focus:border-gray-500 [color-scheme:dark]"
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={handleRun}
              disabled={running || (needsDate && !date)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-lg text-xs font-medium"
            >
              {running ? <RefreshCw size={11} className="animate-spin" /> : <AlertTriangle size={11} />}
              {running ? 'Runningâ€¦' : 'Confirm'}
            </button>
            <button
              onClick={() => { setConfirming(false); setError(''); setDate(''); }}
              disabled={running}
              className="px-3 py-1.5 bg-[#242424] hover:bg-[#2e2e2e] border border-gray-700 text-gray-400 rounded-lg text-xs disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DangerZoneSection() {
  const [purgeAllConfirming, setPurgeAllConfirming] = useState(false);
  const [purgeAllRunning, setPurgeAllRunning] = useState(false);
  const [purgeAllDone, setPurgeAllDone] = useState(false);
  const [purgeAllError, setPurgeAllError] = useState('');

  const handlePurgeAll = async () => {
    setPurgeAllRunning(true); setPurgeAllError('');
    try {
      await purgeAndFetch();
      setPurgeAllDone(true); setPurgeAllConfirming(false);
    } catch (err) {
      setPurgeAllError(err.message);
    } finally {
      setPurgeAllRunning(false);
    }
  };

  return (
    <div className="bg-[#1a1a1a] border border-red-900 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 bg-red-950 rounded-lg flex items-center justify-center flex-shrink-0 border border-red-900">
          <AlertTriangle size={16} className="text-red-500" />
        </div>
        <div>
          <h2 className="text-white font-semibold text-sm">Danger Zone</h2>
          <p className="text-gray-500 text-xs mt-0.5">Irreversible data operations â€” proceed with care</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <DangerAction
          title="Purge watch history"
          description="Clear all watched statuses and video progress, keeping the videos themselves"
          confirmText="This will permanently clear all watch history and video progress. Videos will not be deleted."
          buttonLabel="Purge watch history"
          onConfirm={() => purgeWatch()}
        />

        <DangerAction
          title="Purge category assignments"
          description="Remove all channels from their categories, keeping the categories and channels"
          confirmText="This will remove all channels from their categories. Categories and channels will not be deleted."
          buttonLabel="Purge assignments"
          onConfirm={() => purgeCategories()}
        />

        <DangerAction
          title="Purge videos before date"
          description="Delete all videos published before a chosen date"
          confirmText="Choose a date â€” all videos published before it will be permanently deleted."
          buttonLabel="Purge by date"
          onConfirm={(date) => purgeBefore(date)}
        />

        {/* Purge & Refetch (full) */}
        <div className="border border-red-900/60 rounded-lg p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-white text-sm font-medium">Purge &amp; Refetch</p>
              <p className="text-gray-500 text-xs mt-0.5">Delete all video data and fetch everything from scratch using current date settings</p>
            </div>
            {!purgeAllConfirming && !purgeAllDone && (
              <button
                onClick={() => setPurgeAllConfirming(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-950 hover:bg-red-900/60 border border-red-800 text-red-400 hover:text-red-300 rounded-lg text-xs font-medium flex-shrink-0"
              >
                <Trash2 size={12} />
                Purge &amp; Fetch
              </button>
            )}
            {purgeAllDone && (
              <span className="flex items-center gap-1.5 text-green-400 text-xs flex-shrink-0">
                <Check size={12} /> Done
              </span>
            )}
          </div>

          {purgeAllError && (
            <div className="flex items-center gap-2 text-red-400 text-xs bg-red-900/20 border border-red-800 rounded-lg p-2 mt-3">
              <AlertCircle size={12} />{purgeAllError}
            </div>
          )}

          {purgeAllConfirming && (
            <div className="mt-3 flex flex-col gap-2">
              <p className="text-gray-400 text-xs">
                This will permanently delete all <span className="text-white">videos, watch history, and progress</span> across every feed, then start a fresh fetch. This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handlePurgeAll}
                  disabled={purgeAllRunning}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-lg text-xs font-medium"
                >
                  {purgeAllRunning ? <RefreshCw size={11} className="animate-spin" /> : <AlertTriangle size={11} />}
                  {purgeAllRunning ? 'Purgingâ€¦' : 'Yes, purge everything'}
                </button>
                <button
                  onClick={() => { setPurgeAllConfirming(false); setPurgeAllError(''); }}
                  disabled={purgeAllRunning}
                  className="px-3 py-1.5 bg-[#242424] hover:bg-[#2e2e2e] border border-gray-700 text-gray-400 rounded-lg text-xs disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* â”€â”€â”€ Shared helpers â”€â”€â”€ */

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

/* â”€â”€â”€ FetchSincePicker â”€â”€â”€ */

const FETCH_OPTIONS = [
  { value: 'added', label: 'From when the channel was added', desc: 'Only fetch videos published on or after the date the channel was added' },
  { value: 'date', label: 'From a specific date', desc: 'Only fetch videos published on or after a date you choose' },
  { value: 'beginning', label: 'From the very beginning', desc: 'Fetch all available videos (up to 500 per channel)' },
];

export function FetchSincePicker({ mode, date, onModeChange, onDateChange, showDefault = false, defaultSummary = '' }) {
  const options = showDefault
    ? [{ value: 'default', label: `Use default${defaultSummary ? ` (${defaultSummary})` : ''}`, desc: 'Follow the global fetch setting in Settings â†’ Feeds' }, ...FETCH_OPTIONS]
    : FETCH_OPTIONS;

  return (
    <div className="flex flex-col gap-2">
      {options.map(opt => (
        <label
          key={opt.value}
          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${
            mode === opt.value
              ? 'border-red-600/50 bg-red-600/10'
              : 'border-gray-700 hover:border-gray-600 bg-[#242424]'
          }`}
        >
          <input
            type="radio"
            name="fetchSince"
            value={opt.value}
            checked={mode === opt.value}
            onChange={() => onModeChange(opt.value)}
            className="mt-0.5 accent-red-500 flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium">{opt.label}</p>
            <p className="text-gray-500 text-xs mt-0.5">{opt.desc}</p>
            {opt.value === 'date' && mode === 'date' && (
              <input
                type="date"
                value={date}
                onChange={e => onDateChange(e.target.value)}
                onClick={e => e.stopPropagation()}
                className="mt-2 bg-[#0f0f0f] border border-gray-600 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-gray-500 [color-scheme:dark]"
              />
            )}
          </div>
        </label>
      ))}
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
  const [showSyncOptions, setShowSyncOptions] = useState(false);
  const [syncMode, setSyncMode] = useState('default');
  const [syncDate, setSyncDate] = useState('');

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
    try {
      const res = await syncSubscriptions(
        syncMode !== 'default'
          ? { fetch_since_mode: syncMode, fetch_since_date: syncMode === 'date' ? syncDate : null }
          : {},
      );
      await onDataChange();
      flash(`Synced ${res.count} subscriptions`);
      setShowSyncOptions(false);
    }
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
            <button onClick={handleSave} disabled={!content.trim() || saving} className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium">
              {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />} Save
            </button>
            <button onClick={() => { setEditing(false); setContent(''); setError(''); }} className="px-4 py-2 bg-[#242424] hover:bg-[#2e2e2e] text-gray-400 rounded-lg text-sm">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {authStatus?.hasCookies && (
              <button onClick={() => setShowSyncOptions(v => !v)} className="flex items-center gap-1.5 px-3 py-2 bg-[#242424] hover:bg-[#2e2e2e] border border-gray-700 text-gray-300 rounded-lg text-sm">
                <RefreshCw size={13} />Sync subscriptions
              </button>
            )}
            <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-3 py-2 bg-[#242424] hover:bg-[#2e2e2e] border border-gray-700 text-gray-300 rounded-lg text-sm">
              <Cookie size={13} />{authStatus?.hasCookies ? 'Update cookies' : 'Set cookies'}
            </button>
            {authStatus?.hasCookies && (
              <button onClick={handleDelete} disabled={removing} className="flex items-center gap-1.5 px-3 py-2 bg-[#242424] hover:bg-red-900/30 border border-gray-700 hover:border-red-800 text-gray-500 hover:text-red-400 rounded-lg text-sm">
                <Trash2 size={13} />Remove
              </button>
            )}
          </div>
          {showSyncOptions && (
            <div className="border border-gray-700 rounded-lg p-4 flex flex-col gap-3 bg-[#141414]">
              <p className="text-gray-400 text-xs font-medium">Fetch range for newly synced channels:</p>
              <FetchSincePicker mode={syncMode} date={syncDate} onModeChange={setSyncMode} onDateChange={setSyncDate} showDefault defaultSummary="from when added" />
              <button
                onClick={handleSync}
                disabled={syncing || (syncMode === 'date' && !syncDate)}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium w-fit"
              >
                {syncing ? <RefreshCw size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                {syncing ? 'Syncing...' : 'Sync now'}
              </button>
            </div>
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
  const [showOptions, setShowOptions] = useState(false);
  const [mode, setMode] = useState('default');
  const [date, setDate] = useState('');

  const handleAdd = async () => {
    if (!url.trim()) return;
    setAdding(true); setError('');
    try {
      const fetchSettings = mode !== 'default'
        ? { fetch_since_mode: mode, fetch_since_date: mode === 'date' ? date : null }
        : {};
      const ch = await addChannel(url.trim(), fetchSettings);
      setAdded(prev => [ch, ...prev]);
      setUrl('');
    }
    catch (err) { setError(err.message); }
    finally { setAdding(false); await onDataChange(); }
  };

  return (
    <SectionCard title="Add Channel" description="Add a YouTube channel by URL or @handle" icon={Plus}>
      <div className="flex gap-2 mb-3">
        <input type="text" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} placeholder="https://youtube.com/@channelname" className="flex-1 bg-[#0f0f0f] border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-gray-600" />
        <button onClick={handleAdd} disabled={!url.trim() || adding || (mode === 'date' && !date)} className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium">
          {adding ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />} Add
        </button>
      </div>
      <button onClick={() => setShowOptions(v => !v)} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-xs mb-3">
        <Calendar size={12} />
        {showOptions ? 'Hide fetch options' : 'Set fetch range'}
      </button>
      {showOptions && (
        <div className="border border-gray-700 rounded-lg p-4 mb-3 bg-[#141414]">
          <p className="text-gray-400 text-xs font-medium mb-3">Fetch videos from:</p>
          <FetchSincePicker mode={mode} date={date} onModeChange={setMode} onDateChange={setDate} showDefault defaultSummary="from when added" />
        </div>
      )}
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
  const [showOptions, setShowOptions] = useState(false);
  const [mode, setMode] = useState('default');
  const [date, setDate] = useState('');

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
    try {
      const fetchSettings = mode !== 'default'
        ? { fetch_since_mode: mode, fetch_since_date: mode === 'date' ? date : null }
        : {};
      const res = await importCsv(content, fetchSettings);
      setResult(res);
      await onDataChange();
    }
    catch (err) { setError(err.message); }
    finally { setImporting(false); }
  };

  return (
    <SectionCard title="Import from Google Takeout" description="Import your subscription list from a Google Takeout subscriptions.csv export" icon={FileSpreadsheet}>
      <label className="flex items-center gap-2 px-3 py-2 bg-[#242424] border border-gray-700 rounded-lg text-gray-400 text-sm cursor-pointer hover:border-gray-600 hover:text-gray-200 w-fit mb-3">
        <Upload size={13} />Choose CSV file
        <input type="file" accept=".csv" onChange={handleFile} className="hidden" />
      </label>
      <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Channel Id,Channel Url,Channel Title&#10;UCxxxxxx,..." rows={4} className="w-full bg-[#0f0f0f] border border-gray-700 rounded-lg p-3 text-gray-300 text-xs font-mono placeholder-gray-700 focus:outline-none focus:border-gray-600 resize-none mb-3" />
      <button onClick={() => setShowOptions(v => !v)} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-300 text-xs mb-3">
        <Calendar size={12} />
        {showOptions ? 'Hide fetch options' : 'Set fetch range'}
      </button>
      {showOptions && (
        <div className="border border-gray-700 rounded-lg p-4 mb-3 bg-[#141414]">
          <p className="text-gray-400 text-xs font-medium mb-3">Fetch videos from (applies to all imported channels):</p>
          <FetchSincePicker mode={mode} date={date} onModeChange={setMode} onDateChange={setDate} showDefault defaultSummary="from when added" />
        </div>
      )}
      {error && <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg p-3 mb-3"><AlertCircle size={13} />{error}</div>}
      {result && <div className="flex items-center gap-2 text-green-400 text-sm bg-green-900/20 border border-green-800 rounded-lg p-3 mb-3"><Check size={13} />Imported {result.count} channels{result.errors?.length > 0 ? ` (${result.errors.length} failed)` : ''}</div>}
      <button onClick={handleImport} disabled={!content.trim() || importing || (mode === 'date' && !date)} className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium">
        {importing ? <RefreshCw size={13} className="animate-spin" /> : <ArrowRight size={13} />}{importing ? 'Importing...' : 'Import'}
      </button>
    </SectionCard>
  );
}


