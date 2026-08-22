import { IDENTITY, CREATOR } from './creatorTokens';
import Reveal from './Reveal';

// What the product will not do, set as three struck-out words.
//
// The old page put these in three centred cards with a rose-tinted icon in a
// rounded square — the standard "our values" furniture, which is exactly the
// furniture that makes a promise read as decoration. A promise is stronger
// when the page performs it. So each item is one noun, set large, with a line
// drawn through it as you arrive.
//
// The strike is a `::after` on `.creator-strike` in index.css, scaled from
// transform-origin left when the wrapping Reveal flips `data-revealed`. CSS
// rather than Framer for the usual reason, and a transform rather than a
// width so the draw composites instead of laying out.
//
// Three items, no more. A refusal list that runs to eight stops being a
// position and starts being a feature comparison.
export default function RefusalList({ items, className = '' }) {
  return (
    <ul className={`grid gap-x-10 gap-y-8 sm:grid-cols-3 ${className}`}>
      {items.map((item, i) => (
        <Reveal as="li" key={item.term} delay={i * 130} style={{ '--strike-delay': `${0.25 + i * 0.13}s` }}>
          <p
            className="creator-strike relative inline-block text-[30px] font-semibold leading-none tracking-[-0.03em] sm:text-[34px]"
            style={{ color: IDENTITY.paper }}
          >
            {item.term}
            {/* The strike is decorative; the meaning is carried by the copy
                below and by this, for anyone who cannot see the line. */}
            <span className="sr-only"> — not in this product.</span>
          </p>
          <p
            className="mt-4 max-w-[34ch] text-[13.5px] leading-relaxed"
            style={{ color: IDENTITY.muted }}
          >
            {item.body}
          </p>
          <p className="mt-3 text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: CREATOR.ember }}>
            {item.note}
          </p>
        </Reveal>
      ))}
    </ul>
  );
}
