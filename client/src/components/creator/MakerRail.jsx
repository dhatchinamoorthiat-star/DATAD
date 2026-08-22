import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import Logo from '../common/Logo';
import ChapterRail from './ChapterRail';
import MakerPortrait from './MakerPortrait';
import { IDENTITY, CREATOR } from './creatorTokens';
import { MAKER } from '../../utils/maker';

// The page's fixed left column: who is speaking, and where you are in what
// they are saying.
//
// Register puts a permanently dark panel on the left and lets the form column
// scroll beside it. This is the same move at a different width — ~300px instead
// of 46% — because the two pages are asking for opposite things. A signup
// screen needs to spend half the viewport arguing that the form is worth
// filling in. A maker's page has already won that argument by the time you are
// here; what it needs is for the reader's eye to stay anchored to one name for
// the length of a long read, and for that length to be honest and visible.
//
// Below 1024px this column is dropped, not stacked — the same call HeroVisual
// makes, for the same reason. `MakerBar` below re-renders the two parts that
// carry information (the identity, the way out) as a slim sticky bar, and the
// reading-position job passes to the progress hairline at the top of the
// viewport, which costs one pixel of height instead of three hundred.

function StillBuilding() {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
        <span
          className="pulse-indigo absolute inline-flex h-full w-full rounded-full"
          style={{ background: CREATOR.live }}
        />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: CREATOR.live }} />
      </span>
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em]" style={{ color: CREATOR.live }}>
        Still building
      </span>
    </span>
  );
}

export default function MakerRail({ chapters, active, onJump }) {
  return (
    <aside
      className="hidden shrink-0 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[292px] lg:flex-col lg:justify-between lg:self-start lg:border-r xl:w-[324px]"
      style={{ borderColor: IDENTITY.inkLine }}
    >
      <div className="flex flex-col gap-8 px-7 pt-8 xl:px-9">
        <Link
          to="/"
          className="creator-focus group inline-flex items-center gap-2 text-[12.5px] transition-colors duration-200 hover:text-[#E8EAF0]"
          style={{ color: IDENTITY.muted }}
        >
          <ArrowLeft
            className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5"
            aria-hidden="true"
          />
          Back to DATAD
        </Link>

        <div className="identity-rise" style={{ color: IDENTITY.paper, '--rise-delay': '0.06s' }}>
          <Logo size={28} variant="horizontal" tone="brand" />
        </div>

        {/* The name plate. Formal name first and largest, because the first
            reader of this page may well be a recruiter; the handle underneath,
            attached rather than free-standing, because a handle on its own
            starts behaving like a job title. See MAKER_IDENTITY.md.

            The portrait chip turns this from a caption into an identity card,
            and it is the reason the face is present in every chapter rather
            than only in the one that introduces it. It removes itself if the
            photograph is missing — see MakerPortrait. */}
        <div className="identity-rise" style={{ '--rise-delay': '0.14s' }}>
          <div className="flex items-start gap-3">
            <MakerPortrait variant="chip" />
            <div className="min-w-0">
              <h2
                className="text-[15px] font-semibold leading-tight tracking-[-0.01em]"
                style={{ color: IDENTITY.paper }}
              >
                {MAKER.legalName}
              </h2>
              <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: IDENTITY.muted }}>
                builds as <span style={{ color: IDENTITY.blueSoft }}>{MAKER.handle}</span>
                <br />
                {MAKER.role}
              </p>
            </div>
          </div>
          <p className="mt-3.5">
            <StillBuilding />
          </p>
        </div>
      </div>

      <div className="px-7 xl:px-9">
        <ChapterRail chapters={chapters} active={active} onJump={onJump} />
      </div>

      <div className="px-7 pb-8 xl:px-9">
        <Link
          to="/register"
          className="creator-focus group flex items-center justify-between gap-2 rounded-xl border px-4 py-3 transition-colors duration-200 hover:border-[#4D7CFF]"
          style={{ borderColor: IDENTITY.inkLine, background: CREATOR.plate }}
        >
          <span className="text-[13px] font-semibold" style={{ color: IDENTITY.paper }}>
            Join DATAD
          </span>
          <ArrowUpRight
            className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            style={{ color: IDENTITY.blueSoft }}
            aria-hidden="true"
          />
        </Link>
        <p className="mt-3 text-[10.5px] leading-relaxed" style={{ color: '#5C6474' }}>
          {MAKER.studio} · {MAKER.place}
        </p>
      </div>
    </aside>
  );
}

// The same object at phone width: identity, escape hatch, status. Nothing else
// fits at 375px without pushing the first sentence below the fold.
export function MakerBar() {
  return (
    <div
      className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b px-5 py-3 backdrop-blur-md lg:hidden"
      style={{ borderColor: IDENTITY.inkLine, background: 'rgba(8, 11, 20, 0.82)' }}
    >
      <Link to="/" className="creator-focus flex items-center gap-2.5" aria-label="Back to DATAD">
        <ArrowLeft className="h-4 w-4" style={{ color: IDENTITY.muted }} aria-hidden="true" />
        <span style={{ color: IDENTITY.paper }}>
          <Logo size={22} variant="horizontal" tone="brand" />
        </span>
      </Link>
      <StillBuilding />
    </div>
  );
}
