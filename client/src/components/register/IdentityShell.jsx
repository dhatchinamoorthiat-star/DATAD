import { Link } from 'react-router-dom';
import Logo from '../common/Logo';
import HeroVisual from './HeroVisual';
import PhaseRail from './PhaseRail';
import AIPreviewCard from './AIPreviewCard';
import TrustIndicators from './TrustIndicators';
import { IDENTITY } from './identityTokens';

// The register split-screen frame.
//
// Not AuthShell. AuthShell is a single centred card on a soft background —
// right for login, where the job is to get one known person through two fields
// as fast as possible. Registration is the opposite job: the person doesn't
// know the product yet, so the screen has to give before it asks, and that
// needs a second column AuthShell has nowhere to put. Login is untouched.
//
// Responsive plan, and why:
//   ≥1024px  true split — story left, form right, both full height.
//   <1024px  the hero column is dropped, not stacked. A full-height animated
//            canvas above the form on a phone buries the form below the fold
//            and bills the student's data plan for artwork. Its two informative
//            parts are re-rendered under the form instead, on their own dark
//            band so the brand still shows up.
export default function IdentityShell({ phases, activePhase, phaseProgress, children }) {
  return (
    <div className="flex min-h-screen bg-white dark:bg-gray-950">
      <HeroVisual />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar: brand on small screens (where the hero is gone), and the
            escape hatch for people who already have an account — which belongs
            at the top, not only buried under the submit button. */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 sm:px-8 lg:px-10">
          <Link to="/" className="lg:invisible" aria-label="DATAD home">
            <Logo size={26} variant="horizontal" tone="brand" />
          </Link>
          <p className="shrink-0 text-[12.5px] text-gray-500 dark:text-gray-400">
            {/* The prefix is the first thing to go at 375px, where the wordmark
                and this line otherwise collide. "Log in" alone still reads. */}
            <span className="hidden sm:inline">Already have an account? </span>
            <Link
              to="/login"
              className="font-semibold text-primary-600 underline-offset-2 hover:underline dark:text-primary-400"
            >
              Log in
            </Link>
          </p>
        </div>

        <div className="flex flex-1 flex-col justify-center px-6 pb-6 sm:px-8 lg:px-10">
          <div className="mx-auto w-full max-w-[468px]">
            <PhaseRail
              phases={phases}
              activePhase={activePhase}
              progress={phaseProgress}
              className="mb-6"
            />
            {children}
          </div>
        </div>

        {/* Mobile-only: the hero's substance, minus the canvas. */}
        <div
          className="px-6 py-8 sm:px-8 lg:hidden"
          style={{ background: IDENTITY.ink }}
        >
          <div className="mx-auto w-full max-w-[468px]">
            <p
              className="identity-rise text-[15px] font-semibold leading-snug"
              style={{ color: IDENTITY.paper }}
            >
              Discover your strengths.
              <br />
              <span style={{ color: IDENTITY.blueSoft }}>Build your career intelligence.</span>
            </p>
            <AIPreviewCard compact className="mt-4" />
            <TrustIndicators className="mt-5" />
          </div>
        </div>

        <div className="px-6 py-4 sm:px-8 lg:px-10">
          <p className="mx-auto w-full max-w-[430px] text-center text-[11px] leading-relaxed text-gray-400 dark:text-gray-600">
            By continuing you agree to our{' '}
            <Link to="/terms" className="underline-offset-2 hover:underline">Terms</Link>
            {' '}and{' '}
            <Link to="/privacy" className="underline-offset-2 hover:underline">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
