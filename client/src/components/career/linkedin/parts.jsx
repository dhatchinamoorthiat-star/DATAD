/**
 * Shared primitives for the LinkedIn Enhancer.
 *
 * These exist so the honesty guarantees the backend makes survive into the
 * interface. A recommendation the system is unsure about has to *look* unsure;
 * a rewrite that could not be produced without a fact from the student has to
 * show the question rather than a blank. Building those as components means no
 * panel can quietly forget to render them.
 */

import { ShieldCheck, ShieldQuestion, Shield, Zap, Clock, Hammer, HelpCircle } from 'lucide-react';

const CONFIDENCE = {
  high:   { label: 'High confidence',   icon: ShieldCheck,     cls: 'text-emerald-600 dark:text-emerald-400' },
  medium: { label: 'Medium confidence', icon: Shield,          cls: 'text-indigo-600 dark:text-indigo-400' },
  low:    { label: 'Low confidence',    icon: ShieldQuestion,  cls: 'text-amber-600 dark:text-amber-400' },
};

/**
 * Never hidden, even at high confidence. A recommendation whose confidence is
 * only shown when it is low teaches people to ignore the badge.
 */
export function ConfidenceBadge({ level = 'medium', note }) {
  const { label, icon: Icon, cls } = CONFIDENCE[level] || CONFIDENCE.medium;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${cls}`} title={note || label}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  );
}

const EFFORT = {
  low:    { label: 'Quick edit',      icon: Zap,    cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  medium: { label: 'One sitting',     icon: Clock,  cls: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' },
  high:   { label: 'Needs new work',  icon: Hammer, cls: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
};

export function EffortBadge({ effort = 'medium' }) {
  const { label, icon: Icon, cls } = EFFORT[effort] || EFFORT.medium;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      <Icon className="h-2.5 w-2.5" aria-hidden="true" />
      {label}
    </span>
  );
}

/**
 * The questions the analysis needs answered before it can write a stronger
 * version. Shown in place of a rewrite rather than alongside one — the whole
 * point is that no rewrite was invented to fill the gap.
 */
export function EvidenceNeeded({ questions = [] }) {
  if (!questions.length) return null;

  return (
    <div className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50/60 p-3 dark:border-amber-800/50 dark:bg-amber-950/20">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-400">
        <HelpCircle className="h-3 w-3" aria-hidden="true" />
        Only you can answer this
      </p>
      <ul className="mt-1.5 space-y-1">
        {questions.map((q, i) => (
          <li key={i} className="text-sm leading-relaxed text-amber-900 dark:text-amber-200">{q}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Before / problem / after / why — the shape every rewrite is presented in.
 * `after` is genuinely optional: when the model could not write one without
 * inventing something, the card shows the diagnosis and the missing questions
 * instead of an empty box.
 */
export function BeforeAfter({ before, problem, after, why, evidenceNeeded = [], confidence, label }) {
  return (
    <div className="rounded-2xl border border-gray-200/80 p-4 dark:border-gray-800/80">
      {label && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{label}</p>
          {confidence && <ConfidenceBadge level={confidence} />}
        </div>
      )}

      {before && (
        <div className="mb-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Now</p>
          <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm leading-relaxed text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
            {before}
          </p>
        </div>
      )}

      {problem && (
        <div className="mb-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-rose-500">The problem</p>
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">{problem}</p>
        </div>
      )}

      {after ? (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-600">Stronger</p>
          <p className="whitespace-pre-line rounded-lg bg-emerald-50/70 px-3 py-2 text-sm leading-relaxed text-gray-800 dark:bg-emerald-950/20 dark:text-gray-200">
            {after}
          </p>
          {why && <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{why}</p>}
        </div>
      ) : (
        evidenceNeeded.length === 0 && (
          <p className="text-xs text-gray-400">No rewrite was generated for this one.</p>
        )
      )}

      <EvidenceNeeded questions={evidenceNeeded} />
    </div>
  );
}

/** A labelled horizontal meter. Width is inline because the value is data. */
export function Meter({ label, value, max = 100, hint }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  const tone = pct >= 75 ? 'bg-emerald-500' : pct >= 45 ? 'bg-amber-500' : 'bg-indigo-500';

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className="text-sm tabular-nums text-gray-500 dark:text-gray-400">
          {Math.round(value)}<span className="text-gray-300 dark:text-gray-600">/{max}</span>
        </span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
        role="meter"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        <div className={`h-full rounded-full transition-[width] duration-700 ease-out ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      {hint && <p className="mt-1 text-[11px] leading-snug text-gray-400">{hint}</p>}
    </div>
  );
}

export function Pill({ children, tone = 'gray' }) {
  const TONES = {
    gray:    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
    green:   'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    amber:   'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    rose:    'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
    indigo:  'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}
