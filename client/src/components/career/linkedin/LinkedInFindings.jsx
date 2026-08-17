/**
 * The analysis body: action plan, section rewrites, keywords, skills, proof,
 * red flags and the upgrade plan.
 *
 * Ordered by what a student should do with it rather than by how the data is
 * produced — the ranked actions come first, the evidence behind them follows.
 */

import { useState } from 'react';
import {
  Target, Search, Award, ShieldAlert, CalendarDays, Users, Briefcase,
  Fingerprint, Star, ChevronDown, AlertTriangle,
} from 'lucide-react';
import Card from '../../common/Card';
import { BeforeAfter, ConfidenceBadge, EffortBadge, EvidenceNeeded, Pill } from './parts';

function Section({ icon: Icon, title, subtitle, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="mt-6">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="mb-3 flex w-full items-center gap-2.5 text-left"
        aria-expanded={open}
      >
        <Icon className="h-4 w-4 shrink-0 text-primary-500" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-gray-800 dark:text-gray-100">{title}</span>
          {subtitle && <span className="block text-xs text-gray-400">{subtitle}</span>}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-300 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && children}
    </section>
  );
}

function RecommendationCard({ rec, rank }) {
  return (
    <Card padding="md">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-600 dark:bg-primary-900/40 dark:text-primary-300">
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-gray-800 dark:text-gray-100">{rec.issue}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{rec.action}</p>
          <p className="mt-1.5 text-xs leading-relaxed text-gray-400">{rec.whyItMatters}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <EffortBadge effort={rec.effort} />
            <Pill tone="indigo">{rec.expectedImpact}</Pill>
            <ConfidenceBadge level={rec.confidence} />
            {rec.needsUserInput && <Pill tone="amber">Needs a fact only you have</Pill>}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function LinkedInFindings({ analysis }) {
  const {
    actionPlan, narrative, keywords, skills, redFlags, authenticity,
    upgradePlan, recommendationStrategy, jobMatch,
  } = analysis;

  return (
    <div>
      {/* ── Biggest opportunities ─────────────────────────────────────── */}
      <Section icon={Target} title="Biggest opportunities" subtitle="Ranked by impact against the effort it takes">
        <div className="space-y-3">
          {actionPlan?.fixNow?.length
            ? actionPlan.fixNow.map((rec, i) => <RecommendationCard key={rec.key} rec={rec} rank={i + 1} />)
            : <p className="text-sm text-gray-400">Nothing urgent — every high-impact check passed.</p>}
        </div>

        {actionPlan?.improveNext?.length > 0 && (
          <details className="mt-4 group">
            <summary className="cursor-pointer text-xs font-semibold text-primary-600 dark:text-primary-400">
              Then these ({actionPlan.improveNext.length})
            </summary>
            <div className="mt-3 space-y-3">
              {actionPlan.improveNext.map((rec, i) => (
                <RecommendationCard key={rec.key} rec={rec} rank={actionPlan.fixNow.length + i + 1} />
              ))}
            </div>
          </details>
        )}

        {actionPlan?.longTerm?.length > 0 && (
          <div className="mt-4 rounded-2xl border border-dashed border-gray-200 p-4 dark:border-gray-800">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400">
              Longer term — these need work you have not done yet
            </p>
            <ul className="space-y-2">
              {actionPlan.longTerm.map((rec) => (
                <li key={rec.key} className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                  <span className="font-medium text-gray-800 dark:text-gray-200">{rec.action}</span>
                  <span className="block text-xs text-gray-400">{rec.issue}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      {/* ── Writing review ────────────────────────────────────────────── */}
      {narrative?.unavailable ? (
        <Section icon={Fingerprint} title="Writing review">
          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200/80 bg-amber-50/60 p-4 text-sm text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/20 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              {narrative.unavailable === 'skipped'
                ? 'The writing review was not run for this analysis.'
                : narrative.unavailable}
            </p>
          </div>
        </Section>
      ) : (
        <>
          {narrative?.headline?.recommended || narrative?.headline?.problems?.length ? (
            <Section icon={Target} title="Headline" subtitle="The first thing a recruiter reads, and the only thing most of them read">
              {narrative.headline.problems?.length > 0 && (
                <ul className="mb-3 space-y-1.5">
                  {narrative.headline.problems.map((p, i) => (
                    <li key={i} className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">• {p}</li>
                  ))}
                </ul>
              )}

              {narrative.headline.recommended && (
                <BeforeAfter
                  label="Recommended"
                  after={narrative.headline.recommended}
                  why={narrative.headline.explanation}
                  confidence={narrative.headline.confidence}
                />
              )}

              {narrative.headline.alternatives?.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Alternatives</p>
                  {narrative.headline.alternatives.map((alt, i) => (
                    <p key={i} className="rounded-lg border border-gray-200/80 px-3 py-2 text-sm text-gray-700 dark:border-gray-800/80 dark:text-gray-300">
                      {alt}
                    </p>
                  ))}
                </div>
              )}

              {narrative.headline.keywordsAdded?.length > 0 && (
                <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
                  Terms added:
                  {narrative.headline.keywordsAdded.map((k) => <Pill key={k} tone="green">{k}</Pill>)}
                </p>
              )}
            </Section>
          ) : null}

          {(narrative?.about?.rewrite || narrative?.about?.problems?.length > 0) && (
            <Section icon={Fingerprint} title="About" subtitle="Your only chance to sound like a person">
              {narrative.about.problems?.length > 0 && (
                <ul className="mb-3 space-y-1.5">
                  {narrative.about.problems.map((p, i) => (
                    <li key={i} className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">• {p}</li>
                  ))}
                </ul>
              )}

              {narrative.about.structure?.length > 0 && (
                <ol className="mb-3 space-y-1 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
                  {narrative.about.structure.map((line, i) => (
                    <li key={i} className="text-xs leading-relaxed text-gray-600 dark:text-gray-300">{line}</li>
                  ))}
                </ol>
              )}

              {narrative.about.rewrite ? (
                <BeforeAfter
                  label="Suggested rewrite"
                  after={narrative.about.rewrite}
                  confidence={narrative.about.confidence}
                  evidenceNeeded={narrative.about.evidenceNeeded}
                />
              ) : (
                <EvidenceNeeded questions={narrative.about.evidenceNeeded} />
              )}
            </Section>
          )}

          {narrative?.experience?.length > 0 && (
            <Section icon={Briefcase} title="Experience" subtitle="Action → method → outcome, without inventing the outcome">
              <div className="space-y-3">
                {narrative.experience.map((entry, i) => (
                  <BeforeAfter key={i} label={entry.target} {...entry} />
                ))}
              </div>
            </Section>
          )}

          {narrative?.differentiator?.statement && (
            <Section icon={Star} title="What makes you memorable">
              <Card padding="md">
                <p className="text-base font-semibold leading-snug text-gray-800 dark:text-gray-100">
                  {narrative.differentiator.statement}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                  {narrative.differentiator.reasoning}
                </p>
                {narrative.differentiator.buildOn?.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {narrative.differentiator.buildOn.map((b, i) => (
                      <li key={i} className="text-xs text-gray-500 dark:text-gray-400">→ {b}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-3">
                  <ConfidenceBadge level={narrative.differentiator.confidence} />
                </div>
              </Card>
            </Section>
          )}
        </>
      )}

      {/* ── Keywords ──────────────────────────────────────────────────── */}
      <Section
        icon={Search}
        title="Recruiter search"
        subtitle={keywords?.coverage === null
          ? 'Your target role is not in our role library yet'
          : `You carry ${keywords?.coverage}% of the terms recruiters search for this role`}
        defaultOpen={false}
      >
        {keywords?.terms?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-[11px] uppercase tracking-wider text-gray-400 dark:border-gray-800">
                  <th scope="col" className="pb-2 pr-3 font-semibold">Term</th>
                  <th scope="col" className="pb-2 pr-3 font-semibold">Importance</th>
                  <th scope="col" className="pb-2 pr-3 font-semibold">Now</th>
                  <th scope="col" className="pb-2 font-semibold">Where it belongs</th>
                </tr>
              </thead>
              <tbody>
                {keywords.terms
                  .filter((t) => t.importance !== 'low' || !t.present)
                  .slice(0, 24)
                  .map((t) => (
                    <tr key={t.term} className="border-b border-gray-50 last:border-0 dark:border-gray-800/50">
                      <td className="py-2 pr-3 font-medium text-gray-700 dark:text-gray-200">{t.term}</td>
                      <td className="py-2 pr-3">
                        <Pill tone={t.importance === 'high' ? 'rose' : 'gray'}>{t.importance}</Pill>
                      </td>
                      <td className="py-2 pr-3 text-gray-500 dark:text-gray-400">
                        {t.present
                          ? (t.weak ? <Pill tone="amber">Listed only</Pill> : <Pill tone="green">{t.locations.join(', ')}</Pill>)
                          : <Pill tone="rose">Missing</Pill>}
                      </td>
                      <td className="py-2 text-gray-500 dark:text-gray-400">{t.recommendedIn?.join(' + ') || '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No keyword analysis for this target role.</p>
        )}

        {keywords?.stuffing?.detected && (
          <p className="mt-3 rounded-xl bg-amber-50/70 p-3 text-xs leading-relaxed text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
            Adding terms is not the same as repeating them. {keywords.stuffing.headlineIsKeywordList
              ? 'Your headline currently reads as a list rather than a statement.'
              : `These repeat unusually often: ${keywords.stuffing.overusedTerms.join(', ')}.`}
          </p>
        )}
      </Section>

      {/* ── Skills ────────────────────────────────────────────────────── */}
      <Section
        icon={Award}
        title="Skills"
        subtitle={skills?.matchScore != null ? `${skills.matchScore}% match against this role` : undefined}
        defaultOpen={false}
      >
        {skills?.provenButUnlisted?.length > 0 && (
          <div className="mb-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 dark:border-emerald-800/50 dark:bg-emerald-950/20">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
              Quickest win on this page
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-700 dark:text-gray-200">
              You demonstrate {skills.provenButUnlisted.map((s) => s.skill).join(', ')} in your profile but have not
              listed {skills.provenButUnlisted.length === 1 ? 'it' : 'them'} under Skills — which is the field
              recruiters filter on.
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <SkillColumn title="Proven" tone="green" items={skills?.strong} empty="None yet." />
          <SkillColumn title="Claimed, not shown" tone="amber" items={skills?.partial?.map((p) => p.skill)} empty="None." />
          <SkillColumn title="Missing" tone="rose" items={skills?.missing} empty="None." />
        </div>

        {skills?.placement?.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {skills.placement.map((p) => (
              <li key={p.skill} className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                <span className="font-medium text-gray-700 dark:text-gray-200">{p.skill}</span> — demonstrate it with {p.demonstrateIn}.
              </li>
            ))}
          </ul>
        )}

        {skills?.deprioritise?.length > 0 && (
          <p className="mt-4 text-xs leading-relaxed text-gray-400">
            Taking up space without supporting this target: {skills.deprioritise.join(', ')}. Not wrong — just not
            what you want a recruiter to read first.
          </p>
        )}
      </Section>

      {/* ── Recommendations strategy ──────────────────────────────────── */}
      {recommendationStrategy?.targets?.length > 0 && (
        <Section icon={Users} title="Recommendations" subtitle={`You have ${recommendationStrategy.current}`} defaultOpen={false}>
          <div className="space-y-2">
            {recommendationStrategy.targets.map((t, i) => (
              <div key={i} className="rounded-xl border border-gray-200/80 p-3 dark:border-gray-800/80">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                  Ask {t.from} at {t.at}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{t.ask}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-gray-400">{recommendationStrategy.principle}</p>
        </Section>
      )}

      {/* ── Red flags and specificity ─────────────────────────────────── */}
      {(redFlags?.length > 0 || authenticity?.assessable) && (
        <Section icon={ShieldAlert} title="Things a careful reader would notice" defaultOpen={false}>
          {redFlags?.length > 0 && (
            <ul className="space-y-2">
              {redFlags.map((f) => (
                <li key={f.key} className="rounded-xl border border-gray-200/80 p-3 dark:border-gray-800/80">
                  <p className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
                    <Pill tone={f.severity === 'medium' ? 'amber' : 'gray'}>{f.severity}</Pill>
                    <span className="min-w-0">{f.issue}</span>
                  </p>
                  {f.note && <p className="mt-1.5 pl-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{f.note}</p>}
                </li>
              ))}
            </ul>
          )}

          {authenticity?.assessable && (
            <div className="mt-4 rounded-2xl border border-gray-200/80 p-4 dark:border-gray-800/80">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Authenticity &amp; specificity</p>
                <span className="text-sm tabular-nums text-gray-500">{authenticity.specificity}/100</span>
              </div>
              {authenticity.observations?.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {authenticity.observations.map((o, i) => (
                    <li key={i} className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">• {o.detail}</li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-[11px] leading-relaxed text-gray-400">{authenticity.note}</p>
            </div>
          )}
        </Section>
      )}

      {/* ── Job match ─────────────────────────────────────────────────── */}
      {jobMatch?.overall != null && (
        <Section icon={Briefcase} title={`Match against ${jobMatch.label || 'this job'}`} subtitle={`${jobMatch.overall}/100`}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-600">Strong matches</p>
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                {jobMatch.strongMatches?.map((m) => m.term).join(', ') || 'None yet.'}
              </p>
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-rose-500">Missing signals</p>
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                {jobMatch.missingSignals?.join(', ') || 'None.'}
              </p>
            </div>
          </div>

          {jobMatch.emphasise?.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Lead with</p>
              <ul className="space-y-1.5">
                {jobMatch.emphasise.map((e, i) => (
                  <li key={i} className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                    <span className="font-medium text-gray-800 dark:text-gray-200">{e.role} at {e.organization}</span> — {e.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      {/* ── Upgrade plan ──────────────────────────────────────────────── */}
      {upgradePlan?.length > 0 && (
        <Section icon={CalendarDays} title={`Your ${upgradePlan.length}-day LinkedIn upgrade plan`} subtitle="One section per sitting">
          <ol className="space-y-3">
            {upgradePlan.map((day) => (
              <li key={day.day} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  {day.day}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{day.theme}</p>
                  <ul className="mt-1 space-y-0.5">
                    {day.tasks.map((t) => (
                      <li key={t.key} className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                        {t.action}
                        {t.needsUserInput && <span className="ml-1.5 text-amber-600 dark:text-amber-400">(needs a detail only you have)</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            ))}
          </ol>
        </Section>
      )}
    </div>
  );
}

function SkillColumn({ title, tone, items = [], empty }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{title}</p>
      {items?.length
        ? <div className="flex flex-wrap gap-1.5">{items.map((s) => <Pill key={s} tone={tone}>{s}</Pill>)}</div>
        : <p className="text-xs text-gray-400">{empty}</p>}
    </div>
  );
}
