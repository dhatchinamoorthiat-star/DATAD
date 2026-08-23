import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import Logo from '../common/Logo';
import ChapterRail from '../creator/ChapterRail';
import { IDENTITY, CREATOR } from '../creator/creatorTokens';

// The About page's fixed rail — MakerRail's sibling, not its copy.
//
// Same object, same 292/324px column, same ChapterRail inside it, because a
// reader moving between /about and /creator should feel one publication rather
// than two pages that happen to share a palette. What differs is what the rail
// identifies: /creator is one person's account, so its rail carries a portrait
// and a name. This page is about the product, so its rail carries the product's
// one-line thesis and the way out is a signup, not a contact line.
export default function AboutRail({ chapters, active, onJump }) {
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

        <p
          className="identity-rise max-w-[24ch] text-[13px] leading-relaxed"
          style={{ '--rise-delay': '0.14s', color: IDENTITY.muted }}
        >
          A student operating system with{' '}
          <span style={{ color: IDENTITY.paper }}>one memory</span> — and an
          assistant that has to show its working.
        </p>
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
          No ads · No trackers · Export is one click
        </p>
      </div>
    </aside>
  );
}

// Phone width: the way back, the mark, and nothing else. Same rule MakerBar
// follows — anything more pushes the first sentence below the fold at 375px.
export function AboutBar() {
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
      <Link
        to="/register"
        className="creator-focus text-[12.5px] font-semibold"
        style={{ color: IDENTITY.blueSoft }}
      >
        Join
      </Link>
    </div>
  );
}
