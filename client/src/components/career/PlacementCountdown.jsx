import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, ArrowRight } from 'lucide-react';
import { getMeta } from '../../api/meta';

// Hue carries the meaning (danger = imminent, warn = approaching, primary = distant);
// the surface stays flat so urgency reads from colour, not decoration.
const urgencyClass = (days) => {
  if (days <= 30) return 'bg-danger-500/10 border-danger-200 dark:border-danger-800/60';
  if (days <= 90) return 'bg-warn-500/10 border-warn-200 dark:border-warn-800/60';
  return 'bg-primary-500/10 border-primary-200/80 dark:border-primary-800/60';
};

const urgencyText = (days) => {
  if (days <= 30) return 'text-danger-600 dark:text-danger-400';
  if (days <= 90) return 'text-warn-700 dark:text-warn-400';
  return 'text-primary-600 dark:text-primary-400';
};

export default function PlacementCountdown({ compact = false }) {
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    getMeta().then((res) => setMeta(res.data)).catch(() => setMeta({}));
  }, []);

  if (!meta) return null;
  if (!meta.placementDate) return null;

  const days = Math.ceil((new Date(meta.placementDate) - new Date()) / 86400000);
  if (days < 0) return null; // placement season passed

  const weeks = Math.floor(days / 7);
  const remainingDays = days % 7;

  return (
    <div className={`mb-4 rounded-2xl border p-5 ${urgencyClass(days)}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <CalendarClock className={`h-5 w-5 shrink-0 ${urgencyText(days)}`} />
          <div>
            <p className="text-sm font-semibold">
              {compact ? 'Placement season' : 'Placement season starts'}
            </p>
            {meta.batchName && (
              <p className="text-xs text-gray-500 dark:text-gray-400">{meta.batchName}</p>
            )}
          </div>
        </div>

        <div className={`text-right font-bold tabular-nums ${urgencyText(days)}`}>
          {days === 0 ? (
            <span className="text-lg">Today!</span>
          ) : days === 1 ? (
            <span className="text-lg">Tomorrow</span>
          ) : (
            <div>
              <span className="text-2xl">{days}</span>
              <span className="ml-1 text-sm font-normal text-gray-500">days</span>
              {!compact && weeks > 0 && (
                <p className="text-xs font-normal text-gray-400">
                  {weeks}w {remainingDays}d
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {!compact && days <= 90 && (
        <Link
          to="/placement/readiness"
          className={`mt-3 flex items-center justify-between rounded-xl bg-white/60 px-4 py-2.5 text-sm font-medium dark:bg-black/20 ${urgencyText(days)}`}
        >
          <span>Check your readiness score</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
