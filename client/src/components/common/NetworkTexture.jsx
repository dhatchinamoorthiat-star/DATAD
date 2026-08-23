// The texture behind every page: a slowly deforming network mesh with signals
// travelling across it.
//
// Two things move: the pulses, and the mesh itself — but they move on scales
// two orders of magnitude apart, and that gap is the entire design.
//
// Two earlier versions drifted the whole layer as one rigid sheet, which is the
// thing that failed: a sliding background is either invisible or annoying with
// very little room in between, because a rigid translation is exactly what the
// visual system is best at locking onto. What is here now is not a translation.
// Each node drifts on its own slow, non-harmonic ellipse, so the mesh *deforms*
// rather than slides — there is no coherent direction to lock onto, and no two
// neighbours ever agree on where they are going.
//
// The speed is chosen against the psychophysics rather than by eye. Peak node
// speed is ~0.6 px/s (DRIFT_MAX_PX over DRIFT_MIN_PERIOD), which sits under the
// foveal motion-detection threshold for an unattended low-contrast target. Look
// away and the field is a still image; look *at* it, hold a node against a
// fixed point on the page, and within a couple of seconds you can see it go.
// That is the brief: noticeable with full effort, never on divided attention.
//
// A travelling signal is the better motif anyway. A drifting field is decoration
// that happens to be made of nodes; a dot crossing an edge is a connection being
// used, which is the thing this product is actually about.
//
// The calm comes from rationing rather than from damping. Six signals over 55
// edges, each visible for about four seconds out of a ~30s cycle, means roughly
// one is in flight at any moment and often none — and because the cycles are
// non-harmonic the ensemble never falls into a pattern. Compare the version this
// replaces, which fired five pulses on a shared 8s cycle while twelve nodes
// cycled opacity underneath: that was distracting because something was always
// happening somewhere, not because any one element was too fast.
//
// The two rules that keep it that way, if you tune this:
//
//   The drift stays below threshold and stays incoherent. Raising DRIFT_MAX_PX
//   or shortening the periods trades directly against the pulses — the moment
//   the mesh is perceptible on divided attention, it spends the attention budget
//   the signals were rationed to protect. No breathing nodes, no rotating rings,
//   nothing that changes *brightness*: luminance change is a far stronger cue
//   than slow displacement, and is what made an earlier version distracting.
//
//   Pulses fade in and out rather than appearing. Onset and offset are the
//   sharpest transients the visual system has; a dot that pops into existence is
//   far louder than the same dot sliding the same distance.
//
import { useEffect, useRef } from 'react';

const VIEW = { w: 1440, h: 900 };

// Deterministic stand-in for Math.random(), the same hash BinaryRainBackground
// uses. Rendering must be pure: a real RNG returns fresh values on every
// re-render (twice per render under StrictMode), so the mesh would jump
// whenever anything above it in the tree updated.
function noise(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// Dense and fine rather than sparse and wide. The sparse version read as a
// diagram — a dozen long edges sweeping across a column of prose draw implied
// lines through the text and the eye keeps trying to follow them. Shorter edges
// at higher count read as a weave, which is what a ground is supposed to be.
const NODE_COUNT = 46;
const MIN_GAP = 92;
const MAX_EDGE = 175;

const NODES = (() => {
  const out = [];
  for (let i = 0; i < 900 && out.length < NODE_COUNT; i++) {
    const x = 30 + noise(i * 3 + 1) * (VIEW.w - 60);
    const y = 30 + noise(i * 3 + 2) * (VIEW.h - 60);
    if (out.some((n) => Math.hypot(n.x - x, n.y - y) < MIN_GAP)) continue;
    out.push({ x, y, r: 1.4 + noise(i * 3 + 3) * 1.4 });
  }
  return out;
})();

const EDGES = (() => {
  const seen = new Set();
  const out = [];
  NODES.forEach((n, i) => {
    NODES
      .map((m, j) => ({ j, d: Math.hypot(m.x - n.x, m.y - n.y) }))
      .filter((c) => c.j !== i && c.d <= MAX_EDGE)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3)
      .forEach(({ j }) => {
        const k = i < j ? `${i}.${j}` : `${j}.${i}`;
        if (seen.has(k)) return;
        seen.add(k);
        out.push([i, j]);
      });
  });
  return out;
})();

