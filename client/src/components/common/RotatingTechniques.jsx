import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, Shuffle } from 'lucide-react';
import { rotateOrder, rotatedPages } from '../../utils/rotation';

// The Wellbeing technique pages all hold the same shape of content: ~20 dense
// hand-written entries that were being printed in full. That is a wall, and a
// wall gets skimmed to the third item and abandoned — the opposite of what
// careful writing deserves.
//
// This component is the shared answer: one featured entry for the day, then a
// small page of the rest with a stepper to walk through them at the reader's
// pace, and a "show all" escape hatch for anyone who genuinely wants the lot.
// Nothing is deleted; it just isn't all demanded at once.
//
// Why a stepper and not a random re-roll: random repeats entries you already
// read and can leave part of the pool permanently unseen, which recreates the
// "why bother" feeling this exists to fix. Stepping the daily-rotated order
// guarantees one lap shows everything exactly once.

// Entries shown per step. Four fills roughly a screen of these paragraph-length
// items without the page needing a scroll to reach the control.
const PER_PAGE = 4;

function Entry({ item }) {
  return (
    <li>
      <p className="text-sm font-medium">{item.title}</p>
      <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{item.body}</p>
      {item.link && (
        <Link
          to={item.link.to}
          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          {item.link.label} <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </li>
  );
}

// `accent` carries the per-page colour for the featured card — each Wellbeing
// page has its own hue and losing that would make the four read as one page.
export default function RotatingTechniques({ items, seedKey, todayLabel, accent, perPage = PER_PAGE }) {
  const [today, ...rest] = useMemo(() => rotateOrder(items, seedKey), [items, seedKey]);
  const pages = useMemo(() => rotatedPages(rest, perPage, `${seedKey}-rest`), [rest, perPage, seedKey]);

  const [page, setPage] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? rest : (pages[page] || []);

  // Position of the current step within the whole pool, so the reader can see
  // they are making progress rather than looping blindly.
  const from = page * perPage + 1;
  const to = Math.min(from + perPage - 1, rest.length);

  return (
    <>
      {today && (
        <section className={`mb-4 rounded-2xl border p-6 ${accent.card}`}>
          <p className={`mb-1.5 text-[11px] font-semibold uppercase tracking-wide ${accent.label}`}>
            {todayLabel}
          </p>
          <p className="text-sm font-medium">{today.title}</p>
          <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">{today.body}</p>
          {today.link && (
            <Link
              to={today.link.to}
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              {today.link.label} <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </section>
      )}

      <div className="rounded-2xl border border-gray-200/80 bg-white p-6 dark:border-gray-800/80 dark:bg-gray-900">
        {rest.length > perPage && (
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              {showAll ? `All ${rest.length}` : `${from}–${to} of ${rest.length}`}
            </p>
            {!showAll && pages.length > 1 && (
              <button
                type="button"
                onClick={() => setPage((p) => (p + 1) % pages.length)}
                className="flex items-center gap-1 rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:border-indigo-200 hover:text-indigo-600 dark:border-gray-700 dark:text-gray-400 dark:hover:border-indigo-800 dark:hover:text-indigo-400"
              >
                <Shuffle className="h-3 w-3" /> Show another {pages[(page + 1) % pages.length].length}
              </button>
            )}
          </div>
        )}

        {/* Keyed on the step so a swap re-runs the fade instead of snapping. */}
        <ul key={showAll ? 'all' : page} className="animate-in space-y-5">
          {shown.map((item) => <Entry key={item.title} item={item} />)}
        </ul>

        {rest.length > perPage && (
          <button
            type="button"
            onClick={() => { setShowAll((v) => !v); setPage(0); }}
            className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            {/* rest.length, not items.length — the featured entry is already
                on screen above and is not repeated in this list. */}
            {showAll ? 'Show fewer' : `Show all ${rest.length}`}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAll ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
    </>
  );
}
