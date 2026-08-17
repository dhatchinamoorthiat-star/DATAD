import { useMemo } from 'react';

// Pure-CSS falling-binary backdrop for the login page. Each column is a
// tall repeating string of 0/1 animated with a translateY keyframe
// (index.css's `binary-fall`) — no canvas, no per-frame JS, so it costs
// nothing beyond a GPU-composited transform per column.
// Deterministic stand-in for Math.random(). Rendering must be pure — a real
// RNG returns different values on a re-render (and twice per render under
// StrictMode), so the columns would visibly reshuffle. This hash is seeded by
// column index, which looks equally arbitrary but is stable.
function noise(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function bits(length, seed) {
  let s = '';
  for (let i = 0; i < length; i++) s += Math.round(noise(seed * 97 + i)) + '\n';
  return s;
}

export default function BinaryRainBackground({ columns = 28 }) {
  const cols = useMemo(
    () =>
      Array.from({ length: columns }, (_, i) => ({
        id: i,
        left: `${(i / columns) * 100}%`,
        duration: 9 + noise(i + 1) * 10, // 9–19s per loop
        delay: -noise(i + 2) * 15, // negative delay: already mid-loop on mount
        opacity: 0.15 + noise(i + 3) * 0.25,
        text: bits(48, i + 1),
      })),
    [columns]
  );

  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-gray-950">
      {cols.map((c) => (
        <pre
          key={c.id}
          aria-hidden
          className="absolute top-0 select-none whitespace-pre font-mono text-[11px] leading-4 text-emerald-400"
          style={{
            left: c.left,
            opacity: c.opacity,
            animation: `binary-fall ${c.duration}s linear infinite`,
            animationDelay: `${c.delay}s`,
          }}
        >
          {c.text}
        </pre>
      ))}
      {/* Darkest directly behind the card (which sits centered), fading out
          to fully show the rain toward the edges of the viewport. */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(circle at center, rgba(3,7,18,0.88) 0%, rgba(3,7,18,0.5) 40%, rgba(3,7,18,0.1) 75%)' }}
      />
    </div>
  );
}
