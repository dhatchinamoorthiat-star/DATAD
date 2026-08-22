import { IDENTITY } from './creatorTokens';
import Reveal from './Reveal';

// The three commitments the product is built on, laid out as a staircase.
//
// This is the page's structural joke, and the only one: the DATAD mark is a
// disc with a three-step terrace cut into it, and there are exactly three of
// these. So they are not three cards in a row — they are three treads. Each
// stanza steps one riser to the right of the one before it, and the hairlines
// that connect them (a vertical riser down each stanza's left edge, a
// horizontal tread reaching back to the previous one) reconstruct the logo's
// cut at the scale of the layout itself.
//
// The step only exists at ≥1024px. Below that the stanzas stack flush left,
// because a staircase indent on a 375px screen is not a motif, it is 200px of
// lost measure.
//
// A card grid would have been faster to write and would have said nothing.
export default function TerraceStanzas({ items, className = '' }) {
  return (
    <div className={className}>
      {items.map((item, i) => (
        <Reveal
          key={item.title}
          delay={i * 90}
          className="creator-step relative pb-10 lg:pl-8 lg:pt-10"
          style={{ '--step': i }}
        >
          {/* Riser and tread — the two strokes of one step of the cut. */}
          <span
            aria-hidden="true"
            className="absolute bottom-0 left-0 top-0 hidden w-px lg:block"
            style={{ background: IDENTITY.inkLine }}
          />
          {i > 0 && (
            <span
              aria-hidden="true"
              className="creator-tread absolute left-0 top-0 hidden h-px lg:block"
              style={{ background: IDENTITY.inkLine }}
            />
          )}

          <div className="flex items-baseline gap-4">
            <span
              className="text-[12px] font-semibold tabular-nums tracking-[0.18em]"
              style={{ color: IDENTITY.blue }}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            <span
              className="text-[10.5px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: '#68717F' }}
            >
              {item.kicker}
            </span>
          </div>

          <h3
            className="mt-3 text-[22px] font-semibold leading-tight tracking-[-0.02em] sm:text-[26px]"
            style={{ color: IDENTITY.paper }}
          >
            {item.title}
          </h3>
          <p
            className="mt-3 max-w-[52ch] text-[14.5px] leading-relaxed"
            style={{ color: IDENTITY.muted }}
          >
            {item.body}
          </p>
        </Reveal>
      ))}
    </div>
  );
}
