import { motion, useReducedMotion } from 'framer-motion';
import { IDENTITY } from './creatorTokens';
import { MARK_PATH } from '../common/Logo';

// The artwork behind the creator hero.
//
// Register's canvas is a neural constellation — a mind, thinking. Repeating it
// here would have been the safe move and the wrong one: this page is not about
// intelligence, it is about someone building for three years. So the motif is
// the other half of the brand, taken literally.
//
// The DATAD mark is a disc with a three-step terrace cut out of it. That cut is
// the logo's whole argument — you climb in steps, and the steps are the parts
// of the shape that are missing. Nobody has ever drawn it large. Here it is
// drawn at 210 units of radius, unfilled, with a light that walks up the treads
// on a slow loop, and the disc it was cut from left as a hairline around it.
//
// Every coordinate below is derived from `MARK_PATH` in Logo.jsx rather than
// re-drawn by eye, so the hero cannot fall out of register with the favicon.
// The logo is authored on a 120-unit grid with a disc of r=48 at (60,60); this
// maps that grid onto the hero's, and nothing here is hand-placed.
//
// Motion budget is the same as NeuralField's: opacity and transform only, so
// the field stays on the compositor and never forces layout behind live text.

const VIEW = { w: 640, h: 560 };
const CENTER = { x: 320, y: 262 };
const RADIUS = 210;
const SCALE = RADIUS / 48; // logo disc radius → hero disc radius

// Logo grid → hero grid.
const gx = (x) => CENTER.x + (x - 60) * SCALE;
const gy = (y) => CENTER.y + (y - 60) * SCALE;

// The terrace cut, vertex for vertex out of MARK_PATH's second subpath
// ("M26 86 V74 H46 V62 H66 V50 H86 V86 Z"). Kept as data rather than a path
// string because the climb below has to walk it point by point.
const CUT = [
  [26, 86], [26, 74], [46, 74], [46, 62], [66, 62], [66, 50], [86, 50], [86, 86],
];

const cutPoints = CUT.map(([x, y]) => `${gx(x)},${gy(y)}`).join(' ');

// The treads only — the ascending edge of the cut, with the two vertical walls
// that close the shape dropped. This is the line the light climbs.
const CLIMB = CUT.slice(1, 7).map(([x, y]) => [gx(x), gy(y)]);
const climbPath = CLIMB.map(([x, y], i) => `${i ? 'L' : 'M'} ${x} ${y}`).join(' ');

// Keyframe stops spaced by real distance along the climb, not by vertex index.
// Even spacing would make the light sprint up the short risers and crawl along
// the long treads, which reads as a stutter rather than a walk.
const CLIMB_STOPS = (() => {
  const lengths = CLIMB.slice(1).map(([x, y], i) => Math.hypot(x - CLIMB[i][0], y - CLIMB[i][1]));
  const total = lengths.reduce((a, b) => a + b, 0);
  let run = 0;
  return [0, ...lengths.map((len) => (run += len) / total)];
})();

// Corner lights on the inside angle of each step.
const STEP_NODES = [CLIMB[1], CLIMB[3], CLIMB[5]];

