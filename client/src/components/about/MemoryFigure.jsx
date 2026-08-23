import { IDENTITY, CREATOR } from '../creator/creatorTokens';

// What Dax actually keeps: a drawing of one student's fortnight.
//
// The claim this section makes — "it remembers you, and it can show you the
// line" — is abstract until you see the line. So this is the real shape of the
// data rather than an illustration of it: one dot per daily snapshot, the
// series they form, a gap where no snapshot was written, and the point where a
// forecast came due and was checked.
//
// Drawn in hairlines on near-black, like the terrace field on /creator, and
// deliberately static. It is a diagram, not an animation: there is nothing here
// that is clearer for having moved, and a chart that draws itself delays the
// only thing it is for. The reveal it inherits from its wrapper is enough.
//
// Accessibility: the SVG is one labelled image and the paragraph beneath it
// states the same facts in prose, so nothing here is available only to someone
// who can see it.

// Fourteen days of a consistency score, falling. The gap at index 8 is the
// point of the drawing as much as the slope is — see the caption.
const SERIES = [78, 80, 76, 74, 71, 66, 62, 58, null, 55, 52, 48, 46, 44];

const W = 640;
const H = 190;
const PAD_X = 26;
const PAD_TOP = 22;
const PAD_BOTTOM = 40;

const x = (i) => PAD_X + (i * (W - PAD_X * 2)) / (SERIES.length - 1);
const y = (v) => PAD_TOP + ((100 - v) / 100) * (H - PAD_TOP - PAD_BOTTOM);

// Split into runs so the missing day is a break in the line, not a straight
// segment drawn across it. Interpolating over the gap would draw a reading that
// was never taken, which is the exact thing the resolver refuses to do.
function runs() {
  const out = [];
  let current = [];
  SERIES.forEach((v, i) => {
    if (v == null) {
      if (current.length) out.push(current);
      current = [];
      return;
    }
    current.push([x(i), y(v)]);
  });
  if (current.length) out.push(current);
  return out;
}

export default function MemoryFigure({ className = '' }) {
  const segments = runs();

  return (
    <figure className={className}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Fourteen days of one student's consistency score, falling from 78 to 44, with one day missing where no snapshot was written."
      >
        {/* Baseline and one gridline. Two rules, not a grid — the drawing is
            about a direction, and a full grid invites reading exact values off
            a figure that is illustrative. */}
        <line x1={PAD_X} y1={y(0)} x2={W - PAD_X} y2={y(0)} stroke={IDENTITY.inkLine} strokeWidth="1" />
        <line
          x1={PAD_X}
          y1={y(50)}
          x2={W - PAD_X}
          y2={y(50)}
          stroke={IDENTITY.inkLine}
          strokeWidth="1"
          strokeDasharray="2 6"
        />

        {segments.map((points, i) => (
          <polyline
            key={i}
            points={points.map(([px, py]) => `${px},${py}`).join(' ')}
            fill="none"
            stroke={IDENTITY.blue}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.85"
          />
        ))}

        {SERIES.map((v, i) =>
          v == null ? (
            // The missing day, drawn as an open mark on the axis. Absence is
            // recorded rather than smoothed over.
            <g key={i}>
              <circle cx={x(i)} cy={y(56)} r="3.5" fill="none" stroke="#68717F" strokeWidth="1" strokeDasharray="1.5 2" />
            </g>
          ) : (
            <circle key={i} cx={x(i)} cy={y(v)} r="2.6" fill={IDENTITY.blueSoft} />
          )
        )}

        {/* The two ends, called out. These are the numbers Dax is required to
            quote when it says the word "down". */}
        <text x={x(0)} y={y(SERIES[0]) - 12} fill={IDENTITY.paper} fontSize="12" textAnchor="start">
          78
        </text>
        <text x={x(SERIES.length - 1)} y={y(44) - 12} fill={CREATOR.ember} fontSize="12" textAnchor="end">
          44
        </text>

        <text x={PAD_X} y={H - 14} fill="#68717F" fontSize="10.5" letterSpacing="1.4" textAnchor="start">
          14 DAYS AGO
        </text>
        <text x={W - PAD_X} y={H - 14} fill="#68717F" fontSize="10.5" letterSpacing="1.4" textAnchor="end">
          TODAY
        </text>
      </svg>

      <figcaption className="mt-6 max-w-[62ch] text-[13.5px] leading-relaxed" style={{ color: IDENTITY.muted }}>
        One dot per day. The break is a day with no reading — Dax draws no line
        through it and will not resolve a forecast against it, because a number
        nobody measured is not evidence. From this, and only this, it is allowed
        to say <span style={{ color: IDENTITY.paper }}>&ldquo;your consistency is down 34 points since the 9th&rdquo;</span>.
      </figcaption>
    </figure>
  );
}
