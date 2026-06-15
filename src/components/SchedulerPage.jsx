import { useState, useEffect } from 'react';
import { Plus, Play, Trash2, RefreshCw, Clock, ToggleLeft, ToggleRight, X } from 'lucide-react';
import { getJobs, createJob, updateJob, deleteJob, runJob } from '../services/api.js';

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
  const date = new Date(dateString);
  return date.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
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
    if (!cronExpression.trim()) { setError('Cron expression is required'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({ name: name.trim(), action, cron_expression: cronExpression.trim() });
    } catch (err) {
      setError(err.message || 'Failed to create job');
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-medium">New Scheduled Job</h3>
        <button onClick={onCancel} className="text-gray-500 hover:text-white">
          <X size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Name */}
        <div className="sm:col-span-2">
          <label className="block text-xs text-gray-400 mb-1">Job Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Daily video fetch"
            className="w-full bg-[#242424] border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-gray-500"
            autoFocus
          />
        </div>

        {/* Action */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Action</label>
          <select
            value={action}
            onChange={e => setAction(e.target.value)}
            className="w-full bg-[#242424] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-gray-500"
          >
            {Object.entries(ACTION_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>

        {/* Cron expression */}
        <div>
          <label className="block text-xs text-gray-400 mb-1">Cron Expression</label>
          <input
            type="text"
            value={cronExpression}
            onChange={e => setCronExpression(e.target.value)}
            placeholder="0 * * * *"
            className="w-full bg-[#242424] border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm font-mono focus:outline-none focus:border-gray-500"
          />
        </div>
      </div>

      {/* Cron examples */}
      <div className="mt-3">
        <p className="text-xs text-gray-500 mb-1.5">Quick select:</p>
        <div className="flex flex-wrap gap-1.5">
          {CRON_EXAMPLES.map(ex => (
            <button
              key={ex.value}
              onClick={() => setCronExpression(ex.value)}
              className={`px-2 py-1 rounded text-xs transition-colors border ${
                cronExpression === ex.value
                  ? 'bg-indigo-600/20 border-indigo-600/40 text-indigo-300'
                  : 'bg-[#242424] border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
              }`}
            >
              {ex.label} <span className="font-mono text-gray-600 ml-1">{ex.value}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

      <div className="flex gap-3 justify-end mt-4">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg text-sm transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {saving ? 'Creating...' : 'Create Job'}
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
    try {
      await onUpdate(job.id, { enabled: !job.enabled });
    } finally {
      setToggling(false);
    }
  };

  const handleRun = async () => {
    setRunning(true);
    try {
      await onRun(job.id);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className={`bg-[#1a1a1a] border rounded-xl p-4 transition-colors ${
      job.enabled ? 'border-gray-800' : 'border-gray-800/50 opacity-60'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-white font-medium text-sm truncate">{job.name}</h3>
            <span className={`px-1.5 py-0.5 rounded text-xs ${
              job.enabled ? 'bg-green-900/40 text-green-400' : 'bg-gray-800 text-gray-500'
            }`}>
              {job.enabled ? 'Active' : 'Disabled'}
            </span>
          </div>

          <div className="flex flex-wrap gap-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Play size={10} />
              {ACTION_LABELS[job.action] || job.action}
            </span>
            <span className="flex items-center gap-1 font-mono bg-[#242424] px-1.5 py-0.5 rounded text-gray-300">
              {job.cron_expression}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Clock size={11} />
              Last: {formatDate(job.last_run_at)}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={11} />
              Next: {job.enabled ? formatDate(job.next_run_at) : 'Disabled'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Enable/disable toggle */}
          <button
            onClick={handleToggle}
            disabled={toggling}
            className="text-gray-500 hover:text-white p-1.5 rounded-lg hover:bg-[#242424] transition-colors disabled:opacity-50"
            title={job.enabled ? 'Disable job' : 'Enable job'}
          >
            {job.enabled
              ? <ToggleRight size={18} className="text-green-500" />
              : <ToggleLeft size={18} />
            }
          </button>

          {/* Run now */}
          <button
            onClick={handleRun}
            disabled={running}
            className="text-gray-500 hover:text-green-400 p-1.5 rounded-lg hover:bg-[#242424] transition-colors disabled:opacity-50"
            title="Run now"
          >
            {running
              ? <RefreshCw size={15} className="animate-spin" />
              : <Play size={15} />
            }
          </button>

          {/* Delete */}
          <button
            onClick={() => onDelete(job.id)}
            className="text-gray-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-[#242424] transition-colors"
            title="Delete job"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SchedulerPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  const loadJobs = async () => {
    try {
      const data = await getJobs();
      setJobs(data);
    } catch (err) {
      setError(err.message || 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
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
    <main className="flex-1 p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-white text-2xl font-bold">Job Scheduler</h1>
            <p className="text-gray-500 text-sm mt-1">
              Automate subscription syncs and video fetching
            </p>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={15} />
              Add Job
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Create form */}
        {showForm && (
          <JobForm onSave={handleCreate} onCancel={() => setShowForm(false)} />
        )}

        {/* Job list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={24} className="animate-spin text-gray-600" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-16">
            <Clock size={40} className="text-gray-700 mx-auto mb-3" />
            <h3 className="text-gray-400 font-medium mb-1">No scheduled jobs</h3>
            <p className="text-gray-600 text-sm">
              Create a job to automatically sync subscriptions or fetch videos.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {jobs.map(job => (
              <JobCard
                key={job.id}
                job={job}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                onRun={handleRun}
              />
            ))}
          </div>
        )}

        {/* Cron reference */}
        <div className="mt-8 bg-[#1a1a1a] border border-gray-800 rounded-xl p-4">
          <h3 className="text-white text-sm font-medium mb-3">Cron Expression Reference</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {CRON_EXAMPLES.map(ex => (
              <div key={ex.value} className="flex items-center gap-2">
                <code className="font-mono text-indigo-300 bg-[#242424] px-1.5 py-0.5 rounded">
                  {ex.value}
                </code>
                <span className="text-gray-400">{ex.label}</span>
              </div>
            ))}
          </div>
          <p className="text-gray-600 text-xs mt-3">
            Format: <code className="font-mono text-gray-400">minute hour day-of-month month day-of-week</code>
          </p>
        </div>
      </div>
    </main>
  );
}
