import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import DATADLoader from './DATADLoader';
import { whenRouteSettled } from '../../utils/routeSettle';

/**
 * Frosted interstitial shown when moving between top-level sections
 * (Home, Dax, Study, Career, …), held until the incoming section's data has
 * actually arrived rather than for a fixed time.
 *
 * Deliberately does NOT fire for navigation *within* a section — /study ->
 * /study/notes is a tab change, and flashing an overlay on those would be
 * maddening. Mounted above <Routes> rather than inside AppLayout because /dax
 * lives outside that layout and still needs to participate.
 */

// Keys map to first path segment; see utils/workspaces.js.
const SECTIONS = ['dashboard', 'dax', 'study', 'career', 'community', 'me', 'finance', 'wellbeing'];

export function sectionOf(pathname) {
  // /briefing is top-level in the router but presented as a Career tab, so it
  // belongs to career here — otherwise switching to it reads as a section jump.
  if (pathname.startsWith('/briefing')) return 'career';
  const seg = pathname.split('/')[1] || '';
  return SECTIONS.includes(seg) ? seg : null;
}

// Hard ceiling. Whatever happens — hung request, offline, a chunk that never
// arrives — the overlay must never trap the user behind it.
const MAX_MS = 10000;
// Must match the .is-leaving animation duration in index.css.
const EXIT_MS = 320;

export default function SectionTransition() {
  const { pathname } = useLocation();
  const section = sectionOf(pathname);
  const prev = useRef(section);
  const [phase, setPhase] = useState('idle'); // idle | active | leaving

  useEffect(() => {
    const from = prev.current;
    prev.current = section;

    // Only between two known sections: skips login -> app (WelcomeCurtain owns
    // that one) and any excursion through a public page, which shouldn't read
    // as a section switch.
    if (!from || !section || from === section) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    // Drives the route-transition overlay against router and network timing —
    // an external system, which is what an effect is for.
    let exitTimer = null;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase('active');

    const stop = whenRouteSettled({
      matches: (path) => sectionOf(path) === section,
      maxMs: MAX_MS,
      onSettled: () => {
        setPhase('leaving');
        exitTimer = setTimeout(() => setPhase('idle'), EXIT_MS);
      },
    });

    return () => {
      stop();
      clearTimeout(exitTimer);
      // Without this, tearing down mid-exit would strand the overlay at
      // opacity 0 while still covering — and swallowing — every click.
      setPhase('idle');
    };
  }, [section]);

  if (phase === 'idle') return null;

  return (
    <div
      className={`datad-transition${phase === 'leaving' ? ' is-leaving' : ''}`}
      // The page behind is mid-swap; don't let it be announced or clicked.
      aria-hidden="true"
    >
      <DATADLoader width={200} className="!py-0" />
    </div>
  );
}
