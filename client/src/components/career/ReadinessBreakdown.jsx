// The "why" behind the readiness score — strengths, on-track areas, and the
// growth opportunities, each with one concrete action.
//
// Extracted from the old ReadinessPage so the Career hub can render it from the
// readiness data it already fetches, instead of a second getReadiness() call.
import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowRight, TrendingUp, Zap } from 'lucide-react';
import TierGate from '../common/TierGate';
import { FEATURE } from '../../utils/planFeatures';
import { RowSkeleton } from '../common/Skeleton';

const COMPONENT_LINKS = {
  resume: '/career/resume',
  companies: '/career/companies',
  market: '/briefing',
  planner: '/me/planner',
};

const HOW_TO_IMPROVE = {
  resume: 'Fill in every section of your resume — experience, education, skills, projects, and certifications each add points.',
  companies: 'Save companies to your watchlist and read their prep cards. Each card you study counts toward your score.',
  // Points come from bookmarks and interests — see the market block in
  // server/controllers/readinessController.js. This used to promise that
  // opening a briefing scored, which nothing has ever measured.
  market: 'Bookmark news stories you could discuss in an interview — each of the first five adds points — and set your news interests.',
  planner: 'Add and complete interview-prep tasks in your planner. Completed tasks are weighted toward your score.',
};

const band = (c) => {
  if (!c.max) return null;
  const frac = c.points / c.max;
  if (frac >= 0.75) return 'strength';
  if (frac >= 0.4) return 'onTrack';
  return 'weak';
};

export default function ReadinessBreakdown({ data }) {
  const components = data?.components ?? [];
  const strengths = components.filter((c) => band(c) === 'strength');
  const onTrack   = components.filter((c) => band(c) === 'onTrack');
  const weak      = components.filter((c) => band(c) === 'weak');

  return (
    <TierGate
      feature={FEATURE.READINESS_SCORE}
      description="See where your score comes from — your strengths, your next steps, and one clear action for each area."
    >
      {!data ? (
        <div className="space-y-3">
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : (
        <div className="space-y-5">
          {strengths.length > 0 && (
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-success-700 dark:text-success-400">
                <CheckCircle2 className="h-4 w-4" /> Strengths
              </h3>
              <ul className="space-y-2">
                {strengths.map((c) => (
                  <li key={c.key} className="flex items-start gap-3 rounded-xl border border-success-100 bg-success-50/60 px-4 py-3 dark:border-success-900/30 dark:bg-success-900/10">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{c.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{c.points}/{c.max} pts · Keep it up</p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-success-700 dark:text-success-400">
                      {Math.round((c.points / c.max) * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {onTrack.length > 0 && (
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-warn-700 dark:text-warn-400">
                <TrendingUp className="h-4 w-4" /> On track
              </h3>
              <ul className="space-y-2">
                {onTrack.map((c) => (
                  <li key={c.key} className="rounded-xl border border-warn-100 bg-warn-50/60 px-4 py-3 dark:border-warn-900/30 dark:bg-warn-900/10">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{c.label}</p>
                      <span className="text-xs font-semibold text-warn-700 dark:text-warn-400">
                        {c.points}/{c.max} pts
                      </span>
                    </div>
                    {c.hint && <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">{c.hint}</p>}
                    <p className="mb-2 text-xs text-gray-400 dark:text-gray-500">{HOW_TO_IMPROVE[c.key]}</p>
                    <Link
                      to={COMPONENT_LINKS[c.key] || '/'}
                      className="inline-flex items-center gap-1 text-xs font-medium text-warn-700 hover:underline dark:text-warn-400"
                    >
                      Improve this <ArrowRight className="h-3 w-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {weak.length > 0 && (
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-primary-600 dark:text-primary-400">
                <Zap className="h-4 w-4" /> Growth opportunities
              </h3>
              <ul className="space-y-2">
                {weak.map((c) => (
                  <li key={c.key} className="rounded-xl border border-primary-100 bg-primary-50/60 px-4 py-3 dark:border-primary-900/30 dark:bg-primary-900/10">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{c.label}</p>
                      {c.points > 0 && (
                        <span className="text-xs font-semibold text-primary-500">
                          {c.points}/{c.max} pts
                        </span>
                      )}
                    </div>
                    {c.hint && <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">{c.hint}</p>}
                    <p className="mb-2 text-xs text-gray-400 dark:text-gray-500">{HOW_TO_IMPROVE[c.key]}</p>
                    <Link
                      to={COMPONENT_LINKS[c.key] || '/'}
                      className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-500"
                    >
                      Start here <ArrowRight className="h-3 w-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-xl border border-gray-200/80 bg-white p-4 dark:border-gray-800/80 dark:bg-gray-900">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300">
              <Zap className="h-4 w-4 text-primary-500" /> How to improve each area
            </h3>
            <ul className="space-y-3">
              {components.map((c) => (
                <li key={c.key} className="flex items-start gap-3">
                  <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary-400" />
                  <div>
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      {c.label} <span className="font-normal text-gray-400">({c.points}/{c.max} pts)</span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{HOW_TO_IMPROVE[c.key]}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </TierGate>
  );
}
