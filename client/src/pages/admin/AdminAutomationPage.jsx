import { useEffect, useState, useCallback } from 'react';
import {
  Bot, RefreshCw, AlertTriangle,
  Play, Zap, Database, TrendingUp, FileText, Users, Newspaper,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { AdminShell } from './shared';
import { RowSkeleton } from '../../components/common/Skeleton';

// A non-2xx response is usually HTML (a proxy error page), and calling .json()
// on it throws something unreadable. Turn it into a real error up front.
const API = (path, opts) =>
  fetch(`/api/automation${path}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
    ...opts,
  }).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json();
  });

const JOB_META = {
  'daily-case':         { label: 'Daily Case',          icon: FileText,    color: 'text-indigo-500' },
  'daily-briefing':     { label: 'Daily Briefing',       icon: Newspaper,   color: 'text-blue-500' },
  'daily-reflection':   { label: 'Daily Reflection',     icon: Zap,         color: 'text-purple-500' },
  'resume-tip':         { label: 'Resume Tip',           icon: TrendingUp,  color: 'text-emerald-500' },
  'company-enrichment': { label: 'Company Enrichment',   icon: Database,    color: 'text-amber-500' },
  'interview-questions':{ label: 'Interview Questions',  icon: Users,       color: 'text-rose-500' },
  'moderation':         { label: 'Post Moderation',      icon: AlertTriangle,color:'text-orange-500' },
  'weekly-newsletter':  { label: 'Weekly Newsletter',    icon: Newspaper,   color: 'text-teal-500' },
  'news-refresh':       { label: 'News Refresh',         icon: RefreshCw,   color: 'text-sky-500' },
  'market-refresh':     { label: 'Market Refresh',       icon: TrendingUp,  color: 'text-green-500' },
};

function StatusBadge({ status }) {
  if (!status) return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-800">never run</span>;
  const map = {
    success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    failed:  'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    running: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

function timeAgo(date) {
  if (!date) return '—';
  const mins = Math.floor((Date.now() - new Date(date)) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function JobCard({ jobName, last, onTrigger, triggering }) {
  const meta = JOB_META[jobName] || { label: jobName, icon: Bot, color: 'text-gray-500' };
  const Icon = meta.icon;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <Icon className={`h-5 w-5 shrink-0 ${meta.color}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-900 dark:text-white">{meta.label}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {last ? `Last: ${timeAgo(last.startedAt)} · ${last.durationMs ? `${(last.durationMs/1000).toFixed(1)}s` : ''} · ${last.itemsProcessed ?? 0} items` : 'No runs yet'}
        </p>
      </div>
      <StatusBadge status={last?.status} />
      <button
        onClick={() => onTrigger(jobName)}
        disabled={triggering === jobName}
        className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-40 dark:bg-indigo-900/30 dark:text-indigo-400"
        title="Trigger manually"
      >
        {triggering === jobName ? (
          <RefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}

function LogRow({ log }) {
  const [open, setOpen] = useState(false);
  const meta = JOB_META[log.job] || { label: log.job };
  return (
    <>
      <tr
        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60"
        onClick={() => setOpen((v) => !v)}
      >
        <td className="py-2 pr-4 text-sm font-medium">{meta.label || log.job}</td>
        <td className="py-2 pr-4"><StatusBadge status={log.status} /></td>
        <td className="py-2 pr-4 text-xs text-gray-500">{timeAgo(log.startedAt)}</td>
        <td className="py-2 pr-4 text-xs text-gray-500">{log.durationMs ? `${(log.durationMs/1000).toFixed(1)}s` : '—'}</td>
        <td className="py-2 pr-4 text-xs text-gray-500">{log.itemsProcessed ?? '—'}</td>
        <td className="py-2 text-xs text-gray-500">{log.provider || '—'}</td>
        <td className="py-2 pl-2 text-gray-400">{open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan={7} className="pb-3 pt-0">
            <div className="rounded-lg bg-gray-50 p-3 text-xs dark:bg-gray-900">
              {log.error && <p className="mb-1 font-medium text-red-500">Error: {log.error}</p>}
              {log.tokensUsed > 0 && <p className="text-gray-500">Tokens used: {log.tokensUsed} · Retries: {log.retryCount}</p>}
              {log.meta && <pre className="mt-2 overflow-x-auto text-gray-400">{JSON.stringify(log.meta, null, 2)}</pre>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function AdminAutomationPage() {
  const [status, setStatus] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(null);
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    try {
      const [s, l] = await Promise.all([API('/status'), API('/logs?limit=40')]);
      setStatus(Array.isArray(s) ? s : []);
      setLogs(Array.isArray(l) ? l : []);
    } catch {
      setStatus([]);
      setLogs([]);
      setToast('Could not reach the automation service');
    } finally {
      // Must run on the failure path too, or the page never leaves its skeleton.
      setLoading(false);
    }
  }, []);

  // The loader awaits before its first setState, so nothing is set
  // synchronously here — the rule cannot see across the await.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function trigger(job) {
    setTriggering(job);
    try {
      const res = await API(`/trigger/${job}`, { method: 'POST' });
      setToast(res.message || 'Triggered');
      setTimeout(load, 4000);
    } catch {
      setToast('Trigger failed');
    } finally {
      // Without this a failed trigger leaves the button spinning permanently.
      setTriggering(null);
    }
    setTimeout(() => setToast(null), 3000);
  }

  const statusMap = Object.fromEntries(status.map((s) => [s.job, s.last]));

  return (
    <AdminShell
      title="Dax Automation"
      icon={Bot}
      subtitle="Monitor and manually trigger all scheduled Dax jobs"
    >
      {toast && (
        <div className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          {toast}
        </div>
      )}

      {/* Job status grid */}
      <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Scheduler Status</h2>
      {loading ? (
        <div className="space-y-2 mb-6"><RowSkeleton /><RowSkeleton /><RowSkeleton /></div>
      ) : (
        <div className="mb-8 grid gap-3 sm:grid-cols-2">
          {Object.keys(JOB_META).map((job) => (
            <JobCard key={job} jobName={job} last={statusMap[job]} onTrigger={trigger} triggering={triggering} />
          ))}
        </div>
      )}

      {/* Recent logs */}
      <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Recent Execution Logs</h2>
      {loading ? (
        <div className="space-y-2"><RowSkeleton /><RowSkeleton /><RowSkeleton /></div>
      ) : logs.length === 0 ? (
        <p className="text-sm text-gray-400">No logs yet — jobs haven&rsquo;t run.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-200 text-xs text-gray-500 dark:border-gray-700">
                <th className="py-2 pr-4 pl-4 font-medium">Job</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Started</th>
                <th className="py-2 pr-4 font-medium">Duration</th>
                <th className="py-2 pr-4 font-medium">Items</th>
                <th className="py-2 font-medium">Provider</th>
                <th className="py-2 pl-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {logs.map((log) => <LogRow key={log._id} log={log} />)}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
