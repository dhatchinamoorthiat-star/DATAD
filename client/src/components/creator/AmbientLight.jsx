import { useEffect, useRef } from 'react';

// A soft light that follows the pointer across the canvas.
//
// The page it replaces had three fixed 384px `blur-3xl` divs stacked over the
// whole viewport. Those are expensive in a way that is easy to miss: a blurred
// element that large is re-rasterised whenever anything beneath it changes, and
// there were three of them sitting under every scroll of a long page.
//
// This is one element with a `radial-gradient` background and a transform. It
// never repaints — the compositor moves it — and it does something the blobs
// could not, which is respond. The canvas lights where you are reading.
//
// It only exists where it makes sense: a fine pointer (so no phantom light
// parked in the corner of a touch device), motion allowed, and JS running. Its
// absence costs the page nothing, which is the test for anything decorative.
export default function AmbientLight({ size = 620 }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (!window.matchMedia?.('(pointer: fine)').matches) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;

    let frame = 0;
    let target = { x: window.innerWidth * 0.6, y: window.innerHeight * 0.35 };
    let current = { ...target };
    let running = false;

    const half = size / 2;

    const tick = () => {
      // Ease toward the pointer rather than tracking it exactly. A light that
      // snaps to the cursor reads as a UI element the reader is dragging; one
      // that lags reads as a room they are walking through.
      current.x += (target.x - current.x) * 0.08;
      current.y += (target.y - current.y) * 0.08;
      el.style.transform = `translate3d(${current.x - half}px, ${current.y - half}px, 0)`;

      const settled = Math.abs(target.x - current.x) < 0.5 && Math.abs(target.y - current.y) < 0.5;
      if (settled) {
        running = false;
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    const onMove = (event) => {
      target = { x: event.clientX, y: event.clientY };
      if (running) return;
      running = true;
      frame = requestAnimationFrame(tick);
    };

    el.style.transform = `translate3d(${current.x - half}px, ${current.y - half}px, 0)`;
    el.style.opacity = '1';
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(frame);
    };
  }, [size]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-0 opacity-0 transition-opacity duration-700"
      style={{
        width: size,
        height: size,
        background:
          'radial-gradient(circle, rgba(77,124,255,0.13) 0%, rgba(124,108,255,0.06) 38%, transparent 68%)',
        willChange: 'transform',
      }}
    />
  );
}
