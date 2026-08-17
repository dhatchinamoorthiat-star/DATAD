// Entrance animations are CSS-driven (see index.css) so content always settles
// visible even if the tab is backgrounded / the JS animation loop is throttled.

// The one measure the product reads at. WorkspaceLayout's tab row uses this
// same constant, so tabs always line up with the content they label — that
// alignment is why the width lives in one place instead of per page.
export const CONTAINER = 'mx-auto w-full max-w-3xl px-4';

// The wider measure, for pages whose content is card grids and tiles rather
// than prose. Prose stays on CONTAINER: past ~768px a line of body copy gets
// tiring to read, which is the whole reason that measure is narrow.
export const CONTAINER_WIDE = 'mx-auto w-full max-w-5xl px-4';

// Page-level entrance wrapper + canonical measure.
// Pass `bare` for pages that own their own full-bleed layout (editors, landing).
// Pass `wide` for card/grid pages that read better on the wider measure.
export function Page({ children, className, bare = false, wide = false }) {
  const measure = wide ? CONTAINER_WIDE : CONTAINER;
  return (
    <div className={`animate-in ${bare ? '' : `${measure} py-6`} ${className || ''}`}>
      {children}
    </div>
  );
}

// Container whose direct children fade+rise in sequence (CSS nth-child delays).
export function Stagger({ children, className }) {
  return <div className={`stagger ${className || ''}`}>{children}</div>;
}

// Item inside a <Stagger>. Just a wrapper div — the parent's CSS drives it.
export function StaggerItem({ children, className }) {
  return <div className={className}>{children}</div>;
}

// Stat number. Rendered statically (no per-frame JS animation) — a count-up
// forced constant repaints that conflicted with CSS transforms and left paint
// artifacts. The tile still enters via the CSS stagger.
export function AnimatedNumber({ value, className, format = (n) => n.toLocaleString('en-IN') }) {
  return <span className={className}>{format(value ?? 0)}</span>;
}
