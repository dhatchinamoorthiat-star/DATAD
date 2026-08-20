import { Link } from 'react-router-dom';
import {
  CalendarDays, Wallet, BookLock, ArrowRight, HeartHandshake,
  Smile,
} from 'lucide-react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import useAsync from '../../hooks/useAsync';
import { listTasks } from '../../api/tasks';
import { daysUntil, formatDate } from '../../utils/dateUtils';
import { Skeleton } from '../../components/common/Skeleton';
import ErrorState from '../../components/common/ErrorState';
import DailyTip from '../../components/common/DailyTip';
import { Page } from '../../components/common/motion';

const FEATURE_CARDS = [
  { to: '/me/journal', icon: BookLock, title: 'Journal', sub: 'Private reflection & mood tracking', color: 'text-primary-500', bg: 'bg-primary-50 dark:bg-primary-950/40' },
  { to: '/me/planner', icon: CalendarDays, title: 'Planner', sub: 'Tasks, goals and deadlines', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/40' },
  { to: '/finance', icon: Wallet, title: 'Finance', sub: 'Budget, calculators & tracker', color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
  { to: '/wellbeing', icon: HeartHandshake, title: 'Wellbeing', sub: 'Breathe, meditate, recharge', color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-950/40' },
];

export default function MeHubPage() {
  useDocumentTitle('Personal');
  const { data: allTasks, error, loading, reload } = useAsync(() => listTasks(), []);

  const dateLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
  });

  if (loading) {
    return (
      <Page>
        <div className="flex items-center justify-between py-4">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="mt-8 grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-gray-200/80 bg-white p-6 text-center dark:border-gray-800/80 dark:bg-gray-900">
              <Skeleton className="mx-auto h-8 w-12" />
              <Skeleton className="mx-auto mt-2 h-3 w-14" />
            </div>
          ))}
        </div>
      </Page>
    );
  }

  if (error) {
    return (
      <Page>
        <ErrorState title="Could not load your tasks" onRetry={reload} className="mt-8" />
      </Page>
    );
  }

  // Counts come from every open task, not from the display slice below. They
  // used to be derived from the truncated list, which capped "Overdue" at six
  // and hid anything more than a week late — the tasks that most need saying.
  const open = (allTasks || []).filter((t) => t.status !== 'done');
  const due = open.filter((t) => daysUntil(t.dueDate) === 0).length;
  const overdue = open.filter((t) => daysUntil(t.dueDate) < 0).length;
  const upcoming = open.filter((t) => daysUntil(t.dueDate) > 0 && daysUntil(t.dueDate) <= 7).length;

  // The "Up next" list stays short on purpose — recent and near-term only.
  const tasks = open
    .filter((t) => daysUntil(t.dueDate) >= -7)
    .sort((a, b) => new Date(a.dueDate || 8640000000000000) - new Date(b.dueDate || 8640000000000000))
    .slice(0, 6);

  return (
    <Page overview={{
      pageKey: 'life-hub',
      title: 'Keeping yourself organised',
      blurb: 'Your journal, task planner and calendar — the personal side of the week, separate from coursework and the job hunt.',
      takeaway: 'Check the planner first; anything dated is already on the calendar.',
    }}>
      {/* TOP BAR — date + snapshot label */}
      <div className="flex items-center justify-between py-4">
        <span className="text-xs font-medium tracking-wide text-gray-400">
          {dateLabel}
        </span>
        <span className="text-xs font-medium tracking-wide text-gray-400">
          Snapshot
        </span>
      </div>

      {/* LIFE SNAPSHOT — 3 tiles as the signature */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-warn-200/60 bg-warn-50 p-6 text-center dark:border-warn-800/40 dark:bg-warn-950/30">
          <p className="text-3xl font-bold tabular-nums text-warn-700">{due}</p>
          <p className="mt-1 text-xs font-medium text-warn-700/70">Due today</p>
        </div>
        <div className={`rounded-2xl border p-6 text-center ${
          overdue > 0
            ? 'border-danger-200/60 bg-danger-50 dark:border-danger-800/40 dark:bg-danger-950/30'
            : 'border-gray-200/60 bg-white dark:border-gray-800 dark:bg-gray-900'
        }`}>
          <p className={`text-3xl font-bold tabular-nums ${overdue > 0 ? 'text-danger-500' : 'text-gray-400'}`}>
            {overdue}
          </p>
          <p className={`mt-1 text-xs font-medium ${overdue > 0 ? 'text-danger-400' : 'text-gray-400'}`}>
            Overdue
          </p>
        </div>
        <div className="rounded-2xl border border-primary-200/60 bg-primary-50 p-6 text-center dark:border-primary-800/40 dark:bg-primary-950/30">
          <p className="text-3xl font-bold tabular-nums text-primary-600">{upcoming}</p>
          <p className="mt-1 text-xs font-medium text-primary-500/70">This week</p>
        </div>
      </div>

      <DailyTip workspace="me" className="mt-6" />

      {/* FEATURE CARDS — 2×2 grid */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        {FEATURE_CARDS.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="rounded-2xl border border-gray-200/80 bg-white p-4 transition-all hover:border-primary-200 dark:border-gray-800/80 dark:bg-gray-900 dark:hover:border-primary-800/60"
          >
            <div className={`mb-3 w-fit rounded-xl p-2 ${c.bg}`}>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{c.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{c.sub}</p>
          </Link>
        ))}
      </div>

      {/* UPCOMING TASKS — compact */}
      <div className="mt-8 rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Up next</span>
          <Link to="/me/planner" className="flex items-center gap-1 text-[10px] font-medium text-primary-600 hover:underline dark:text-primary-400">
            Open planner <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {tasks.length === 0 ? (
          <div className="py-4 text-center">
            <Smile className="mx-auto mb-2 h-6 w-6 text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-400">Nothing due — plan tomorrow tonight.</p>
            <Link to="/me/planner" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400">
              Add a task <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {tasks.map((t) => {
              const days = daysUntil(t.dueDate);
              return (
                <li key={t._id} className="flex items-center justify-between text-sm">
                  <span className="truncate text-gray-700 dark:text-gray-300">{t.title}</span>
                  <span className={`ml-2 shrink-0 text-xs ${days < 0 ? 'text-danger-500 font-medium' : days <= 1 ? 'text-warn-700 font-medium' : 'text-gray-400'}`}>
                    {days < 0 ? 'Overdue · ' : days === 0 ? 'Today · ' : ''}{formatDate(t.dueDate)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Page>
  );
}
