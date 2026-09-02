import { useEffect, useState } from 'react';
import DATADLoader from './DATADLoader';
import { DatadGlyph } from './Logo';
import { sectionOf } from './SectionTransition';
import { subscribeWelcome } from '../../utils/welcome';
import { whenRouteSettled } from '../../utils/routeSettle';

/**
 * The moment right after sign-in: the mark, the wordmark drawing itself, and a
 * line addressed to the person who just arrived — held until the page behind
 * has actually finished loading.
 *
 * Deliberately opaque rather than the frosted glass SectionTransition uses.
 * That overlay blurs a page you were already looking at; this one covers the
 * hand-off from a dark auth screen to a full dashboard, and letting skeletons
 * flicker through would undercut the one branded beat in the whole session.
 *
 * SectionTransition never fires here — login is not a section, so its
 * from-section gate rules the login -> app hop out.
 */

// Must stay in sync with the .datad-welcome.is-leaving animation in index.css.
const EXIT_MS = 420;
// A greeting that flashes past is worse than no greeting: the eye registers
// movement, not words. Hold long enough for the wordmark to draw and the line
// to be read even when the dashboard is warm and answers instantly.
const MIN_MS = 1800;
// Hard ceiling: a hung request must never leave someone stuck behind a curtain.
const MAX_MS = 9000;

export default function WelcomeCurtain() {
  const [guest, setGuest] = useState(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(
    () =>
      subscribeWelcome((payload) => {
        setLeaving(false);
        setGuest(payload);
      }),
    []
  );

  useEffect(() => {
    if (!guest) return undefined;

    // Drives an overlay against router and network timing — an external
    // system, which is what an effect is for.
    let exitTimer = null;
    const target = guest.target || '/dashboard';
    const section = sectionOf(target);

    const stop = whenRouteSettled({
      // Deep links (?next=/placement/resume) land on a tab inside a section, so
      // match the section where there is one and fall back to the exact path.
      matches: (path) => (section ? sectionOf(path) === section : path === target),
      minMs: MIN_MS,
      maxMs: MAX_MS,
      onSettled: () => {
        setLeaving(true);
        exitTimer = setTimeout(() => setGuest(null), EXIT_MS);
      },
    });

    return () => {
      stop();
      clearTimeout(exitTimer);
    };
  }, [guest]);

  if (!guest) return null;

  return (
    <div className={`datad-welcome${leaving ? ' is-leaving' : ''}`} role="status" aria-live="polite">
      <div className="datad-welcome-stack">
        {/* Mark above wordmark is the stacked lockup from Logo.jsx — except the
            wordmark here is the loader, drawing itself while the page loads. */}
        <div className="datad-welcome-lockup">
          <DatadGlyph size={68} tone="brand" />
          <DATADLoader width={200} className="!py-0" label="Loading your dashboard" />
        </div>
        <div className="datad-welcome-copy">
          <p className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-50 sm:text-2xl">
            Welcome back{guest.name ? `, ${guest.name}` : ''}.
          </p>
          <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
            Getting your day together…
          </p>
        </div>
      </div>
    </div>
  );
}
