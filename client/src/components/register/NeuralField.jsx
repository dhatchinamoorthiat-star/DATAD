import { motion, useReducedMotion } from 'framer-motion';
import { IDENTITY } from './identityTokens';

// The animated layer behind the register hero: a node constellation (the
// "intelligence" half) with a career trajectory drawing itself across it (the
// "growth" half).
//
// Everything here is deterministic. An earlier pass seeded node positions with
// Math.random() and the constellation reshuffled on every re-render of the
// parent form — each keystroke in the email field visibly kicked the
// background. Fixed coordinates also mean the composition can be tuned by eye
// once and stay tuned.
//
// Only opacity and transform animate, so the whole field stays on the
// compositor and never triggers layout while someone is typing next to it.

const NODES = [
  { x: 200, y: 250, r: 5.5 }, // 0 — core
  { x: 118, y: 176, r: 3 },   // 1
  { x: 286, y: 168, r: 3.4 }, // 2
  { x: 96, y: 300, r: 2.6 },  // 3
  { x: 300, y: 316, r: 3 },   // 4
  { x: 200, y: 104, r: 2.8 }, // 5
  { x: 200, y: 396, r: 2.8 }, // 6
  { x: 148, y: 356, r: 2.2 }, // 7
  { x: 252, y: 214, r: 2.2 }, // 8
  { x: 52, y: 232, r: 2 },    // 9
  { x: 348, y: 244, r: 2 },   // 10
  { x: 258, y: 388, r: 2.4 }, // 11
];

const EDGES = [
  [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6],
  [1, 5], [2, 5], [1, 9], [2, 10], [3, 7], [4, 10],
  [6, 7], [6, 11], [4, 11], [0, 8], [8, 2],
];

// The few edges that carry a travelling pulse. Kept to four: every pulse is an
// independent rAF-driven animation, and the point is a calm signal moving
// through a network, not a light show.
const PULSES = [
  { edge: [0, 2], delay: 0 },
  { edge: [0, 3], delay: 1.9 },
  { edge: [1, 5], delay: 3.4 },
  { edge: [0, 6], delay: 5.1 },
];

// Keyframe stops for a pulse: hold invisible at the source, fade in, travel,
// fade out on arrival. Shared by cx, cy and opacity so all three interpolate
// against the same timeline.
const PULSE_STOPS = [0, 0.15, 0.85, 1];
const lerp = (from, to, t) => from + (to - from) * t;

// Career trajectory — deliberately not a straight line. It dips around x=150
// because a real growth curve has a bad semester in it, and the recovery is
// the part worth drawing.
const TRAJECTORY = 'M 40 400 C 110 392, 132 356, 168 366 S 236 300, 268 236 S 330 150, 366 116';

export default function NeuralField() {
  const reduce = useReducedMotion();

  return (
    <svg
      viewBox="0 0 400 520"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id="nf-core-glow" cx="50%" cy="48%" r="50%">
          <stop offset="0%" stopColor={IDENTITY.blue} stopOpacity="0.30" />
          <stop offset="45%" stopColor={IDENTITY.violet} stopOpacity="0.10" />
          <stop offset="100%" stopColor={IDENTITY.ink} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="nf-trajectory" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor={IDENTITY.violet} stopOpacity="0.15" />
          <stop offset="55%" stopColor={IDENTITY.blue} stopOpacity="0.75" />
          <stop offset="100%" stopColor={IDENTITY.blueSoft} stopOpacity="1" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="400" height="520" fill="url(#nf-core-glow)" />

      {/* Orbital rings. One slow clockwise pair, one counter — the counter-turn
          is what stops it reading as a loading spinner. */}
      <g stroke={IDENTITY.blue} fill="none">
        <motion.g
          style={{ transformOrigin: '200px 250px' }}
          animate={reduce ? undefined : { rotate: 360 }}
          transition={{ duration: 120, repeat: Infinity, ease: 'linear' }}
        >
          <ellipse cx="200" cy="250" rx="150" ry="96" strokeOpacity="0.10" />
          <ellipse cx="200" cy="250" rx="104" ry="150" strokeOpacity="0.07" />
        </motion.g>
        <motion.g
          style={{ transformOrigin: '200px 250px' }}
          animate={reduce ? undefined : { rotate: -360 }}
          transition={{ duration: 165, repeat: Infinity, ease: 'linear' }}
        >
          <ellipse cx="200" cy="250" rx="176" ry="176" strokeOpacity="0.06" />
        </motion.g>
      </g>

      {/* Synapses */}
      <g stroke={IDENTITY.blue} strokeOpacity="0.16" strokeWidth="1">
        {EDGES.map(([a, b]) => (
          <line key={`${a}-${b}`} x1={NODES[a].x} y1={NODES[a].y} x2={NODES[b].x} y2={NODES[b].y} />
        ))}
      </g>

      {/* Nodes. The breathing is staggered by index so they never pulse in
          unison, which is the difference between "thinking" and "blinking". */}
      {NODES.map((n, i) => (
        <motion.circle
          key={`n${i}`}
          cx={n.x}
          cy={n.y}
          r={n.r}
          fill={i === 0 ? IDENTITY.blueSoft : IDENTITY.blue}
          initial={{ opacity: i === 0 ? 0.95 : 0.55 }}
          animate={reduce ? undefined : { opacity: i === 0 ? [0.95, 0.6, 0.95] : [0.55, 0.22, 0.55] }}
          transition={{ duration: 4.5 + (i % 5), repeat: Infinity, ease: 'easeInOut', delay: i * 0.35 }}
        />
      ))}

      {/* Signal travelling node-to-node */}
      {!reduce && PULSES.map(({ edge: [a, b], delay }, i) => (
        <motion.circle
          key={`p${i}`}
          r="2.2"
          fill={IDENTITY.blueSoft}
          // Every animated property needs the same number of keyframes as
          // `times` has entries. cx/cy were two-value arrays against a
          // four-entry `times`, so Framer had no value to interpolate for the
          // middle stops and wrote cx="undefined" — which SVG rejects hard
          // enough to tear down the animation frame, silently freezing every
          // other animation on the page (form panel included) mid-transition.
          // Hence the two intermediate points rather than a bare [from, to].
          cx={NODES[a].x}
          cy={NODES[a].y}
          initial={{ cx: NODES[a].x, cy: NODES[a].y, opacity: 0 }}
          animate={{
            cx: PULSE_STOPS.map((t) => lerp(NODES[a].x, NODES[b].x, t)),
            cy: PULSE_STOPS.map((t) => lerp(NODES[a].y, NODES[b].y, t)),
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration: 2.6,
            repeat: Infinity,
            repeatDelay: 5.2,
            delay,
            ease: 'easeInOut',
            times: PULSE_STOPS,
          }}
        />
      ))}

      {/* Career trajectory — draws once on arrival, then stays. A looping draw
          would pull the eye back to the background every few seconds, which is
          exactly where it should not be while someone fills in a form. */}
      <motion.path
        d={TRAJECTORY}
        fill="none"
        stroke="url(#nf-trajectory)"
        strokeWidth="2"
        strokeLinecap="round"
        initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2.4, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
      />
      <motion.circle
        cx="366"
        cy="116"
        r="4"
        fill={IDENTITY.blueSoft}
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: reduce ? 0 : 2.7, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  );
}
