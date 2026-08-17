import { useEffect, useState, useCallback } from 'react';
import {
  Sparkles, TrendingUp, Zap, AlertTriangle, DollarSign,
  CheckCircle2, XCircle, Clock, Activity, BarChart2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { AdminShell } from './shared';
import { RowSkeleton } from '../../components/common/Skeleton';

// Surface the status code rather than letting .json() choke on an HTML error page.
const API = (path) =>
  fetch(`/api/automation${path}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  }).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json();
  });

const JOB_LABELS = {
  'daily-case': 'Daily Case',
  'daily-briefing': 'Daily Briefing',
  'daily-reflection': 'Daily Reflection',
  'resume-tip': 'Resume Tip',
  'company-enrichment': 'Company Enrichment',
  'interview-questions': 'Interview Questions',
  'moderation': 'Post Moderation',
  'weekly-newsletter': 'Weekly Newsletter',
  'news-refresh': 'News Refresh',
  'market-refresh': 'Market Refresh',
};

function StatTile({ label, value, icon: Icon, sub, color = 'indigo' }) {
  const colors = {
    indigo: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-400',
    emerald: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400',
    amber: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400',
    rose: 'text-rose-600 bg-rose-50 dark:bg-rose-900/30 dark:text-rose-400',
  };
  return (
    <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${colors[color]}`}>
        <Icon className="h-4.5 w-4.5 h-5 w-5" />
      </div>
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

function HealthRow({ job }) {
  const [open, setOpen] = useState(false);
  const label = JOB_LABELS[job.job] || job.job;
  const healthy = job.healthy;
  return (
    <>
      <tr
        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60"
        onClick={() => setOpen((v) => !v)}
      >
        <td className="py-2 pl-4 pr-4 text-sm font-medium">{label}</td>
        <td className="py-2 pr-4">
          {healthy ? (
            <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" /> Healthy
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400">
              <XCircle className="h-3.5 w-3.5" /> {job.lastStatus === 'never_run' ? 'Never run' : 'Degraded'}
            </span>
          )}
        </td>
        <td className="py-2 pr-4 text-xs text-gray-500">
          {job.successRate !== null ? `${job.successRate}%` : '—'}
        </td>
        <td className="py-2 pr-4 text-xs text-gray-500">
          {job.lastDurationMs ? `${(job.lastDurationMs / 1000).toFixed(1)}s` : '—'}
        </td>
        <td className="py-2 pr-4 text-xs text-gray-500">
          {job.lastConfidence ? `${Math.round(job.lastConfidence * 100)}%` : '—'}
        </td>
        <td className="py-2 pr-4 text-xs text-rose-500">{job.failCount7d || 0}</td>
        <td className="py-2 pl-2 text-gray-400">
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={7} className="pb-3 pt-0 pl-4">
            <div className="rounded-lg bg-gray-50 p-3 text-xs dark:bg-gray-900">
              <p className="text-gray-500">Last run: {job.lastRun ? new Date(job.lastRun).toLocaleString() : 'Never'}</p>
              <p className="text-gray-500">Success last 7d: {job.successCount7d} | Failed: {job.failCount7d}</p>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function CostBar({ days }) {
  if (!days?.length) return <p className="text-sm text-gray-400">No cost data yet.</p>;
  const max = Math.max(...days.map((d) => d.cost), 0.001);
  return (
    <div className="flex items-end gap-1.5 h-24">
      {days.map((d) => (
        <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full rounded-t bg-indigo-400 dark:bg-indigo-600 min-h-[2px]"
            style={{ height: `${Math.max(4, (d.cost / max) * 88)}px` }}
            title={`$${d.cost.toFixed(4)}`}
          />
          <span className="text-[9px] text-gray-400">{new Date(d.date).toLocaleDateString('en', { weekday: 'short' })}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminAICenterPage() {
  const [center, setCenter] = useState(null);
  const [health, setHealth] = useState(null);
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [c, h, t] = await Promise.allSettled([
      API('/ai-center'),
      API('/health'),
      API('/cost-trends'),
    ]);
    if (c.status === 'fulfilled') setCenter(c.value);
    if (h.status === 'fulfilled') setHealth(h.value);
    if (t.status === 'fulfilled') setTrends(t.value);
    setLoading(false);
  }, []);

  // The loader awaits before its first setState, so nothing is set
  // synchronously here — the rule cannot see across the await.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const today = center?.today;
  const week = center?.week;

  return (
    <AdminShell
      title="Dax Center"
      icon={Sparkles}
      subtitle="Live Dax usage, cost tracking, and scheduler health"
    >
      {loading ? (
        <div className="space-y-3">
          <RowSkeleton /><RowSkeleton /><RowSkeleton />
        </div>
      ) : (
        <>
          {/* Today's stats */}
          <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Today (24h)</h2>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Successful Runs" value={today?.success ?? 0} icon={CheckCircle2} color="emerald" />
            <StatTile label="Failed Runs" value={today?.failed ?? 0} icon={XCircle} color="rose" />
            <StatTile label="Tokens Used" value={(today?.tokensUsed ?? 0).toLocaleString()} icon={Zap} color="indigo" sub="Today" />
            <StatTile label="Est. Cost Today" value={`$${(today?.estimatedCostUsd ?? 0).toFixed(4)}`} icon={DollarSign} color="amber" sub={`Avg ${today?.avgGenerationMs ?? 0}ms`} />
          </div>

          {/* 7-day stats */}
          <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">7-Day Summary</h2>
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <StatTile label="Total Runs" value={(week?.totalRuns ?? 0).toLocaleString()} icon={Activity} color="indigo" />
            <StatTile label="Total Tokens" value={(week?.totalTokens ?? 0).toLocaleString()} icon={Zap} color="indigo" />
            <StatTile label="Est. Cost (7d)" value={`$${(week?.estimatedCostUsd ?? 0).toFixed(4)}`} icon={DollarSign} color="amber" />
          </div>

          {/* Pending reviews */}
          {(center?.pendingReviews ?? 0) > 0 && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/20">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                <strong>{center.pendingReviews}</strong> automation logs flagged for review (low confidence / validation issues)
              </p>
            </div>
          )}

          {/* Cost trend chart */}
          <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <span className="flex items-center gap-1.5"><BarChart2 className="h-4 w-4 text-indigo-500" /> Cost Trend (7 days)</span>
          </h2>
          <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
            <CostBar days={trends?.days} />
          </div>

          {/* Provider usage */}
          {center?.providerUsage?.length > 0 && (
            <>
              <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Provider Usage (7d)</h2>
              <div className="mb-6 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs text-gray-500 dark:border-gray-700">
                      <th className="py-2 pl-4 pr-4 font-medium">Provider</th>
                      <th className="py-2 pr-4 font-medium">Runs</th>
                      <th className="py-2 pr-4 font-medium">Tokens</th>
                      <th className="py-2 pr-4 font-medium">Est. Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                    {center.providerUsage.map((p) => (
                      <tr key={p._id}>
                        <td className="py-2 pl-4 pr-4 text-sm font-medium capitalize">{p._id || 'unknown'}</td>
                        <td className="py-2 pr-4 text-sm text-gray-600 dark:text-gray-300">{p.runs}</td>
                        <td className="py-2 pr-4 text-sm text-gray-600 dark:text-gray-300">{(p.tokens || 0).toLocaleString()}</td>
                        <td className="py-2 pr-4 text-sm text-gray-600 dark:text-gray-300">${(p.cost || 0).toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Health table */}
          <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-indigo-500" /> Scheduler Health
              {health && (
                <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                  health.overallHealthPct >= 80
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                }`}>
                  {health.overallHealthPct}% healthy
                </span>
              )}
            </span>
          </h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200 text-xs text-gray-500 dark:border-gray-700">
                  <th className="py-2 pl-4 pr-4 font-medium">Job</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Success Rate</th>
                  <th className="py-2 pr-4 font-medium">Avg Duration</th>
                  <th className="py-2 pr-4 font-medium">Confidence</th>
                  <th className="py-2 pr-4 font-medium">Failures (7d)</th>
                  <th className="py-2 pl-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {health?.jobs?.map((j) => <HealthRow key={j.job} job={j} />) ?? (
                  <tr><td colSpan={7} className="py-4 pl-4 text-sm text-gray-400">Loading…</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Latency by job */}
          {center?.latencyByJob?.length > 0 && (
            <>
              <h2 className="mb-3 mt-6 text-sm font-semibold text-gray-700 dark:text-gray-300">
                <span className="flex items-center gap-1.5"><TrendingUp className="h-4 w-4 text-indigo-500" /> Avg Latency by Job (7d)</span>
              </h2>
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs text-gray-500 dark:border-gray-700">
                      <th className="py-2 pl-4 pr-4 font-medium">Job</th>
                      <th className="py-2 pr-4 font-medium">Avg Duration</th>
                      <th className="py-2 pr-4 font-medium">Runs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                    {center.latencyByJob.map((j) => (
                      <tr key={j._id}>
                        <td className="py-2 pl-4 pr-4 text-sm font-medium">{JOB_LABELS[j._id] || j._id}</td>
                        <td className="py-2 pr-4 text-sm text-gray-600 dark:text-gray-300">{(j.avgDurationMs / 1000).toFixed(1)}s</td>
                        <td className="py-2 pr-4 text-sm text-gray-600 dark:text-gray-300">{j.runs}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </AdminShell>
  );
}
