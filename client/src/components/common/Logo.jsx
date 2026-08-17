// DATAD brand — the "Terrace" identity.
//
// One path on a 120-unit grid drives every rendering of the mark: a disc with a
// three-step terrace cut out of it (evenodd fill, so the steps read as negative
// space at any size). The raster and vector masters in /public/brand are drawn
// from this same path, so the inline glyph below and the favicon/app icon can
// never drift apart.
//
// Brand colours:  #080B14 near-black · #4D7CFF intelligent blue · #E8EAF0 paper
//
// Lockup geometry is spec'd off the glyph size so every size stays proportional:
//   horizontal — gap = 1/3 of the mark's width, wordmark tracking +20
//   stacked    — gap = 1/4 of the mark's height, wordmark tracking +60
// Wordmark is Syne ExtraBold (see tailwind `font-brand`).

// Exported so the brand page can draw each cut deliberately at any size, to
// show them side by side. Product code should use DatadGlyph, which picks the
// right one for the size on its own.
export const MARK_PATH =
  'M60 12 A48 48 0 1 0 60 108 A48 48 0 1 0 60 12 Z M26 86 V74 H46 V62 H66 V50 H86 V86 Z';

// Below ~24px the three-step cut fills in, so the glyph switches to the
// two-step variant that keeps the terrace legible at favicon sizes.
export const MARK_PATH_SMALL =
  'M60 12 A48 48 0 1 0 60 108 A48 48 0 1 0 60 12 Z M26 88 V70 H54 V52 H86 V88 Z';

const SIZES = { sm: 24, md: 32, lg: 48 };

/**
 * The mark on its own — a square glyph, no wordmark. Use where space is tight
 * (collapsed rail, avatars, tab strips). Defaults to `currentColor` so it
 * inherits the surrounding text colour in both themes; pass `tone="brand"` to
 * pin it to brand blue.
 */
export function DatadGlyph({ size = 'md', tone = 'current', className = '', title }) {
  const px = typeof size === 'number' ? size : SIZES[size] || SIZES.md;
  return (
    <svg
      viewBox="0 0 120 120"
      width={px}
      height={px}
      className={`shrink-0 ${tone === 'brand' ? 'text-[#4D7CFF]' : ''} ${className}`}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : 'true'}
      focusable="false"
    >
      {title && <title>{title}</title>}
      <path fill="currentColor" fillRule="evenodd" d={px < 24 ? MARK_PATH_SMALL : MARK_PATH} />
    </svg>
  );
}

/** The "DATAD" wordmark on its own — Syne ExtraBold. */
export function DatadWordmark({ size = 'md', className = '', tracking = '0.02em' }) {
  const px = typeof size === 'number' ? size : SIZES[size] || SIZES.md;
  return (
    <span
      className={`font-brand font-extrabold leading-none ${className}`}
      style={{ fontSize: px, letterSpacing: tracking }}
    >
      DATAD
    </span>
  );
}

/**
 * The primary logo: the horizontal lockup (mark + wordmark).
 *
 * This is the default brand signature and what every surface should reach for.
 * `size` accepts a token (sm/md/lg) or a pixel number for the mark; the
 * wordmark and gap scale off it automatically.
 */
export function DatadMark({ size = 'md', tone = 'brand', className = '' }) {
  const px = typeof size === 'number' ? size : SIZES[size] || SIZES.md;
  return (
    <span
      className={`inline-flex items-center ${className}`}
      style={{ gap: px / 3 }}
      role="img"
      aria-label="DATAD"
    >
      <DatadGlyph size={px} tone={tone} />
      <DatadWordmark size={Math.round(px * 0.66)} tracking="0.02em" />
    </span>
  );
}

/**
 * Full logo block. `variant="stacked"` centres the wordmark under the mark with
 * its tracking opened up so the word's width approaches the mark's diameter —
 * used on the auth screens, where the logo is the focal point.
 */
export default function Logo({
  size = 'md',
  variant = 'stacked',
  tone = 'brand',
  showTagline = false,
  className = '',
}) {
  const px = typeof size === 'number' ? size : SIZES[size] || SIZES.md;

  if (variant === 'horizontal') {
    return (
      <span className={`inline-flex flex-col items-start ${className}`}>
        <DatadMark size={px} tone={tone} />
        {showTagline && <Tagline />}
      </span>
    );
  }

  return (
    <span className={`inline-flex flex-col items-center ${className}`}>
      <span className="flex flex-col items-center" style={{ gap: px / 4 }}>
        <DatadGlyph size={px} tone={tone} />
        <DatadWordmark size={Math.round(px * 0.47)} tracking="0.06em" />
      </span>
      {showTagline && <Tagline />}
    </span>
  );
}

function Tagline() {
  return (
    <span className="mt-2 text-[11px] uppercase tracking-[0.2em] text-gray-400">
      Technology · Psychology · Impact
    </span>
  );
}
