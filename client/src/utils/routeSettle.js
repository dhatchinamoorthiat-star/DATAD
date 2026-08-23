/**
 * "Is the incoming page actually ready?" — shared by every full-screen hold
 * (SectionTransition, WelcomeCurtain).
 *
 * Two gates have to close before a page counts as settled:
 *   1. the lazy chunk landed and the route component mounted (routeReady), and
 *   2. the requests it fired on mount have finished and stayed finished
 *      (inflight).
 *
 * Neither on its own is enough: the chunk download is invisible to the request
 * counter, and a counter that is momentarily zero may just be the gap between
 * two chained calls.
 */

import { getInflight, subscribeInflight } from './inflight';
import { getMountedPath, subscribeRouteMount } from './routeReady';

// How long to wait, after the page has mounted, for it to fire its first
// request. This is NOT a minimum display time — it is the only way to tell a
// page that fetches nothing from one that is about to fetch. The moment a
// request appears we stop counting and wait on real completion instead.
const FIRST_REQUEST_GRACE_MS = 350;
// Pages commonly chain fetches (list, then counts). Requiring the counter to
// sit at zero for a beat stops the overlay lifting between those calls.
const QUIET_MS = 220;

/**
 * Calls `onSettled` once the page matching `matches` has mounted and gone
 * quiet. Returns a cleanup function; after it runs, `onSettled` never fires.
 *
 * @param {(path: string) => boolean} matches  which route mount we are waiting on
 * @param {() => void} onSettled  runs once, after two frames of paint headroom
 * @param {number} [minMs]  floor on how long to wait, for holds that carry a
 *   message the user needs time to actually read
 * @param {number} [maxMs]  hard ceiling — a hung request must never trap the
 *   user behind a full-screen overlay
 */
export function whenRouteSettled({ matches, onSettled, minMs = 0, maxMs = 10000 }) {
  const startedAt = Date.now();
  let quietTimer = null;
  let minTimer = null;
  let capTimer = null;
  let paintTimer = null;
  let rafId = null;
  let settled = false;
  // Gate 1: the lazy chunk has landed and the page component is mounted.
  let mounted = false;
  // Gate 2: whether this page turned out to fetch anything at all.
  let sawRequest = false;

  const finish = () => {
    if (settled) return;
    settled = true;
    clearTimeout(quietTimer);
    clearTimeout(capTimer);
    minTimer = setTimeout(() => {
      // Two frames: let React commit the loaded page and let the browser paint
      // it *underneath* the overlay, so lifting it reveals finished content
      // rather than a blank frame that fills in a beat later.
      //
      // Raced against a timer because a backgrounded tab freezes rAF entirely.
      // Sign in, switch apps while the dashboard loads, come back — without
      // this the overlay is still there, and the maxMs cap can't save you
      // because the cap hands off to the very frames that never arrive.
      let ran = false;
      const run = () => {
        if (ran) return;
        ran = true;
        onSettled();
      };
      rafId = requestAnimationFrame(() => {
        rafId = requestAnimationFrame(run);
      });
      paintTimer = setTimeout(run, 150);
    }, Math.max(0, minMs - (Date.now() - startedAt)));
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
    // Ignore mounts for some other page (e.g. a redirect in flight).
    if (!matches(path)) return;
    mounted = true;
    evaluate();
  });
  // The chunk may already be cached, in which case the mount fired before we
  // subscribed and no further event is coming.
  if (matches(getMountedPath() || '')) {
    mounted = true;
    evaluate();
  }

  capTimer = setTimeout(finish, maxMs);

  return () => {
    settled = true;
    unsubInflight();
    unsubMount();
    clearTimeout(quietTimer);
    clearTimeout(minTimer);
    clearTimeout(capTimer);
    clearTimeout(paintTimer);
    if (rafId) cancelAnimationFrame(rafId);
  };
}