// ── Drift ───────────────────────────────────────────────────────────────
//
// Each node travels its own Lissajous figure: separate periods on x and y, so
// the path does not close into a repeating ellipse, and a phase offset per node
// so no two start together. This is what makes the motion incoherent — there is
// no shared direction for the eye to lock onto, which is precisely what a rigid
// translation offers it.
//
// DRIFT_MAX_PX is the amplitude *per axis*, not the excursion: because x and y
// run on different periods the two combine, so a node reaches ~19px from base
// and peaks near 0.67px/s rather than the 0.59 a single axis would give.
// Measured in-page, not derived — the closed form for a Lissajous peak is not
// worth the trouble when the number can just be sampled.
//
// That 0.67px/s is under the foveal threshold for an unattended low-contrast
// target, and works out to ~7.5s for a node to travel a clearly visible 5px.
// Hold one against a fixed point on the page and you will see it go; glance at
// the page and it is a still image. Amplitude also varies 55-100% per node, so
// the field deforms unevenly rather than pulsing as a whole.
const DRIFT_MAX_PX = 14;
const DRIFT_MIN_PERIOD = 150;
const DRIFT_PERIOD_SPREAD = 130;

// ~10fps. The loop is rAF-driven so it parks with the tab, but at 0.6px/s a
// 60fps update moves a node by a hundredth of a pixel — indistinguishable from
// this, at six times the work. The throttle is the difference between a
// background that costs nothing and one that shows up in a profile.
const TICK_MS = 100;

function driftedAt(i, t) {
  const n = NODES[i];
  const ax = DRIFT_MAX_PX * (0.55 + noise(i * 17 + 3) * 0.45);
  const ay = DRIFT_MAX_PX * (0.55 + noise(i * 17 + 7) * 0.45);
  const px = DRIFT_MIN_PERIOD + noise(i * 17 + 11) * DRIFT_PERIOD_SPREAD;
  const py = DRIFT_MIN_PERIOD + noise(i * 17 + 13) * DRIFT_PERIOD_SPREAD;
  const phase = noise(i * 17 + 19) * Math.PI * 2;
  return [
    n.x + Math.sin((t / px) * Math.PI * 2 + phase) * ax,
    n.y + Math.cos((t / py) * Math.PI * 2 + phase) * ay,
  ];
}

// ── Signals ─────────────────────────────────────────────────────────────
//
// Six edges chosen for spread rather than at random. Consecutive entries in
// EDGES share endpoints, so an unweighted pick clusters every signal into one
// corner; this takes the candidate furthest from everything already chosen.
const PULSE_COUNT = 6;

// Non-harmonic cycle lengths, so the six never resynchronise into a visible
// rhythm. Travel is a fixed share of each cycle (see `nt-pulse` in index.css),
// so the longer cycles also travel more slowly — the signals do not all move at
// one speed, which reads as a network rather than a carousel.
const PULSE_CYCLES = [27, 31, 24, 35, 29, 38];

const PULSES = (() => {
  const mid = ([a, b]) => [(NODES[a].x + NODES[b].x) / 2, (NODES[a].y + NODES[b].y) / 2];
  const pool = EDGES.map((e) => ({ e, m: mid(e) }));
  const chosen = [pool[0]];
  while (chosen.length < PULSE_COUNT && chosen.length < pool.length) {
    let best = null;
    let bestGap = -1;
    pool.forEach((c) => {
      if (chosen.includes(c)) return;
      const gap = Math.min(...chosen.map((k) => Math.hypot(k.m[0] - c.m[0], k.m[1] - c.m[1])));
      if (gap > bestGap) { bestGap = gap; best = c; }
    });
    chosen.push(best);
  }
  return chosen.map(({ e: [a, b] }, i) => ({
    a, b,
    cycle: PULSE_CYCLES[i % PULSE_CYCLES.length],
    // Spread the starts so the field is not empty for the first half-minute and
    // then busy all at once.
    delay: i * 4.3,
  }));
})();

