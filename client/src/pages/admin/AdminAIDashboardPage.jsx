import { useEffect, useState, useCallback } from 'react';
import {
  Activity, Cpu, Zap, DollarSign, Clock, BarChart2, Server,
  CheckCircle2, XCircle, AlertTriangle, RefreshCw, ChevronDown, ChevronUp,
  Layers, Thermometer, Coins, Check,
} from 'lucide-react';
import { AdminShell } from './shared';
import { apiUrl } from '../../api/base';

// Surface the status code rather than letting .json() choke on an HTML error page.
const API = (path) =>
  fetch(apiUrl(`/admin/ai${path}`), {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  }).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return r.json();
  });

function StatTile({ label, value, icon: Icon, sub, color = 'indigo' }) {
  const colors = {
    indigo: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-400',
    emerald: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400',
    amber: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400',
    rose: 'text-rose-600 bg-rose-50 dark:bg-rose-900/30 dark:text-rose-400',
    sky: 'text-sky-600 bg-sky-50 dark:bg-sky-900/30 dark:text-sky-400',
    violet: 'text-violet-600 bg-violet-50 dark:bg-violet-900/30 dark:text-violet-400',
  };
  return (
    <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${colors[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

function LiveRequestRow({ r }) {
  const [open, setOpen] = useState(false);
  const ok = r.success;
  return (
    <>
      <tr
        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60"
        onClick={() => setOpen((v) => !v)}
      >
        <td className="py-2 pl-4 pr-3">
          {ok
            ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            : <XCircle className="h-4 w-4 text-rose-500" />}
        </td>
        <td className="py-2 pr-3 text-xs text-gray-500 whitespace-nowrap">
          {new Date(r.timestamp).toLocaleTimeString()}
        </td>
        <td className="py-2 pr-3 text-xs font-medium text-gray-700 dark:text-gray-200">
          {r.capability || '—'}
        </td>
        <td className="py-2 pr-3 text-xs text-gray-500">{r.provider || '—'}</td>
        <td className="py-2 pr-3 text-xs text-gray-500 max-w-[120px] truncate">{r.model || '—'}</td>
        <td className="py-2 pr-3 text-xs text-gray-500">{r.latencyMs}ms</td>
        <td className="py-2 pr-3 text-xs text-gray-500">{(r.totalTokens || 0).toLocaleString()}</td>
        <td className="py-2 pr-3 text-xs text-gray-500">${(r.estimatedCost || 0).toFixed(6)}</td>
        <td className="py-2 pr-3">
          {r.cacheHit && <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">CACHE</span>}
          {r.fallbackUsed && <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">FALLBACK</span>}
        </td>
        <td className="py-2 pl-2 text-gray-400">
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={10} className="pb-3 pt-0 pl-4">
            <div className="rounded-lg bg-gray-50 p-3 text-xs dark:bg-gray-900">
              <p><span className="text-gray-500">User:</span> {r.userId || 'anonymous'}</p>
              <p><span className="text-gray-500">Session:</span> {r.sessionId?.slice(0, 8) || '—'}…</p>
              <p><span className="text-gray-500">Intent:</span> {r.intent || '—'}</p>
              <p><span className="text-gray-500">Mode:</span> {r.runtimeMode || '—'}</p>
              <p><span className="text-gray-500">Retries:</span> {r.retryCount}</p>
              {r.error && <p><span className="text-rose-500">Error:</span> {r.error}</p>}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function ProviderHealthCard({ name, data }) {
  const ok = data.status === 'healthy';
  const degraded = data.status === 'degraded';
  return (
    <div className={`rounded-xl border p-4 ${
      ok
        ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20'
        : degraded
          ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
          : 'border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-900/20'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-gray-900 dark:text-white capitalize">{name}</h3>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
          ok ? 'bg-emerald-200 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-200'
            : degraded
              ? 'bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200'
              : 'bg-rose-200 text-rose-800 dark:bg-rose-800 dark:text-rose-200'
        }`}>
          {data.status}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1 text-xs">
        <p className="text-gray-500">Health: <span className="font-medium text-gray-700 dark:text-gray-200">{data.healthScore}/100</span></p>
        <p className="text-gray-500">Availability: <span className="font-medium text-gray-700 dark:text-gray-200">{data.availability}</span></p>
        <p className="text-gray-500">Calls: <span className="font-medium text-gray-700 dark:text-gray-200">{(data.totalCalls || 0).toLocaleString()}</span></p>
        <p className="text-gray-500">Avg Latency: <span className="font-medium text-gray-700 dark:text-gray-200">{Math.round(data.avgLatencyMs || 0)}ms</span></p>
        <p className="text-gray-500">Failures: <span className="font-medium text-rose-600">{data.consecutiveFailures || 0}</span></p>
        <p className="text-gray-500">Rate Limited: <span className="font-medium text-amber-600">{data.rateLimitHits || 0}</span></p>
      </div>
      {data.models?.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
          <p className="text-[10px] font-medium text-gray-500 mb-1">Models</p>
          <div className="flex flex-wrap gap-1">
            {data.models.map((m) => (
              <span key={m.key} className="rounded bg-gray-200/60 px-1.5 py-0.5 text-[10px] text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                {m.model}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ModelRow({ m }) {
  return (
    <tr className="border-b border-gray-100 dark:border-gray-700/50">
      <td className="py-2 pl-4 pr-3 text-sm font-medium">{m.model}</td>
      <td className="py-2 pr-3 text-xs capitalize text-gray-500">{m.provider}</td>
      <td className="py-2 pr-3 text-xs text-gray-600 dark:text-gray-300">{m.reasoningScore}</td>
      <td className="py-2 pr-3 text-xs text-gray-600 dark:text-gray-300">{m.codingScore}</td>
      <td className="py-2 pr-3 text-xs text-gray-600 dark:text-gray-300">{m.writingScore}</td>
      <td className="py-2 pr-3 text-xs text-gray-600 dark:text-gray-300">{m.speed}</td>
      <td className="py-2 pr-3 text-xs text-gray-600 dark:text-gray-300">{m.cost}</td>
      <td className="py-2 pr-3 text-xs text-gray-500">{(m.contextWindow / 1000).toFixed(0)}K</td>
      <td className="py-2 pr-3 text-xs">
        {m.visionSupport ? <Check className="h-3.5 w-3.5 text-success-600" aria-label="yes" /> : <span className="text-gray-300" aria-label="no">—</span>}
      </td>
      <td className="py-2 pr-3 text-xs">
        {m.embeddingSupport ? <Check className="h-3.5 w-3.5 text-success-600" aria-label="yes" /> : <span className="text-gray-300" aria-label="no">—</span>}
      </td>
      <td className="py-2 pr-4 text-xs text-gray-500">{m.availability}</td>
    </tr>
  );
}

function HealthBar({ value, max, label, color = 'indigo' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const colors = { indigo: 'bg-indigo-400', emerald: 'bg-emerald-400', amber: 'bg-amber-400', rose: 'bg-rose-400' };
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 text-gray-500">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-gray-700">
        <div className={`h-2 rounded-full ${colors[color]}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 text-right font-medium text-gray-700 dark:text-gray-200">{value.toLocaleString()}</span>
    </div>
  );
}

export default function AdminAIDashboardPage() {
  const [runtime, setRuntime] = useState(null);
  const [live, setLive] = useState(null);
  const [providers, setProviders] = useState(null);
  const [usage, setUsage] = useState(null);
  const [usageDays, setUsageDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null); // otherwise a successful retry still renders the old failure
    const [r, l, p, u] = await Promise.allSettled([
      API('/runtime'),
      API('/live'),
      API('/providers'),
      API(`/usage?days=${usageDays}`),
    ]);
    if (r.status === 'fulfilled') setRuntime(r.value);
    else setError(r.reason?.message);
    if (l.status === 'fulfilled') setLive(l.value);
    if (p.status === 'fulfilled') setProviders(p.value);
    if (u.status === 'fulfilled') setUsage(u.value);
    setLoading(false);
  }, [usageDays]);

  useEffect(() => {
    // Scheduled, not called inline: the loader flips loading state
    // synchronously, which cascades an extra render from the effect body.
    queueMicrotask(load);
  }, [load]);

  if (error) {
    return (
      <AdminShell title="AI Runtime" icon={Cpu} subtitle="Observability Dashboard">
        <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-700 dark:bg-rose-900/20">
          <AlertTriangle className="h-5 w-5 text-rose-500" />
          <p className="text-sm text-rose-700 dark:text-rose-300">Failed to load AI runtime data: {error}</p>
        </div>
      </AdminShell>
    );
  }

  const summary = runtime;
  const liveRequests = live?.requests || [];
  const providerData = providers?.providers || {};

  return (
    <AdminShell
      title="AI Runtime"
      icon={Cpu}
      subtitle="Live observability, provider health, and model registry"
    >
      {/* Auto-refresh notice */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-gray-400">Data refreshes on page load</p>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading && !summary ? (
        <div className="space-y-3">
          <div className="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
          <div className="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
          <div className="h-20 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
        </div>
      ) : (
        <>
          {/* Runtime Overview */}
          <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <span className="flex items-center gap-1.5"><Activity className="h-4 w-4 text-indigo-500" /> Runtime Overview</span>
          </h2>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Runtime Mode"
              value={summary?.runtime || 'v2'}
              icon={Layers}
              color="indigo"
              sub={`Provider: ${summary?.provider || 'nvidia'}`}
            />
            <StatTile
              label="Success Rate"
              value={summary ? `${summary.successRate}%` : '—'}
              icon={CheckCircle2}
              color={summary?.successRate >= 80 ? 'emerald' : 'amber'}
              sub={`${summary?.failureCount || 0} failures`}
            />
            <StatTile
              label="Avg Latency"
              value={summary ? `${summary.averageLatency}ms` : '—'}
              icon={Clock}
              color="sky"
              sub={`${summary?.requests || 0} total requests`}
            />
            <StatTile
              label="Health"
              value={summary?.health || '—'}
              icon={Thermometer}
              color={summary?.health === 'healthy' ? 'emerald' : summary?.health === 'degraded' ? 'amber' : 'rose'}
            />
          </div>

          {/* Metrics row */}
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Total Tokens (recent 100)"
              value={(summary?.totalTokens || 0).toLocaleString()}
              icon={Zap}
              color="violet"
            />
            <StatTile
              label="Est. Cost (recent 100)"
              value={`$${(summary?.totalCost || 0).toFixed(4)}`}
              icon={DollarSign}
              color="amber"
            />
            <StatTile
              label="Cache Hits"
              value={summary?.cacheHitCount || 0}
              icon={Server}
              color="sky"
              sub="recent 100 requests"
            />
            <StatTile
              label="Fallbacks"
              value={summary?.fallbackCount || 0}
              icon={AlertTriangle}
              color={summary?.fallbackCount > 0 ? 'amber' : 'emerald'}
              sub="recent 100 requests"
            />
          </div>

          {/* Provider Breakdown */}
          {summary?.providerBreakdown?.length > 0 && (
            <>
              <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                <span className="flex items-center gap-1.5"><BarChart2 className="h-4 w-4 text-indigo-500" /> Provider Breakdown (Recent 100)</span>
              </h2>
              <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 space-y-2">
                {summary.providerBreakdown.map((p) => (
                  <HealthBar
                    key={p.provider}
                    label={p.provider}
                    value={p.calls}
                    max={Math.max(...summary.providerBreakdown.map((x) => x.calls), 1)}
                    color={p.failures > 0 ? 'amber' : 'emerald'}
                  />
                ))}
              </div>
            </>
          )}

          {/* Provider Health */}
          <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <span className="flex items-center gap-1.5"><Server className="h-4 w-4 text-indigo-500" /> Provider Health</span>
          </h2>
          {Object.keys(providerData).length > 0 ? (
            <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(providerData).map(([name, data]) => (
                <ProviderHealthCard key={name} name={name} data={data} />
              ))}
            </div>
          ) : (
            <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-400 dark:border-gray-700 dark:bg-gray-800">
              No provider health data yet — make some AI calls first.
            </div>
          )}

          {/* Model Registry */}
          <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <span className="flex items-center gap-1.5"><Cpu className="h-4 w-4 text-indigo-500" /> Model Registry ({summary?.models?.total || 0} models, {summary?.models?.available || 0} available)</span>
          </h2>
          <div className="mb-6 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200 text-[10px] text-gray-500 dark:border-gray-700">
                  <th className="py-2 pl-4 pr-3 font-medium">Model</th>
                  <th className="py-2 pr-3 font-medium">Provider</th>
                  <th className="py-2 pr-3 font-medium">Reason</th>
                  <th className="py-2 pr-3 font-medium">Code</th>
                  <th className="py-2 pr-3 font-medium">Write</th>
                  <th className="py-2 pr-3 font-medium">Speed</th>
                  <th className="py-2 pr-3 font-medium">Cost</th>
                  <th className="py-2 pr-3 font-medium">Ctx</th>
                  <th className="py-2 pr-3 font-medium">Vis</th>
                  <th className="py-2 pr-3 font-medium">Emb</th>
                  <th className="py-2 pr-4 font-medium">Avail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {summary?.models?.list?.map((m) => (
                  <ModelRow key={m.key} m={m} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Usage & Credits */}
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              <span className="flex items-center gap-1.5"><Coins className="h-4 w-4 text-indigo-500" /> Usage &amp; Credits</span>
            </h2>
            <div className="flex gap-1">
              {[1, 7, 30].map((d) => (
                <button
                  key={d}
                  onClick={() => setUsageDays(d)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                    usageDays === d
                      ? 'bg-indigo-600 text-white'
                      : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
          {usage && (usage.byTier?.length > 0 || usage.topUsers?.length > 0) ? (
            <div className="mb-6 space-y-4">
              {/* Credits by tier */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {['free', 'trial', 'pro', 'max'].map((tierName) => {
                  const row = usage.byTier?.find((t) => t._id === tierName);
                  return (
                    <StatTile
                      key={tierName}
                      label={`${tierName} tier`}
                      value={(row?.credits || 0).toLocaleString()}
                      icon={Coins}
                      color={tierName === 'max' ? 'violet' : tierName === 'pro' ? 'indigo' : tierName === 'trial' ? 'sky' : 'amber'}
                      sub={`${row?.requests || 0} requests`}
                    />
                  );
                })}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {/* Top users */}
                <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                  <p className="border-b border-gray-100 px-4 py-2.5 text-xs font-semibold text-gray-500 dark:border-gray-700">Top users by credits</p>
                  <table className="w-full text-left">
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                      {usage.topUsers?.map((u) => (
                        <tr key={u._id}>
                          <td className="px-4 py-2 text-xs">
                            <p className="font-medium text-gray-800 dark:text-gray-100">{u.name || 'Unknown'}</p>
                            <p className="text-gray-400">{u.email}</p>
                          </td>
                          <td className="py-2 pr-3 text-xs capitalize text-gray-500">{u.tier || 'free'}</td>
                          <td className="py-2 pr-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-200">{u.credits} cr</td>
                          <td className="py-2 pr-4 text-right text-xs text-gray-400">{u.requests} req</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* By model */}
                <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                  <p className="border-b border-gray-100 px-4 py-2.5 text-xs font-semibold text-gray-500 dark:border-gray-700">Requests by model</p>
                  <table className="w-full text-left">
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                      {usage.byModel?.map((m) => (
                        <tr key={m._id || 'unknown'}>
                          <td className="max-w-[200px] truncate px-4 py-2 text-xs font-medium text-gray-800 dark:text-gray-100">{m._id || 'unknown'}</td>
                          <td className="py-2 pr-3 text-xs capitalize text-gray-500">{m.provider || '—'}</td>
                          <td className="py-2 pr-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-200">{m.requests} req</td>
                          <td className="py-2 pr-4 text-right text-xs text-gray-400">{m.credits} cr</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-400 dark:border-gray-700 dark:bg-gray-800">
              No usage events yet in the last {usageDays} day{usageDays === 1 ? '' : 's'} — credits appear here as students use Dax.
            </div>
          )}

          {/* Live Requests */}
          <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <span className="flex items-center gap-1.5"><Activity className="h-4 w-4 text-indigo-500" /> Live Requests (last {liveRequests.length})</span>
          </h2>
          {liveRequests.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200 text-[10px] text-gray-500 dark:border-gray-700">
                    <th className="py-2 pl-4 pr-3" />
                    <th className="py-2 pr-3 font-medium">Time</th>
                    <th className="py-2 pr-3 font-medium">Capability</th>
                    <th className="py-2 pr-3 font-medium">Provider</th>
                    <th className="py-2 pr-3 font-medium">Model</th>
                    <th className="py-2 pr-3 font-medium">Latency</th>
                    <th className="py-2 pr-3 font-medium">Tokens</th>
                    <th className="py-2 pr-3 font-medium">Cost</th>
                    <th className="py-2 pr-3 font-medium">Flags</th>
                    <th className="py-2 pl-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {liveRequests.map((r) => (
                    <LiveRequestRow key={r.id || r.timestamp} r={r} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mb-6 rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-400 dark:border-gray-700 dark:bg-gray-800">
              No requests yet — the observability layer is waiting for AI traffic.
            </div>
          )}
        </>
      )}
    </AdminShell>
  );
}
