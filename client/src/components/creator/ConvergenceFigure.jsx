import { IDENTITY, CREATOR } from './creatorTokens';
import { MARK_PATH } from '../common/Logo';

// The origin story, drawn.
//
// The section beside this figure says a batch was running placement season
// across five apps that had never heard of each other. That sentence is the
// whole reason DATAD exists, and a paragraph is a weak place to leave it — so
// the figure states it a second time in a form the reader takes in before they
// have finished reading: five loose labels on the left, five lines bundling
// into one mark on the right.
//
// The mark is the real `MARK_PATH` from Logo.jsx, not a stand-in circle. What
// the lines converge into is the product, literally.
//
// ── How it animates ───────────────────────────────────────────────────────
// It doesn't, on its own. Every stroke carries `pathLength="1"`, which puts
// dash length and dash offset into a normalised 0..1 space, and `.creator-draw`
// in index.css transitions that offset from 1 to 0 when an ancestor flips to
// `data-revealed="true"`. So the draw is a CSS transition on the document
// timeline — it cannot be left half-drawn by a throttled animation frame in a
// background tab, and `prefers-reduced-motion` collapses it to nothing through
// the global rule rather than through a prop nobody remembered to pass.

const FRAGMENTS = [
  { y: 34, label: 'A spreadsheet for money' },
  { y: 92, label: 'A WhatsApp group for dates' },
  { y: 150, label: 'Sticky notes for the rest' },
  { y: 208, label: 'A calendar nobody shared' },
  { y: 266, label: 'An inbox full of PDFs' },
];

const CHIP = { x: 8, w: 178, h: 30 };
const HUB = { x: 330, y: 150, r: 34 };

export default function ConvergenceFigure({ className = '' }) {
  return (
    <figure className={className}>
      <svg
        viewBox="0 0 400 300"
        className="h-auto w-full"
        role="img"
        aria-label="Five separate student tools converging into the single DATAD system"
      >
        <defs>
          <linearGradient id="cf-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={IDENTITY.blue} stopOpacity="0.12" />
            <stop offset="70%" stopColor={IDENTITY.blue} stopOpacity="0.55" />
            <stop offset="100%" stopColor={IDENTITY.blueSoft} stopOpacity="0.9" />
          </linearGradient>
          <radialGradient id="cf-hub" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={IDENTITY.blue} stopOpacity="0.22" />
            <stop offset="100%" stopColor={IDENTITY.blue} stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx={HUB.x} cy={HUB.y} r={HUB.r * 2.6} fill="url(#cf-hub)" />

        {FRAGMENTS.map((fragment, i) => (
          <g key={fragment.label}>
            <path
              d={`M ${CHIP.x + CHIP.w} ${fragment.y} C ${CHIP.x + CHIP.w + 56} ${fragment.y}, ${HUB.x - 74} ${HUB.y}, ${HUB.x - HUB.r - 4} ${HUB.y}`}
              className="creator-draw"
              style={{ '--draw-delay': `${0.35 + i * 0.12}s` }}
              fill="none"
              stroke="url(#cf-line)"
              strokeWidth="1.25"
              pathLength="1"
            />
            <rect
              x={CHIP.x}
              y={fragment.y - CHIP.h / 2}
              width={CHIP.w}
              height={CHIP.h}
              rx="9"
              fill={CREATOR.plate}
              stroke={IDENTITY.inkLine}
            />
            <text
              x={CHIP.x + 14}
              y={fragment.y + 4}
              fill={IDENTITY.muted}
              fontSize="11.5"
              fontWeight="500"
            >
              {fragment.label}
            </text>
            <circle cx={CHIP.x + CHIP.w} cy={fragment.y} r="2.4" fill={IDENTITY.blue} fillOpacity="0.7" />
          </g>
        ))}

        {/* The boundary of the system the five lines end inside. */}
        <circle
          cx={HUB.x}
          cy={HUB.y}
          r={HUB.r + 16}
          fill="none"
          stroke={IDENTITY.inkLine}
          strokeDasharray="2 5"
        />
        <g transform={`translate(${HUB.x - HUB.r * 1.25}, ${HUB.y - HUB.r * 1.25}) scale(${HUB.r / 48})`}>
          <path d={MARK_PATH} fill={IDENTITY.blueSoft} fillRule="evenodd" />
        </g>
      </svg>

      <figcaption
        className="mt-5 border-t pt-4 text-[12.5px] leading-relaxed"
        style={{ borderColor: IDENTITY.inkLine, color: IDENTITY.muted }}
      >
        Every one of those was fine at its own job. None of them knew that the fee,
        the deadline, the interview and the burnout were the same week in the same life.
      </figcaption>
    </figure>
  );
}