export default function TerraceField({ className = '' }) {
  const reduce = useReducedMotion();

  return (
    <svg
      viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
      preserveAspectRatio="xMidYMid slice"
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id="tf-glow" cx="50%" cy="47%" r="52%">
          <stop offset="0%" stopColor={IDENTITY.blue} stopOpacity="0.30" />
          <stop offset="42%" stopColor={IDENTITY.violet} stopOpacity="0.11" />
          <stop offset="100%" stopColor={IDENTITY.ink} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="tf-climb" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor={IDENTITY.violet} stopOpacity="0.2" />
          <stop offset="50%" stopColor={IDENTITY.blue} stopOpacity="0.8" />
          <stop offset="100%" stopColor={IDENTITY.blueSoft} stopOpacity="1" />
        </linearGradient>
        <linearGradient id="tf-fill" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={IDENTITY.blue} stopOpacity="0.16" />
          <stop offset="100%" stopColor={IDENTITY.violet} stopOpacity="0.03" />
        </linearGradient>
        {/* The mark itself, used as a clip so the contour lines stop at the
            disc's edge. The artwork is the logo looking through the logo. */}
        <clipPath id="tf-disc">
          <circle cx={CENTER.x} cy={CENTER.y} r={RADIUS} />
        </clipPath>
      </defs>

      <rect x="0" y="0" width={VIEW.w} height={VIEW.h} fill="url(#tf-glow)" />

      {/* Contour hairlines. Architectural rather than decorative: they give the
          terrace a ground plane to stand on, which is what stops a stair
          drawn in outline from reading as an abstract zigzag. */}
      <g stroke={IDENTITY.blue} strokeWidth="1" clipPath="url(#tf-disc)">
        {[92, 148, 204, 260, 316, 372, 428].map((y, i) => (
          <line
            key={y}
            x1="70"
            x2="570"
            y1={y}
            y2={y}
            strokeOpacity={i % 2 ? 0.07 : 0.115}
          />
        ))}
      </g>

      {/* Orbital rings, inherited from the register canvas on purpose — it is
          the one gesture both pages share, so the two surfaces read as one
          system seen from two angles. Counter-rotation stops the pair from
          reading as a loading spinner. */}
      <g stroke={IDENTITY.blue} fill="none">
        <motion.g
          style={{ transformOrigin: `${CENTER.x}px ${CENTER.y}px` }}
          animate={reduce ? undefined : { rotate: 360 }}
          transition={{ duration: 150, repeat: Infinity, ease: 'linear' }}
        >
          <ellipse cx={CENTER.x} cy={CENTER.y} rx={RADIUS + 46} ry={RADIUS - 58} strokeOpacity="0.08" />
        </motion.g>
        <motion.g
          style={{ transformOrigin: `${CENTER.x}px ${CENTER.y}px` }}
          animate={reduce ? undefined : { rotate: -360 }}
          transition={{ duration: 210, repeat: Infinity, ease: 'linear' }}
        >
          <ellipse cx={CENTER.x} cy={CENTER.y} rx={RADIUS - 66} ry={RADIUS + 30} strokeOpacity="0.06" />
        </motion.g>
      </g>

      {/* The disc the terrace was cut from. */}
      <circle
        cx={CENTER.x}
        cy={CENTER.y}
        r={RADIUS}
        fill="none"
        stroke={IDENTITY.blue}
        strokeOpacity="0.24"
      />

      {/* The cut, at scale. */}
      <polygon
        points={cutPoints}
        fill="url(#tf-fill)"
        stroke={IDENTITY.blue}
        strokeOpacity="0.3"
        strokeWidth="1"
      />

      {/* The climb draws itself once on arrival and then holds. A looping draw
          would pull the eye back to the background every few seconds, which is
          the last thing a page of prose needs. */}
      <motion.path
        d={climbPath}
        fill="none"
        stroke="url(#tf-climb)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2.2, ease: [0.16, 1, 0.3, 1], delay: 0.45 }}
      />

      {STEP_NODES.map(([x, y], i) => (
        <motion.circle
          key={`step-${x}-${y}`}
          cx={x}
          cy={y}
          r="3.2"
          fill={IDENTITY.blueSoft}
          initial={{ opacity: 0 }}
          animate={reduce ? { opacity: 0.7 } : { opacity: [0.75, 0.28, 0.75] }}
          transition={
            reduce
              ? { duration: 0.4, delay: 2.4 }
              : { duration: 5 + i, repeat: Infinity, ease: 'easeInOut', delay: 2.4 + i * 0.6 }
          }
        />
      ))}

      {/* Someone walking up. Every animated property carries the same number of
          keyframes as `times` has entries — a shorter array leaves Framer with
          nothing to interpolate for the middle stops and it writes
          cx="undefined", which SVG rejects hard enough to tear down the frame
          loop for every animation on the page. */}
      {!reduce && (
        <motion.circle
          r="4.5"
          fill={IDENTITY.blueSoft}
          initial={{ cx: CLIMB[0][0], cy: CLIMB[0][1], opacity: 0 }}
          animate={{
            cx: CLIMB.map(([x]) => x),
            cy: CLIMB.map(([, y]) => y),
            opacity: [0, 0.9, 0.9, 0.9, 0.9, 0],
          }}
          transition={{
            duration: 6.5,
            repeat: Infinity,
            repeatDelay: 4.5,
            delay: 2.8,
            ease: 'linear',
            times: CLIMB_STOPS,
          }}
        />
      )}

      {/* The mark itself, small and faint, sitting at the top of the climb —
          the thing the whole stair is walking toward. */}
      <g
        transform={`translate(${CLIMB[5][0] - 18}, ${CLIMB[5][1] - 62}) scale(0.3)`}
        opacity="0.5"
      >
        <path d={MARK_PATH} fill={IDENTITY.blue} fillOpacity="0.5" fillRule="evenodd" />
      </g>
    </svg>
  );
}
