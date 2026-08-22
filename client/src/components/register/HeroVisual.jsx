import Logo from '../common/Logo';
import NeuralField from './NeuralField';
import TrustIndicators from './TrustIndicators';
import AIPreviewCard from './AIPreviewCard';
import { IDENTITY } from './identityTokens';

// Left half of the register split-screen: the story, told before anything is
// asked for.
//
// This panel is committed dark in both themes. It is a brand canvas, the way a
// photograph is a brand canvas — the constellation and the trajectory line are
// drawn for near-black and go flat and grey on a white surface. The form panel
// beside it still follows the user's theme, which is the same split Stripe and
// Linear run on their signup screens.
//
// It is also `hidden lg:flex`. Below 1024px this whole column is dropped rather
// than stacked: a full-height animated canvas above a form on a phone means the
// first thing a student on mobile data pays for is a decorative SVG, and the
// first thing they see is not the form they came to fill in. The two pieces
// that carry real information — the unlock list and the trust claims — are
// re-rendered inside the form column at those sizes.
//
// Text here enters via CSS (`identity-rise`), not Framer. The headline is the
// argument for signing up; it does not get to depend on an animation frame.

const HEADLINE = [
  { text: 'Discover your strengths.', tone: 'paper' },
  { text: 'Build your career intelligence.', tone: 'paper' },
  { text: 'Unlock your potential.', tone: 'blue' },
];

export default function HeroVisual() {
  return (
    <div
      // Pinned to exactly one viewport, and sticky so it holds while the form
      // column scrolls. Without the pin it inherits the flex row's stretched
      // height: the form runs past the fold on a 720px laptop, the hero grows
      // with it, and `justify-between` pushes the trust claims off-screen —
      // the one part of this panel that most needs to be seen before typing.
      className="relative hidden overflow-hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[46%] lg:shrink-0 lg:flex-col lg:self-start xl:w-[48%]"
      style={{ background: IDENTITY.ink }}
    >
      <NeuralField />

      {/* Bottom scrim. The constellation drifts through the lower third and was
          cutting across the trust claims; this floors the contrast there
          without dimming the artwork behind the headline. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
        style={{ background: `linear-gradient(to top, ${IDENTITY.ink} 12%, transparent 100%)` }}
      />

      <div className="relative z-10 flex h-full flex-col justify-between p-8 xl:p-12">
        <div className="identity-rise" style={{ color: IDENTITY.paper }}>
          <Logo size={34} variant="horizontal" tone="brand" />
        </div>

        <div className="max-w-md">
          <h1 className="text-[2.1rem] font-semibold leading-[1.18] tracking-[-0.02em] xl:text-[2.4rem]">
            {HEADLINE.map((line, i) => (
              <span
                key={line.text}
                className="identity-rise block"
                style={{
                  '--rise-delay': `${0.1 + i * 0.12}s`,
                  color: line.tone === 'blue' ? IDENTITY.blueSoft : IDENTITY.paper,
                }}
              >
                {line.text}
              </span>
            ))}
          </h1>

          <p
            className="identity-rise mt-5 max-w-sm text-[14.5px] leading-relaxed"
            style={{ '--rise-delay': '0.42s', color: IDENTITY.muted }}
          >
            DATAD reads the psychology behind how you study, work and decide —
            then turns it into a career you can actually plan.
          </p>

          <AIPreviewCard className="mt-7 max-w-sm" baseDelay={0.54} />
        </div>

        <TrustIndicators className="max-w-sm" baseDelay={0.8} />
      </div>
    </div>
  );
}
