import { useRef } from 'react';
import { motion, useScroll, useReducedMotion } from 'framer-motion';
import { IDENTITY, CREATOR } from './creatorTokens';
import Reveal from './Reveal';

// The three-year record, as a spine rather than a grid of year cards.
//
// A timeline laid out as a 2×2 of tiles is not a timeline; it is four
// unordered facts with dates on them. The reason to draw a line is that the
// line is the argument — one continuous thing, still going.
//
// So the stroke is scroll-linked: it fills as you read past each year, which
// means the reader's own progress down the page and the project's progress
// through the years are literally the same motion. Framer owns this one
// because it is continuous response to something the reader is doing, not an
// entrance that decides whether words exist (see index.css on that split).
//
// The years sit in the left margin on wide screens — outside the spine, as
// marginalia — so the titles all start on one line and the eye reads a column
// of statements instead of a column of numbers.
//
// The last entry has no year and never gets a filled marker. That is the same
// decision PhaseRail makes with its fourth phase on the signup screen: a rail
// that ends on a step nobody ticks off is telling the truth about what is on
// the other side of it.
export default function BuildSpine({ entries, className = '' }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 72%', 'end 58%'],
  });

  return (
    <div ref={ref} className={`relative pl-9 lg:pl-36 ${className}`}>
      {/* Unfilled track, and the fill that rides the scroll over it. */}
      <div
        className="absolute bottom-10 left-[8px] top-2 w-px lg:left-[116px]"
        style={{ background: IDENTITY.inkLine }}
        aria-hidden="true"
      />
      <motion.div
        className="absolute bottom-10 left-[8px] top-2 w-px origin-top lg:left-[116px]"
        style={{
          background: `linear-gradient(to bottom, ${IDENTITY.violet}, ${IDENTITY.blue}, ${IDENTITY.blueSoft})`,
          scaleY: reduce ? 1 : scrollYProgress,
        }}
        aria-hidden="true"
      />

      <ol className="space-y-12 sm:space-y-14">
        {entries.map((entry, i) => (
          <Reveal as="li" key={entry.title} delay={40} className="relative">
            {/* Marker. The open entry gets a ring with the live pulse instead
                of a filled dot — the visual difference between "this happened"
                and "this is happening". */}
            <span
              className="absolute -left-9 top-1 flex h-[17px] w-[17px] items-center justify-center rounded-full border"
              style={{
                borderColor: entry.open ? CREATOR.live : IDENTITY.blue,
                background: IDENTITY.ink,
              }}
              aria-hidden="true"
            >
              <span
                className={`h-[7px] w-[7px] rounded-full ${entry.open ? 'pulse-indigo' : ''}`}
                style={{ background: entry.open ? CREATOR.live : IDENTITY.blue }}
              />
            </span>

            <span
              className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.18em] tabular-nums lg:absolute lg:-left-36 lg:top-[3px] lg:mb-0 lg:w-[92px] lg:text-right"
              style={{ color: entry.open ? CREATOR.live : CREATOR.ember }}
            >
              {entry.year}
            </span>

            <h3
              className="text-[19px] font-semibold leading-snug tracking-[-0.015em] sm:text-[21px]"
              style={{ color: IDENTITY.paper }}
            >
              {entry.title}
            </h3>
            <p
              className="mt-2 max-w-[54ch] text-[14.5px] leading-relaxed"
              style={{ color: IDENTITY.muted }}
            >
              {entry.body}
            </p>
          </Reveal>
        ))}
      </ol>
    </div>
  );
}
