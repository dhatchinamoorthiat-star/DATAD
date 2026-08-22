import { Zap, MessageSquare } from 'lucide-react';
import { useSubscription } from '../../context/SubscriptionContext';
import { useAiUsage } from '../../dax/hooks/useAiUsage';

export default function UsageSummary() {
  const { tier } = useSubscription();
  const { usage, loading } = useAiUsage();

  if (loading || !usage) return null;
  if (usage.blocked) return null; // No summary if quota is exhausted

  const aiPercent = usage.ai.limit ? Math.min(100, Math.round((usage.ai.used / usage.ai.limit) * 100)) : 0;
  const chatPercent = usage.chat.limit ? Math.min(100, Math.round((usage.chat.used / usage.chat.limit) * 100)) : 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-primary-50 to-primary-100 p-4 dark:border-gray-800 dark:from-primary-950/20 dark:to-primary-900/20">
      <div className="mb-3 flex items-center gap-2">
        <Zap className="h-4 w-4 text-primary-600 dark:text-primary-400" />
        <span className="text-xs font-semibold uppercase tracking-wide text-primary-700 dark:text-primary-300">
          Today&rsquo;s Usage
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* AI Credits */}
        <div>
          <div className="mb-1 flex items-baseline justify-between text-xs">
            <span className="text-gray-600 dark:text-gray-400">AI Tasks</span>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
              {usage.ai.used}/{usage.ai.limit}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className={`h-2 rounded-full transition-all ${
                aiPercent > 80 ? 'bg-danger-500' : aiPercent > 50 ? 'bg-warn-500' : 'bg-primary-600'
              }`}
              style={{ width: `${aiPercent}%` }}
            />
          </div>
          <span className="mt-1 text-[10px] text-gray-500 dark:text-gray-500">
            {usage.ai.remaining} remaining
          </span>
        </div>

        {/* Chat Messages */}
        <div>
          <div className="mb-1 flex items-baseline justify-between text-xs">
            <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
              <MessageSquare className="h-3 w-3" /> Chat
            </span>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
              {usage.chat.used}/{usage.chat.limit}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className={`h-2 rounded-full transition-all ${
                chatPercent > 80 ? 'bg-danger-500' : chatPercent > 50 ? 'bg-warn-500' : 'bg-primary-400'
              }`}
              style={{ width: `${chatPercent}%` }}
            />
          </div>
          <span className="mt-1 text-[10px] text-gray-500 dark:text-gray-500">
            {usage.chat.remaining} remaining
          </span>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-gray-500 dark:text-gray-500">
        Resets daily at midnight UTC. Upgrade to {tier === 'free' ? 'Pro' : 'Max'} for higher limits.
      </p>
    </div>
  );
}
