/**
 * The score panel.
 *
 * The rule this component enforces: the number is never shown alone. Every
 * dimension can be expanded into the checks behind it, and each failed check
 * carries what was observed and what to do — so "Searchability 71" is always
 * one click from "you carry 40% of the high-value terms for this role, and
 * these are the ones missing".
 */

import { useState } from 'react';
import { ChevronDown, Check, Minus, X, Info } from 'lucide-react';
import ScoreRing from '../../common/ScoreRing';
import Card from '../../common/Card';
import { Meter } from './parts';

// What each section is called when we have to tell a student we could not see
// it. Keyed by the section names the scorer reports in `skippedBecause`.
const SECTION_LABEL = {
  recommendations: 'your recommendations',
  featured: 'your Featured section',
  projects: 'your projects',
  skills: 'your full skills list',
  volunteer: 'your volunteering',
  activity: 'your posts and activity',
};

/**
 * The honest footnote on a PDF-sourced score.
 *
 * LinkedIn's export leaves several sections out entirely, so those checks were
 * skipped rather than failed. Saying so matters twice over: it stops the score
 * reading as a judgement on sections we never saw, and it tells the student
 * exactly what pasting their profile instead would add.
 */
function BlindSpots({ analysis }) {
  const skipped = (analysis.checks || []).filter((c) => c.skippedBecause?.length);
  if (!skipped.length) return null;

  const sections = [...new Set(skipped.flatMap((c) => c.skippedBecause))];

  return (
    <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-indigo-200/70 bg-indigo-50/50 p-3.5 dark:border-indigo-800/50 dark:bg-indigo-950/20">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" aria-hidden="true" />
      <p className="text-xs leading-relaxed text-indigo-900 dark:text-indigo-200">
        Your PDF export does not include {sections.map((s) => SECTION_LABEL[s] || s).join(', ')}, so{' '}
        {skipped.length === 1 ? 'one check was' : `${skipped.length} checks were`} left out of this score rather
        than counted against you. Paste your profile instead to have {sections.length === 1 ? 'it' : 'them'} assessed.
      </p>
    </div>
  );
}

const STATUS = {
  pass:    { icon: Check, cls: 'text-emerald-500', label: 'Met' },
  partial: { icon: Minus, cls: 'text-amber-500',   label: 'Partly met' },
  fail:    { icon: X,     cls: 'text-rose-400',    label: 'Not met' },
};

const BAND = (score) => {
  if (score >= 80) return 'Strong. The remaining work is refinement.';
  if (score >= 60) return 'Solid foundation, with specific gaps holding it back.';
  if (score >= 40) return 'The material is there. The positioning is not.';
  return 'Early. The fastest gains are in the first three fixes below.';
};

export default function LinkedInScore({ analysis, dimensionLabels }) {
  const [openDimension, setOpenDimension] = useState(null);

  const { score, dimensions, checks, target } = analysis;
  const checksFor = (key) => checks.filter((c) => c.dimension === key && c.status !== 'skipped');

  return (
    <Card padding="lg">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-5">
          <ScoreRing score={score} size={28} />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">LinkedIn strength</p>
            <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{BAND(score)}</p>
            {target?.role && (
              <p className="mt-1.5 text-xs text-gray-400">
                Measured against <span className="font-medium text-gray-600 dark:text-gray-300">{target.role}</span>
                {target.seniority ? ` · ${target.seniority} level` : ''}
                {target.inferred && ' · target inferred from your DATAD profile'}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {Object.entries(dimensions).map(([key, dim]) => {
          const label = dimensionLabels?.[key]?.label || key;
          const open = openDimension === key;
          const relevant = checksFor(key);

          return (
            <div key={key}>
              <button
                type="button"
                onClick={() => setOpenDimension(open ? null : key)}
                className="w-full text-left"
                aria-expanded={open}
              >
                <Meter label={label} value={dim.score} max={dim.max} />
                <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary-600 dark:text-primary-400">
                  {open ? 'Hide' : 'Why'}
                  <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
                </span>
              </button>

              {open && (
                <ul className="mt-2 space-y-2 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
                  {relevant.map((check) => {
                    const { icon: Icon, cls, label: statusLabel } = STATUS[check.status] || STATUS.fail;
                    return (
                      <li key={check.key} className="flex gap-2">
                        <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${cls}`} aria-label={statusLabel} />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-700 dark:text-gray-200">{check.label}</p>
                          {check.why && (
                            <p className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{check.why}</p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <BlindSpots analysis={analysis} />

      <p className="mt-5 text-[11px] leading-relaxed text-gray-400">
        Scored by a fixed rule set (version {analysis.rulesVersion}), not by a language model — the same profile
        always produces the same number.
        {analysis.target?.roleMatched === null && ' Your target role is not in our role library yet, so the keyword checks were skipped rather than guessed.'}
      </p>
    </Card>
  );
}
