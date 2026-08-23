import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sunrise, ChevronDown, Lock, ArrowRight } from 'lucide-react';
import { getBriefingToday } from '../../api/briefing';
import AIBadge from '../common/AIBadge';

// Section keys in the order a general reader wants them. The server tells us
// which ones matter most for this student's specialisation; those are hoisted
// to the front and opened by default, the rest keep this order behind them.
const SECTION_ORDER = [
  'market', 'finance', 'economy', 'technology',
  'consulting', 'operations', 'placements', 'leadership',
];

const SECTION_LABEL = {
  market: 'Markets',
  finance: 'Finance',
  economy: 'Economy',
  technology: 'Technology',
  consulting: 'Consulting',
  operations: 'Operations',
  placements: 'Placements',
  leadership: 'Leadership',
};

/**
 * Today's briefing, at the top of the page every entry point already promises.
 *
 * The generator has been running at 6am daily and writing these for a long
 * time; nothing ever read them. The dashboard card ("Today's briefing"), the
 * career journey ("Stay Current") and the readiness breakdown all link to
 * /briefing, which renders the news page — so this panel goes there rather than
 * claiming a new route, and those links land on what they promised.
 *
 * Three states worth distinguishing, because they are not the same thing to a
 * reader: no briefing yet today (say nothing), a plan that does not include it
 * (say so, since the pricing page sells it), and a real failure (say nothing —
 * the news page below is still the point of the visit).
 */
export default function DailyBriefingPanel() {
  const [briefing, setBriefing] = useState(null);
  const [locked, setLocked] = useState(null);
  const [openSections, setOpenSections] = useState({});

  useEffect(() => {
    let active = true;
    getBriefingToday()
      .then(({ data }) => {
        if (!active) return;
        setBriefing(data);
        const priority = data?._personalization?.prioritySections || [];
        // Open the sections chosen for this specialisation; leave the rest shut
        // so the panel stays a briefing rather than a wall.
        setOpenSections(Object.fromEntries(priority.map((k) => [k, true])));
      })
      .catch((err) => {
        if (!active) return;
        if (err.response?.status === 403) setLocked(err.response.data);
      });
    return () => { active = false; };
  }, []);

  if (locked) {
    return (
      <div className="mb-4 flex items-start gap-3 rounded-2xl border border-gray-200/80 bg-gray-50/60 p-4 dark:border-gray-800/80 dark:bg-gray-900/60">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Today&rsquo;s briefing</p>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            A written summary of what moved and why, prepared each morning for your program.
            {locked.requiredTier ? ` Included from the ${locked.requiredTier} plan.` : ''}
          </p>
          <Link
            to={locked.upgradeUrl || '/subscribe'}
            className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
          >
            See plans <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    );
  }

  if (!briefing) return null;

  const priority = briefing._personalization?.prioritySections || [];
  const present = SECTION_ORDER.filter((k) => briefing.sections?.[k]);
  const ordered = [
    ...priority.filter((k) => present.includes(k)),
    ...present.filter((k) => !priority.includes(k)),
  ];

  const toggle = (key) => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <section className="mb-4 rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
      <div className="flex items-start gap-3">
        <Sunrise className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            Today&rsquo;s briefing
          </p>
          <h2 className="mt-0.5 text-base font-bold leading-snug text-gray-900 dark:text-gray-100">
            {briefing.headline}
          </h2>
        </div>
      </div>

      {briefing.keyNumbers?.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {briefing.keyNumbers.map((n) => (
            <li
              key={n}
              className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-900/60 dark:text-gray-300"
            >
              {n}
            </li>
          ))}
        </ul>
      )}

      {ordered.length > 0 && (
        <div className="mt-3 space-y-1">
          {ordered.map((key) => {
            const open = Boolean(openSections[key]);
            return (
              <div key={key} className="rounded-xl bg-white/60 dark:bg-gray-900/40">
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left"
                >
                  <ChevronDown
                    className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${open ? '' : '-rotate-90'}`}
                  />
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {SECTION_LABEL[key] || key}
                  </span>
                  {priority.includes(key) && (
                    <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                      for you
                    </span>
                  )}
                </button>
                {open && (
                  <p className="px-3 pb-2.5 pl-8 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                    {briefing.sections[key]}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {briefing.mustKnowTerm?.term && (
        <p className="mt-3 rounded-xl bg-white/60 px-3 py-2 text-sm dark:bg-gray-900/40">
          <span className="font-semibold text-gray-800 dark:text-gray-200">{briefing.mustKnowTerm.term}</span>
          <span className="text-gray-600 dark:text-gray-400"> — {briefing.mustKnowTerm.definition}</span>
        </p>
      )}

      {briefing.interviewTip && (
        <p className="mt-2 rounded-xl bg-white/60 px-3 py-2 text-sm italic leading-relaxed text-gray-600 dark:bg-gray-900/40 dark:text-gray-400">
          {briefing.interviewTip}
        </p>
      )}

      <AIBadge provider={briefing.model} confidence={briefing.confidence} className="mt-3" />
    </section>
  );
}
