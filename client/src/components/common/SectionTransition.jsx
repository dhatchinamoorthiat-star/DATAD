import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import DATADLoader from './DATADLoader';
import { getInflight, subscribeInflight } from '../../utils/inflight';
import { getMountedPath, subscribeRouteMount } from '../../utils/routeReady';

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

// How long to wait, after the page has mounted, for it to fire its first
// request. This is NOT a minimum display time — it is the only way to tell a
// page that fetches nothing from one that is about to fetch. The moment a
// request appears we stop counting and wait on real completion instead.
const FIRST_REQUEST_GRACE_MS = 350;
// Pages commonly chain fetches (list, then counts). Requiring the counter to
// sit at zero for a beat stops the overlay lifting between those calls.
const QUIET_MS = 220;
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

    // Only between two known sections: skips login -> app and any excursion
    // through a public page, which shouldn't read as a section switch.
    if (!from || !section || from === section) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Drives the route-transition overlay against router and network timing —
    // an external system, which is what an effect is for.
    let quietTimer = null;
    let exitTimer = null;
    let rafId = null;
    let settled = false;
    // Gate 1: the lazy chunk has landed and the page component is mounted.
    let mounted = false;
    // Gate 2: whether this page turned out to fetch anything at all.
    let sawRequest = false;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase('active');

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(quietTimer);
      // Two frames: let React commit the loaded page and let the browser paint
      // it *underneath* the glass, so lifting the overlay reveals finished
      // content rather than a blank frame that fills in a beat later.
      rafId = requestAnimationFrame(() => {
        rafId = requestAnimationFrame(() => {
          setPhase('leaving');
          exitTimer = setTimeout(() => setPhase('idle'), EXIT_MS);
        });
      });
    };

    // Re-evaluated whenever the page mounts or the in-flight count changes.
    const evaluate = () => {
      if (settled || !mounted) return;
      clearTimeout(quietTimer);
      if (getInflight() > 0) {
        sawRequest = true;
        return;
      }
      // Before any request has been seen this is the "does this page fetch?"
      // window; afterwards it is the much shorter gap-between-chained-calls
      // window. Either way we re-check the counter before committing.
      const wait = sawRequest ? QUIET_MS : FIRST_REQUEST_GRACE_MS;
      quietTimer = setTimeout(() => {
        if (getInflight() === 0) finish();
      }, wait);
    };

    const unsubInflight = subscribeInflight(evaluate);
    const unsubMount = subscribeRouteMount((path) => {
      // Ignore mounts for some other section (e.g. a redirect in flight).
      if (sectionOf(path) !== section) return;
      mounted = true;
      evaluate();
    });
    // The chunk may already be cached, in which case the mount fired before we
    // subscribed and no further event is coming.
    if (sectionOf(getMountedPath() || '') === section) {
      mounted = true;
      evaluate();
    }

    const capTimer = setTimeout(finish, MAX_MS);

    return () => {
      unsubInflight();
      unsubMount();
      clearTimeout(quietTimer);
      clearTimeout(capTimer);
      clearTimeout(exitTimer);
      if (rafId) cancelAnimationFrame(rafId);
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
