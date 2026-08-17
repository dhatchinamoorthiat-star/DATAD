import { Link } from 'react-router-dom';
import { Target, Flame, Sparkles, Leaf, ArrowRight, BookOpen } from 'lucide-react';

// Daily Habit Engine — derives the single suggested action from pre-loaded
// dashboard data. Rules run in priority order; first match wins. Copy stays
// supportive: no "overdue", "behind", or score-shaming, ever.
const RULES = [
  (d) => d.today?.length > 0 && {
    icon: Target,
    message: 'One thing for today, whenever you’re ready.',
    sub: d.today[0]?.title,
    to: '/me/planner',
    severity: 'indigo',
  },
  (d) => d.earlier?.length > 0 && {
    icon: Leaf,
    message: 'A task from earlier is still open — pick it up when it suits you.',
    sub: d.earlier[0]?.title,
    to: '/me/planner',
    severity: 'indigo',
  },
  (d) => d.streak > 0 && !d.caseSolved && d.caseTitle && {
    icon: Flame,
    message: `Today's case will keep your ${d.streak}-day streak going.`,
    sub: d.caseTitle,
    to: '/study#daily-case',
    severity: 'amber',
  },
  (d) => !d.caseSolved && d.caseTitle && {
    icon: Target,
    message: 'Today’s case study is ready when you are.',
    sub: d.caseTitle,
    to: '/study#daily-case',
    severity: 'indigo',
  },
  // Roadmap pending items — the beachhead product focus
  (d) => d.roadmapPending > 0 && {
    icon: BookOpen,
    message: `You have ${d.roadmapPending} skill${d.roadmapPending === 1 ? '' : 's'} to work on in your roadmap.`,
    sub: d.roadmapNext || 'Pick up where you left off',
    to: '/roadmap',
    severity: 'amber',
  },
  // No roadmap yet — create one
  (d) => d.canCreateRoadmap && {
    icon: Sparkles,
    message: 'Build your skill roadmap — know exactly what to learn next.',
    sub: 'Set a target role and generate a 3-month plan',
    to: '/roadmap',
    severity: 'indigo',
  },
  () => ({
    icon: Sparkles,
    message: 'You’re all caught up. Enjoy the space — or wander into something new.',
    sub: 'Your notes and subjects are a click away',
    to: '/study',
    severity: 'green',
  }),
];

const S = {
  amber:  { wrap: 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800/60', icon: 'text-amber-500',   label: 'text-amber-500',   body: 'text-amber-800 dark:text-amber-200' },
  indigo: { wrap: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800/60', icon: 'text-indigo-500', label: 'text-indigo-500', body: 'text-indigo-800 dark:text-indigo-200' },
  green:  { wrap: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800/60', icon: 'text-emerald-500', label: 'text-emerald-500', body: 'text-emerald-800 dark:text-emerald-200' },
};

export default function TodayFocus({ data }) {
  if (!data) return null;
  const focus = RULES.reduce((found, rule) => found || rule(data), null);
  if (!focus) return null;

  const Icon = focus.icon;
  const s = S[focus.severity];

  return (
    <Link
      to={focus.to}
      className={`flex items-start gap-3 rounded-2xl border p-4 transition-opacity hover:opacity-90 ${s.wrap}`}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${s.icon}`} />
      <div className="min-w-0 flex-1">
        <p className={`text-[10px] font-bold uppercase tracking-widest ${s.label}`}>Today&rsquo;s focus</p>
        <p className={`mt-0.5 text-sm font-semibold ${s.body}`}>{focus.message}</p>
        {focus.sub && <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{focus.sub}</p>}
      </div>
      <ArrowRight className={`mt-1 h-4 w-4 shrink-0 ${s.icon}`} />
    </Link>
  );
}
