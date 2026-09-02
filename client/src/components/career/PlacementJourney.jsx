import { Link } from 'react-router-dom';
import { FileText, Building2, MessageSquare, Gauge, Trophy, ChevronRight } from 'lucide-react';

// Phase 2 — Placement Journey
// Shows the 5-step placement pipeline with current progress derived from readiness components.

const STEPS = [
  { key: 'resume',    label: 'Resume',        icon: FileText,     to: '/placement/resume',    hint: 'Build your placement resume' },
  { key: 'companies', label: 'Companies',     icon: Building2,    to: '/placement/companies', hint: 'Research & track target companies' },
  { key: 'questions', label: 'Interview Prep', icon: MessageSquare, to: '/placement/questions', hint: 'Practice HR, case & technical rounds' },
  { key: 'market',    label: 'Stay Current',  icon: Gauge,        to: '/briefing',         hint: 'Daily business news & intelligence' },
  { key: 'planner',   label: 'Plan & Track',  icon: Trophy,       to: '/me/planner',       hint: 'Schedule your preparation milestones' },
];

export default function PlacementJourney({ components }) {
  // components = readiness API data.components array
  const scoreMap = {};
  (components || []).forEach((c) => {
    scoreMap[c.key] = c.max ? c.points / c.max : 0;
  });

  // Derive active step: first step that isn't "done" (>= 0.75 fraction)
  const activeIdx = STEPS.findIndex((s) => (scoreMap[s.key] ?? 0) < 0.75);
  const effectiveActive = activeIdx === -1 ? STEPS.length - 1 : activeIdx;

  return (
    <div className="mb-4 rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
      <h2 className="mb-4 text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        Your placement journey
      </h2>

      {/* Desktop horizontal stepper */}
      <div className="hidden sm:flex items-start gap-0">
        {STEPS.map((step, i) => {
          const frac = scoreMap[step.key] ?? 0;
          const done = frac >= 0.75;
          const active = i === effectiveActive;
          const Icon = step.icon;
          const isLast = i === STEPS.length - 1;

          return (
            <div key={step.key} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                {/* connector left */}
                <div className={`h-0.5 flex-1 ${i === 0 ? 'invisible' : done ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
                {/* circle */}
                <Link
                  to={step.to}
                  className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    done
                      ? 'border-primary-500 bg-primary-500 text-white'
                      : active
                      ? 'border-primary-500 bg-white text-primary-600 dark:bg-gray-900 dark:text-primary-400'
                      : 'border-gray-200 bg-white text-gray-400 dark:border-gray-700 dark:bg-gray-900'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {active && !done && (
                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary-500 ring-2 ring-white dark:ring-gray-900" />
                  )}
                </Link>
                {/* connector right */}
                <div className={`h-0.5 flex-1 ${isLast ? 'invisible' : done ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
              </div>
              <Link to={step.to} className="mt-2 flex flex-col items-center gap-0.5 text-center">
                <span className={`text-xs font-semibold ${active ? 'text-primary-600 dark:text-primary-400' : done ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400'}`}>
                  {step.label}
                </span>
                {active && (
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 max-w-[80px] leading-tight">{step.hint}</span>
                )}
              </Link>
            </div>
          );
        })}
      </div>

      {/* Mobile stacked list */}
      <div className="sm:hidden space-y-2">
        {STEPS.map((step, i) => {
          const frac = scoreMap[step.key] ?? 0;
          const done = frac >= 0.75;
          const active = i === effectiveActive;
          const Icon = step.icon;

          return (
            <Link
              key={step.key}
              to={step.to}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                active
                  ? 'bg-primary-50 dark:bg-primary-900/30'
                  : done
                  ? 'opacity-60'
                  : ''
              }`}
            >
              <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                done ? 'bg-primary-500 text-white' : active ? 'border-2 border-primary-500 text-primary-500' : 'border border-gray-300 text-gray-400 dark:border-gray-700'
              }`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <span className={`flex-1 text-sm font-medium ${active ? 'text-primary-700 dark:text-primary-300' : done ? 'text-gray-500 line-through' : 'text-gray-600 dark:text-gray-400'}`}>
                {step.label}
              </span>
              {active && <ChevronRight className="h-4 w-4 text-primary-400" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
