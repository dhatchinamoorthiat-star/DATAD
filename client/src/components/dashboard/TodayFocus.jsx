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
    severity: 'primary',
  },
  (d) => d.earlier?.length > 0 && {
    icon: Leaf,
    message: 'A task from earlier is still open — pick it up when it suits you.',
    sub: d.earlier[0]?.title,
    to: '/me/planner',
    severity: 'primary',
  },
  (d) => d.streak > 0 && !d.caseSolved && d.caseTitle && {
    icon: Flame,
    message: `Today's case will keep your ${d.streak}-day streak going.`,
    sub: d.caseTitle,
    to: '/study#daily-case',
    severity: 'warn',
  },
  (d) => !d.caseSolved && d.caseTitle && {
    icon: Target,
    message: 'Today’s case study is ready when you are.',
    sub: d.caseTitle,
    to: '/study#daily-case',
    severity: 'primary',
  },
  // Roadmap pending items — the beachhead product focus
  (d) => d.roadmapPending > 0 && {
    icon: BookOpen,
    message: `You have ${d.roadmapPending} skill${d.roadmapPending === 1 ? '' : 's'} to work on in your roadmap.`,
    sub: d.roadmapNext || 'Pick up where you left off',
    to: '/roadmap',
    severity: 'warn',
  },
  // No roadmap yet — create one
  (d) => d.canCreateRoadmap && {
    icon: Sparkles,
    message: 'Build your skill roadmap — know exactly what to learn next.',
    sub: 'Set a target role and generate a 3-month plan',
    to: '/roadmap',
    severity: 'primary',
  },
  () => ({
    icon: Sparkles,
    message: 'You’re all caught up. Enjoy the space — or wander into something new.',
    sub: 'Your notes and subjects are a click away',
    to: '/study',
    severity: 'success',
  }),
];

const S = {
  warn:    { wrap: 'bg-warn-50 border-warn-200 dark:bg-warn-900/20 dark:border-warn-800/60', icon: 'text-warn-600',   label: 'text-warn-600',   body: 'text-warn-800 dark:text-warn-200' },
  primary: { wrap: 'bg-primary-50 border-primary-200 dark:bg-primary-900/20 dark:border-primary-800/60', icon: 'text-primary-500', label: 'text-primary-500', body: 'text-primary-800 dark:text-primary-200' },
  success: { wrap: 'bg-success-50 border-success-200 dark:bg-success-900/20 dark:border-success-800/60', icon: 'text-success-500', label: 'text-success-500', body: 'text-success-800 dark:text-success-200' },
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
