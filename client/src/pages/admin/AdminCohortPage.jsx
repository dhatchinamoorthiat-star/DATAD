import { useEffect, useState } from 'react';
import { TrendingUp, Users, Brain, Target, Activity, Sparkles } from 'lucide-react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { Skeleton } from '../../components/common/Skeleton';

export default function AdminCohortPage() {
  useDocumentTitle('Cohort Intelligence');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/insights/cohort', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Skeleton className="mb-6 h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">Cohort Intelligence</h1>

      {/* Summary cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
            <Brain className="h-4 w-4" /> Avg Readiness
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {data?.readiness ? `${Math.round(data.readiness.avg)}/100` : '—'}
          </p>
          <p className="text-xs text-gray-400">{data?.readiness?.count || 0} students scored</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
            <Target className="h-4 w-4" /> Roadmaps Active
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {data?.roadmapAdoption?.count || 0}
          </p>
          <p className="text-xs text-gray-400">{data?.roadmapAdoption ? `Avg ${Math.round(data.roadmapAdoption.avgGaps)} gaps each` : 'No roadmaps yet'}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
            <Activity className="h-4 w-4" /> AI Activity
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {data?.activity?.length || 0}d
          </p>
          <p className="text-xs text-gray-400">Days of tracked usage</p>
        </div>
      </div>

      {/* Top strengths */}
      <div className="mb-6">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          <Sparkles className="h-4 w-4 text-emerald-500" /> Top Strengths Across Cohort
        </h2>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          {data?.topStrengths?.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {data.topStrengths.map((s) => (
                <span key={s._id} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  {s._id} ({s.count})
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No strength data collected yet.</p>
          )}
        </div>
      </div>

      {/* Top gaps */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          <Target className="h-4 w-4 text-amber-500" /> Areas for Growth Across Cohort
        </h2>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          {data?.topGaps?.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {data.topGaps.map((s) => (
                <span key={s._id} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  {s._id} ({s.count})
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No gap data collected yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
