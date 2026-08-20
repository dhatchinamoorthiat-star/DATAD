import { useCallback, useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Search, Crown, Gem, Menu } from 'lucide-react';
import { DatadGlyph, DatadMark } from '../common/Logo';
import { WORKSPACES } from '../../utils/workspaces';

const PIN_KEY = 'datad:sidebar-pinned';

// Collapsed, the rail is just wide enough for a centred 32px glyph.
const COLLAPSED_W = '4rem';
const EXPANDED_W = '17rem';

// Each workspace icon carries its own accent so the rail still reads as a row
// of distinct marks when collapsed to icons only. Keys match WORKSPACES;
// anything unmapped falls back to the neutral blue.
const ICON_ACCENT = {
  dashboard: '#1A73E8',
  dax: '#8B5CF6',
  study: '#06B6D4',
  career: '#F97316',
  growth: '#6366F1',
  community: '#0D9488',
  me: '#F59E0B',
  finance: '#10B981',
  wellbeing: '#DB2777',
};
const FALLBACK_ACCENT = '#1A73E8';

// Bare glyph — no tile, no outline. The accent colour is carried by the icon
// stroke itself, the way the footer marks read.
function IconTile({ accent, isActive, icon: Icon }) {
  const color = ICON_ACCENT[accent] || FALLBACK_ACCENT;
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center transition-all duration-300 ${
        isActive ? 'scale-105' : 'opacity-75 group-hover:scale-105 group-hover:opacity-100'
      }`}
      style={{ color }}
    >
      <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
    </span>
  );
}

function readPinned() {
  try {
    return localStorage.getItem(PIN_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Desktop navigation rail.
 *
 * Two modes, toggled by the hamburger at the top-left:
 *  - pinned   → the rail stays expanded and pushes page content across.
 *  - floating → the rail sits collapsed to icons and expands on hover/focus,
 *               overlaying the page so nothing reflows.
 *
 * While floating and collapsed it also reacts to scroll: the nav drifts up
 * slightly and lifts off the page, and a progress line tracks the document.
 */
export default function RailSidebar({ isAdmin, onOpenPalette }) {
  const [pinned, setPinned] = useState(readPinned);
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [scroll, setScroll] = useState(0); // 0 → 1 document progress

  const expanded = pinned || hovered || focusWithin;

  useEffect(() => {
    try {
      localStorage.setItem(PIN_KEY, pinned ? '1' : '0');
    } catch {
      /* storage unavailable — the pin is a nicety, not critical state */
    }
  }, [pinned]);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setScroll(max > 0 ? Math.min(1, window.scrollY / max) : 0);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // The scroll response only applies while collapsed — an open rail should
  // stay perfectly still under the cursor.
  const drift = expanded ? 0 : scroll;

  // Collapsed, the rail is only wide enough for the glyph, so the horizontal
  // padding tightens with it — otherwise the icon drifts off centre.
  const pad = expanded ? 'px-3' : 'px-2';

  const link = useCallback(
    () =>
      ({ isActive }) =>
        `group relative flex items-center gap-3 rounded-2xl ${pad} py-2 outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-primary-400/60 ${
          isActive
            ? 'bg-primary-500/10 font-semibold text-primary-700 dark:bg-primary-400/15 dark:text-primary-300'
            : 'text-gray-600 hover:bg-gray-500/10 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
        }`,
    [pad],
  );

  const label = `whitespace-nowrap text-sm font-medium transition-all duration-200 ${
    expanded ? 'translate-x-0 opacity-100' : 'pointer-events-none -translate-x-1 opacity-0'
  }`;

  return (
    <>
      {/* Flow spacer. The rail is fixed, so this is what reserves its width in
          the layout. It tracks `expanded`, not `pinned`: if it only tracked
          pinned, hovering would widen the rail on top of the page and clip the
          content underneath. Both transition over the same 300ms, so the page
          slides aside with the rail rather than jumping. */}
      <div
        className="hidden shrink-0 transition-[width] duration-300 ease-out lg:block print:hidden"
        style={{ width: expanded ? EXPANDED_W : COLLAPSED_W }}
        aria-hidden="true"
      />

      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocusWithin(true)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setFocusWithin(false);
        }}
        className="fixed inset-y-0 left-0 z-50 hidden h-screen flex-col overflow-hidden border-r border-gray-200/60 bg-gradient-to-b from-white/80 via-white/55 to-white/25 text-gray-700 backdrop-blur-xl transition-[width,box-shadow] duration-300 ease-out dark:border-gray-800/60 dark:from-gray-950/80 dark:via-gray-950/55 dark:to-gray-950/25 dark:text-gray-300 lg:flex print:hidden"
        style={{
          width: expanded ? EXPANDED_W : COLLAPSED_W,
          boxShadow: expanded || drift > 0.02 ? '0 10px 40px -12px rgba(15, 23, 42, 0.18)' : 'none',
        }}
      >
        {/* Scroll progress line down the rail's inner edge. */}
        <span
          aria-hidden="true"
          className="absolute right-0 top-0 w-px bg-gradient-to-b from-primary-400/70 to-primary-600/70 transition-[height] duration-150 ease-out"
          style={{ height: `${scroll * 100}%` }}
        />

        <div className={`flex items-center gap-2 py-4 ${expanded ? 'px-3' : 'px-1.5'}`}>
          {/* Collapsed, the rail is only 4rem wide — barely more than this one
              40px slot — so the mark and the pin control take turns in it
              rather than competing for the width. At rest the glyph identifies
              the rail; the moment it opens (hover, focus or pinned) the glyph
              hands the slot to the pin button and reappears inside the full
              lockup alongside it. The button keeps its tab stop while faded:
              focusing it expands the rail, which is what reveals it. */}
          <div className="relative h-10 w-10 shrink-0">
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
                expanded ? 'opacity-0' : 'opacity-100'
              }`}
            >
              <DatadGlyph size={26} tone="brand" />
            </span>
            <button
              type="button"
              onClick={() => setPinned((p) => !p)}
              aria-pressed={pinned}
              aria-label={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
              title={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
              className={`absolute inset-0 flex items-center justify-center rounded-xl text-gray-600 transition-[opacity,color,background-color] duration-200 hover:bg-gray-500/10 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/60 dark:text-gray-400 dark:hover:text-gray-100 ${
                expanded ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
          <span aria-hidden={expanded ? undefined : 'true'} className={`flex items-center font-semibold ${label}`}>
            <DatadMark size="sm" />
          </span>
        </div>

        <button
          onClick={onOpenPalette}
          aria-label="Search"
          className={`mb-4 flex items-center gap-3 rounded-2xl border border-gray-300/60 py-2 text-sm text-gray-500 transition-colors hover:border-primary-400/60 hover:text-gray-800 dark:border-gray-700/60 dark:text-gray-400 dark:hover:text-gray-100 ${
            expanded ? 'mx-3 px-3' : 'mx-2 px-2'
          }`}
        >
          <Search className="h-[18px] w-[18px] shrink-0" />
          <span className={label}>Search…</span>
          <kbd className={`ml-auto rounded border border-gray-300/70 px-1.5 py-0.5 text-[10px] dark:border-gray-700/70 ${label}`}>⌘K</kbd>
        </button>

        <nav
          className={`scroll-ios flex flex-1 flex-col gap-1 overflow-y-auto transition-transform duration-300 ease-out ${pad}`}
          style={{ transform: `translateY(${-drift * 6}px)` }}
        >
          {WORKSPACES.map((w) => (
            <NavLink key={w.key} to={w.to} end={w.end} title={w.label} className={link()}>
              {({ isActive }) => (
                <>
                  <IconTile accent={w.key} isActive={isActive} icon={w.icon} />
                  <span className={label}>{w.label}</span>
                </>
              )}
            </NavLink>
          ))}

          {isAdmin && (
            <>
              <div className="mx-2 my-2 border-t border-gray-200/70 dark:border-gray-800/70" />
              <NavLink to="/admin" title="Admin" className={link()}>
                {({ isActive }) => (
                  <>
                    <IconTile accent="career" isActive={isActive} icon={Crown} />
                    <span className={label}>Admin</span>
                  </>
                )}
              </NavLink>
            </>
          )}
        </nav>

        <div className={`space-y-1 pb-4 ${pad}`}>
          <NavLink to="/subscribe" title="Upgrade plan" className={link()}>
            {({ isActive }) => (
              <>
                <IconTile accent="me" isActive={isActive} icon={Gem} />
                <span className={label}>Upgrade plan</span>
              </>
            )}
          </NavLink>
          {/* Wraps rather than nowrap — at 17rem the tagline is wider than the
              rail, and the rail clips its overflow. */}
          <p
            className={`px-1 pt-1 text-[11px] leading-snug text-gray-400 transition-opacity duration-200 ${
              expanded ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            Your student OS — every day, one place.
          </p>
        </div>
      </aside>
    </>
  );
}
