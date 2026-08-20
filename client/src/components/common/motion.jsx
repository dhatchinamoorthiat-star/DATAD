import PageOverview from './PageOverview';

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
// `wide` and `overview` compose: the guide card sits beside the wider measure.
// Pass `overview` ({ pageKey, title, blurb, takeaway }) to add a Dax-explains-
// this-page card in a sticky right-hand column (xl screens and up). That
// column is a flex sibling of the (unconstrained-width) row, not nested
// inside a further mx-auto max-w wrapper — nesting it left a blank gutter
// between the card and the true right edge on wide screens, which defeated
// the point of putting a card there at all.
export function Page({ children, className, bare = false, wide = false, overview = null }) {
  if (overview) {
    return (
      <div className="animate-in flex w-full gap-6 px-4 py-6 xl:px-6">
        <div className="min-w-0 flex-1">
          {/* `className` lands here, not on the flex row — it means "classes for
              the page's content" in the non-overview branch too, and a spacing
              utility like space-y-5 on the row would silently retarget itself
              at [content column, aside] and drop the page's own rhythm. */}
          {/* `wide` still means what it means without an overview — a card-grid
              page does not become a prose page just because it grew a guide
              card. It is a cap, not a floor: the aside claims its 288px first,
              so the column only reaches 5xl on genuinely wide screens. */}
          <div className={`mx-auto w-full ${wide ? 'max-w-5xl' : 'max-w-3xl'} ${className || ''}`}>{children}</div>
        </div>
        <aside className="hidden w-72 shrink-0 xl:block">
          <div className="sticky top-24">
            <PageOverview {...overview} />
          </div>
        </aside>
      </div>
    );
  }
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
