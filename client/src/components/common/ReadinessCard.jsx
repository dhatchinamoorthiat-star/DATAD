import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gauge, ArrowRight, Sparkles, Lock } from 'lucide-react';
import { getReadiness } from '../../api/readiness';
import ScoreRing from './ScoreRing';

const COMPONENT_LINKS = {
  resume: '/placement/resume',
  companies: '/placement/companies',
  market: '/briefing',
  planner: '/me/planner',
};

const barColor = (frac) => {
  if (frac >= 0.75) return 'bg-emerald-500';
  if (frac >= 0.4) return 'bg-amber-500';
  return 'bg-indigo-400';
};

// Pristine "not started" card — shows curiosity CTA instead of 0s
function StartCard() {
  return (
    <div className="card-hover mb-4 rounded-2xl border border-indigo-200/60 bg-indigo-50 p-5 dark:border-indigo-800/40 dark:bg-indigo-950/30">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <Gauge className="h-4 w-4 text-indigo-500" /> Placement Readiness
      </h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Your personalised placement score, built from what you&rsquo;ve actually done.
      </p>
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="relative h-28 w-28">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" strokeWidth="9" className="stroke-gray-100 dark:stroke-gray-800" />
            <circle cx="50" cy="50" r="42" fill="none" strokeWidth="9" strokeDasharray="6 8" className="stroke-indigo-300 dark:stroke-indigo-700" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Lock className="h-6 w-6 text-indigo-400" />
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Curious about your score?</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs">
            Build your resume, research companies, read briefings, and add prep tasks — your score will appear automatically.
          </p>
        </div>
        <Link
          to="/placement/resume"
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Sparkles className="h-4 w-4" /> Start building your profile
        </Link>
      </div>
    </div>
  );
}

// `data` is optional: pass it when the parent already has readiness loaded
// (the Career hub does) and this skips its own fetch.
export default function ReadinessCard({ data: provided }) {
  const [fetched, setFetched] = useState(null);
  const data = provided ?? fetched;

  useEffect(() => {
    if (provided) return;
    getReadiness().then((res) => setFetched(res.data)).catch(() => {});
  }, [provided]);

  if (!data) return null;

  // Show the "start now" card if score is still at 0 (nothing done yet)
  if (data.score === 0) return <StartCard />;

  const weakest = [...data.components].filter((c) => c.hint).sort((a, b) => a.points / a.max - b.points / b.max)[0];

  return (
    <div className="card-hover mb-4 rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        <Gauge className="h-4 w-4 text-indigo-500" /> Placement readiness
      </h2>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <ScoreRing score={data.score} />
        <div className="min-w-0 flex-1 space-y-2.5">
          {data.components.map((c) => {
            const frac = c.max ? c.points / c.max : 0;
            return (
              <Link key={c.key} to={COMPONENT_LINKS[c.key] || '/'} className="group block">
                <div className="mb-0.5 flex items-center justify-between text-xs">
                  <span className="font-medium text-gray-600 group-hover:text-indigo-600 dark:text-gray-300 dark:group-hover:text-indigo-400">{c.label}</span>
                  {frac > 0 && <span className="tabular-nums text-gray-400">{c.points}/{c.max}</span>}
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div className={`h-full rounded-full transition-all duration-700 ${barColor(frac)}`}
                    style={{ width: `${frac > 0 ? Math.max(frac * 100, 4) : 0}%` }} />
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <Link to={weakest ? COMPONENT_LINKS[weakest.key] : '/placement/companies'}
        className="mt-4 flex items-center justify-between rounded-xl bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60">
        <span>{data.nextAction}</span>
        <ArrowRight className="h-4 w-4 shrink-0" />
      </Link>
    </div>
  );
}
