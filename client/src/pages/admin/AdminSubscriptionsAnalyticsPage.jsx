import { useEffect, useState } from 'react';
import { TrendingUp, Users, DollarSign, ZapOff, CheckCircle2, Clock } from 'lucide-react';
import toast from '../../utils/toast';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { getSubscriptionAnalytics } from '../../api/admin';
import { Page } from '../../components/common/motion';
import { Skeleton } from '../../components/common/Skeleton';

export default function AdminSubscriptionsAnalyticsPage() {
  useDocumentTitle('Subscriptions Analytics');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSubscriptionAnalytics()
      .then((res) => setData(res.data))
      .catch(() => toast.error('Could not load subscription analytics'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Page className="mx-auto max-w-6xl px-4 py-8">
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </Page>
    );
  }

  if (!data) {
    return (
      <Page className="mx-auto max-w-6xl px-4 py-8">
        <p className="text-center text-gray-500">No data available</p>
      </Page>
    );
  }

  const { summary, tierDistribution, activeSubscriptions, signupsByDay } = data;
  const mrrDisplay = summary.estimatedMrr ? '₹' + summary.estimatedMrr.toLocaleString('en-IN') : '₹0';

  return (
    <Page className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Subscription Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">Real-time metrics on subscription tiers, conversions, and revenue</p>
      </div>

      {/* Summary Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={Users}
          label="Total Users"
          value={summary.totalUsers}
          color="blue"
        />
        <MetricCard
          icon={CheckCircle2}
          label="Trial→Paid Converted"
          value={summary.trialConverted}
          subtext={`${summary.conversionRate} conversion`}
          color="green"
        />
        <MetricCard
          icon={DollarSign}
          label="Estimated MRR"
          value={mrrDisplay}
          color="amber"
        />
        <MetricCard
          icon={TrendingUp}
          label="Active Subscriptions"
          value={activeSubscriptions.pro + activeSubscriptions.max}
          subtext={`Pro: ${activeSubscriptions.pro}, Max: ${activeSubscriptions.max}`}
          color="purple"
        />
      </div>

      {/* Tier Distribution */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Tier breakdown */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-6 text-lg font-semibold text-gray-900 dark:text-white">Users by Tier</h2>
          <div className="space-y-4">
            <TierRow tier="Free" count={tierDistribution.free} color="gray" percentage={(tierDistribution.free / summary.totalUsers) * 100} />
            <TierRow tier="Trial" count={tierDistribution.trial} color="indigo" percentage={(tierDistribution.trial / summary.totalUsers) * 100} />
            <TierRow tier="Pro" count={tierDistribution.pro} color="amber" percentage={(tierDistribution.pro / summary.totalUsers) * 100} />
            <TierRow tier="Max" count={tierDistribution.max} color="purple" percentage={(tierDistribution.max / summary.totalUsers) * 100} />
          </div>
        </div>

        {/* Conversion funnel */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-6 text-lg font-semibold text-gray-900 dark:text-white">Trial Conversion Funnel</h2>
          <div className="space-y-4">
            <ConversionStep
              label="Started Trial"
              value={summary.totalTrialStarts}
              icon={Clock}
              color="indigo"
            />
            <ConversionStep
              label="Converted to Paid"
              value={summary.trialConverted}
              icon={CheckCircle2}
              color="green"
              percentage={(summary.trialConverted / summary.totalTrialStarts) * 100}
            />
            <ConversionStep
              label="Trial Expired"
              value={summary.trialExpired}
              icon={ZapOff}
              color="red"
              percentage={(summary.trialExpired / summary.totalTrialStarts) * 100}
            />
            <p className="mt-6 text-xs text-gray-500 dark:text-gray-400">
              Conversion rate: <span className="font-semibold text-green-600">{summary.conversionRate}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Signups trend */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-6 text-lg font-semibold text-gray-900 dark:text-white">Signups (Last 30 Days)</h2>
        <div className="flex gap-1 overflow-x-auto pb-4">
          {signupsByDay.map(({ date, signups }) => (
            <div key={date} className="flex flex-col items-center gap-1">
              <div
                className="w-2 rounded-sm bg-primary-500 dark:bg-primary-400"
                style={{
                  height: `${Math.max(20, signups * 8)}px`,
                }}
                title={`${date}: ${signups} signups`}
              />
              <span className="text-[10px] text-gray-400 dark:text-gray-600">
                {new Date(date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Page>
  );
}

function MetricCard({ icon: Icon, label, value, subtext, color }) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400',
    green: 'bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400',
    gray: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400',
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg ${colorMap[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-xs font-medium text-gray-600 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {subtext && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{subtext}</p>}
    </div>
  );
}

function TierRow({ tier, count, color, percentage }) {
  const colorMap = {
    gray: 'bg-gray-200 dark:bg-gray-700',
    indigo: 'bg-indigo-200 dark:bg-indigo-700',
    amber: 'bg-amber-200 dark:bg-amber-700',
    purple: 'bg-purple-200 dark:bg-purple-700',
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{tier}</span>
        <span className="text-sm font-semibold text-gray-900 dark:text-white">{count} ({Math.round(percentage)}%)</span>
      </div>
      <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-800">
        <div
          className={`h-full rounded-full ${colorMap[color]} transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function ConversionStep({ label, value, icon: Icon, color, percentage }) {
  const colorMap = {
    blue: 'text-blue-600 dark:text-blue-400',
    green: 'text-green-600 dark:text-green-400',
    amber: 'text-amber-600 dark:text-amber-400',
    purple: 'text-purple-600 dark:text-purple-400',
    red: 'text-red-600 dark:text-red-400',
    indigo: 'text-indigo-600 dark:text-indigo-400',
  };

  return (
    <div className="flex items-center gap-3">
      <Icon className={`h-5 w-5 ${colorMap[color]}`} />
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
      </div>
      <div className="text-right">
        <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
        {percentage !== undefined && <p className="text-xs text-gray-500 dark:text-gray-400">{Math.round(percentage)}%</p>}
      </div>
    </div>
  );
}
