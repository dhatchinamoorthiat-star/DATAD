import { IDENTITY } from '../creator/creatorTokens';
import Reveal from '../creator/Reveal';

// D · A · T · A · D, set as a ladder rather than a machine.
//
// The page this replaces animated these five letters through a three-stage
// timed reveal: cards flying in from above and below, dashed SVG connectors
// drawing themselves, `animate-ping` dots pulsing at every junction, and a
// replay button in the header for anyone who wanted to watch it again. It was
// the most expensive thing on the page and it delayed the one piece of
// information the section exists to deliver — what the letters stand for — by
// two full seconds.
//
// The letters are the point, so the letters are simply there. Each rung reveals
// on scroll like every other block on the page, the numeral and word sit beside
// it in the same register the chapters use, and nothing has to finish playing
// before the section can be read. On a phone it is a list; above `sm` the
// letter takes a fixed column so the five words align into a spine.
export default function AcronymLadder({ steps, className = '' }) {
  return (
    <ol className={`border-t ${className}`} style={{ borderColor: IDENTITY.inkLine }}>
      {steps.map((step, i) => (
        <Reveal
          as="li"
          key={step.word}
          delay={i * 90}
          className="grid grid-cols-[auto_1fr] items-baseline gap-x-6 border-b py-6 sm:grid-cols-[5.5rem_1fr] sm:gap-x-10 sm:py-7"
          style={{ borderColor: IDENTITY.inkLine }}
        >
          {/* The letter, at display size. Colour alternates blue/violet down the
              ladder rather than running through five different hues — the old
              page gave each letter its own colour and its own drop-shadow glow,
              which read as five unrelated brands stacked up. */}
          <span
            className="text-[44px] font-semibold leading-none tracking-[-0.04em] tabular-nums sm:text-[58px]"
            style={{ color: i % 2 === 0 ? IDENTITY.blueSoft : IDENTITY.violet }}
            aria-hidden="true"
          >
            {step.letter}
          </span>

          <div className="min-w-0">
            <h3
              className="text-[17px] font-semibold tracking-[-0.01em] sm:text-[19px]"
              style={{ color: IDENTITY.paper }}
            >
              <span className="sr-only">{step.letter} — </span>
              {step.word}
            </h3>
            <p className="mt-2 max-w-[54ch] text-[14px] leading-relaxed" style={{ color: IDENTITY.muted }}>
              {step.body}
            </p>
          </div>
        </Reveal>
      ))}
    </ol>
  );
}