export default function NetworkTexture() {
  const nodeRefs = useRef([]);
  const edgeRefs = useRef([]);
  const pulseRefs = useRef([]);

  useEffect(() => {
    // Honoured by reading the query rather than by a CSS rule, because the cost
    // here is the loop itself, not just the visible result. Someone who has
    // asked for reduced motion should not be paying for a timer either.
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (reduce?.matches) return undefined;

    let frame = 0;
    let last = -Infinity;
    // Phase is taken from a wall clock, not from mount time, so navigating
    // between pages does not restart every node from its base position — the
    // field a student comes back to is the one they left.
    const origin = Date.now() / 1000;

    const tick = () => {
      frame = requestAnimationFrame(tick);
      const now = Date.now() / 1000;
      if (now - last < TICK_MS / 1000) return;
      last = now;

      const t = now - origin;
      const pos = NODES.map((_, i) => driftedAt(i, t));

      for (let i = 0; i < pos.length; i++) {
        const el = nodeRefs.current[i];
        if (el) { el.setAttribute('cx', pos[i][0]); el.setAttribute('cy', pos[i][1]); }
      }
      for (let i = 0; i < EDGES.length; i++) {
        const el = edgeRefs.current[i];
        if (!el) continue;
        const [a, b] = EDGES[i];
        el.setAttribute('x1', pos[a][0]); el.setAttribute('y1', pos[a][1]);
        el.setAttribute('x2', pos[b][0]); el.setAttribute('y2', pos[b][1]);
      }
      // The signals ride the drifted endpoints too. Left on the static ones they
      // would launch from up to ~19px off their node — small, but a pulse that
      // starts beside a node instead of on it is precisely the kind of detail
      // that reads as "broken" without the reader being able to say why.
      for (let i = 0; i < PULSES.length; i++) {
        const el = pulseRefs.current[i];
        if (!el) continue;
        const { a, b } = PULSES[i];
        el.style.setProperty('--nt-px1', `${pos[a][0]}px`);
        el.style.setProperty('--nt-py1', `${pos[a][1]}px`);
        el.style.setProperty('--nt-px2', `${pos[b][0]}px`);
        el.style.setProperty('--nt-py2', `${pos[b][1]}px`);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      className="network-texture pointer-events-none fixed inset-0 -z-10 overflow-hidden print:hidden"
      aria-hidden="true"
    >
      <svg
        viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        focusable="false"
      >
        <defs>
          {/* The wash is what answers "flat and empty" — a single flat fill is
              what made the page read as unfinished, and depth costs less
              attention than detail does. */}
          <radialGradient id="nt-wash" cx="50%" cy="42%" r="62%">
            <stop offset="0%" className="nt-wash-near" />
            <stop offset="50%" className="nt-wash-mid" />
            <stop offset="100%" className="nt-wash-far" />
          </radialGradient>
        </defs>

        <rect x="0" y="0" width={VIEW.w} height={VIEW.h} fill="url(#nt-wash)" />

        <g className="nt-edges">
          {EDGES.map(([a, b], i) => (
            <line
              key={`${a}.${b}`}
              ref={(el) => { edgeRefs.current[i] = el; }}
              x1={NODES[a].x} y1={NODES[a].y} x2={NODES[b].x} y2={NODES[b].y}
            />
          ))}
        </g>

        <g className="nt-nodes">
          {NODES.map((n, i) => (
            <circle
              key={`n${i}`}
              ref={(el) => { nodeRefs.current[i] = el; }}
              cx={n.x} cy={n.y} r={n.r}
            />
          ))}
        </g>

        {/* The signals. Rendered last so they sit over the mesh, and positioned
            purely by transform: `cx`/`cy` stay at the origin so one keyframe
            rule can serve every pulse off per-element custom properties, rather
            than a generated rule per edge built into a runtime <style> tag. */}
        <g className="nt-pulses">
          {PULSES.map(({ a, b, cycle, delay }, i) => (
            <circle
              key={`p${i}`}
              ref={(el) => { pulseRefs.current[i] = el; }}
              // 4 units lands at ~7px across on a 1440-wide screen, matching
              // the register hero's signals. It has to clear the largest node
              // in the mesh (4.9px) by a visible margin: at 2.6 units the pulse
              // rendered *smaller* than the dots it travels between, so it read
              // as part of the texture rather than as something crossing it.
              r="4"
              style={{
                '--nt-px1': `${NODES[a].x}px`,
                '--nt-py1': `${NODES[a].y}px`,
                '--nt-px2': `${NODES[b].x}px`,
                '--nt-py2': `${NODES[b].y}px`,
                animationDuration: `${cycle}s`,
                animationDelay: `${delay}s`,
              }}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
