import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

const formatINR = (n) => '₹' + n.toLocaleString('en-IN');

// Status is never color-alone: icon + text label accompany the bar color.
const statusFor = (pct) => {
  if (pct <= 75)
    return {
      icon: CheckCircle2,
      label: 'On track',
      bar: 'bg-success-600',
      text: 'text-success-700 dark:text-success-400',
      track: 'bg-success-50 dark:bg-success-950',
    };
  if (pct <= 100)
    return {
      icon: AlertTriangle,
      label: 'Close to limit',
      bar: 'bg-warn-500',
      text: 'text-warn-700 dark:text-warn-400',
      track: 'bg-warn-50 dark:bg-warn-950',
    };
  return {
    icon: XCircle,
    label: 'Over budget',
    bar: 'bg-danger-600',
    text: 'text-danger-600 dark:text-danger-400',
    track: 'bg-danger-50 dark:bg-danger-950',
  };
};

export default function BudgetBar({ spent, budget }) {
  if (!budget) return null;
  const pct = (spent / budget) * 100;
  const s = statusFor(pct);
  const Icon = s.icon;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className={`flex items-center gap-1 font-medium ${s.text}`}>
          <Icon className="h-4 w-4" /> {s.label}
        </span>
        <span className="text-gray-500 dark:text-gray-400">
          {formatINR(spent)} of {formatINR(budget)} ({Math.round(pct)}%)
        </span>
      </div>
      <div className={`h-2 overflow-hidden rounded-full ${s.track}`}>
        <div className={`h-2 rounded-full ${s.bar}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}
