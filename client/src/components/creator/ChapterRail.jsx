import { motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import { IDENTITY, CREATOR } from './creatorTokens';

// The register screen's PhaseRail, grown up.
//
// Same grammar on purpose — 26px numbered markers, a hairline track, a
// connector that fills behind them, a tick once a step is behind you. A reader
// who signed up yesterday should recognise this object immediately. Three
// things are different, and each of them is the difference between a form and
// a document:
//
//   · It runs vertically, because a page is read down, not across.
//   · It tracks reading position rather than form progress, so it is driven by
//     an observer on the sections instead of by a step counter.
//   · Its steps are clickable. PhaseRail could not be — you cannot skip to the
//     end of a form you have not filled in — but a reader is allowed to decide
//     that they came here for the timeline.
//
// The last chapter is worth the same note PhaseRail's fourth phase gets: it is
// "Still building", and it never completes. That is not an oversight in either
// place. A rail that ends somewhere you cannot tick off is telling the truth.
export default function ChapterRail({ chapters, active, onJump, className = '' }) {
  const reduce = useReducedMotion();
  const pct = chapters.length > 1 ? (active / (chapters.length - 1)) * 100 : 0;

  return (
    <nav aria-label="Sections on this page" className={className}>
      <ol className="relative flex flex-col gap-5">
        {/* Track, inset by half a marker top and bottom so it runs between the
            first and last centres instead of past them. */}
        <div
          className="absolute left-[13px] top-[13px] bottom-[13px] w-px"
          style={{ background: IDENTITY.inkLine }}
          aria-hidden="true"
        />
        <div className="absolute left-[13px] top-[13px] bottom-[13px] w-px overflow-hidden" aria-hidden="true">
          <motion.div
            className="w-full"
            style={{ background: `linear-gradient(to bottom, ${IDENTITY.violet}, ${IDENTITY.blue})` }}
            initial={false}
            animate={{ height: `${Math.min(100, Math.max(0, pct))}%` }}
            transition={reduce ? { duration: 0 } : { duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>

        {chapters.map((chapter, i) => {
          const done = i < active;
          const isActive = i === active;
          return (
            <li key={chapter.id} className="relative z-10">
              <button
                type="button"
                onClick={() => onJump(chapter.id)}
                aria-current={isActive ? 'true' : undefined}
                className="creator-focus group flex w-full items-center gap-3 text-left"
              >
                <span
                  className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold tabular-nums transition-all duration-300"
                  style={
                    done
                      ? { borderColor: IDENTITY.blue, background: IDENTITY.blue, color: IDENTITY.ink }
                      : isActive
                        ? {
                            borderColor: IDENTITY.blue,
                            background: IDENTITY.ink,
                            color: IDENTITY.blueSoft,
                            boxShadow: `0 0 0 4px ${'rgba(77,124,255,0.14)'}`,
                          }
                        : { borderColor: IDENTITY.inkLine, background: IDENTITY.ink, color: IDENTITY.muted }
                  }
                >
                  {done ? <Check className="h-3 w-3" aria-hidden="true" /> : chapter.number}
                </span>

                <span className="min-w-0">
                  <span
                    className="block truncate text-[12.5px] font-medium leading-tight transition-colors duration-300"
                    style={{ color: isActive ? IDENTITY.paper : done ? IDENTITY.muted : '#6B7484' }}
                  >
                    {chapter.label}
                  </span>
                  {/* The rail's own hover affordance: a hairline that grows
                      under the label rather than a colour change, so nothing
                      moves and nothing shouts. */}
                  <span
                    aria-hidden="true"
                    className="mt-1 block h-px origin-left scale-x-0 transition-transform duration-300 ease-out group-hover:scale-x-100"
                    style={{ background: isActive ? IDENTITY.blue : CREATOR.ember, opacity: 0.7 }}
                  />
                  {done && <span className="sr-only"> (read)</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
