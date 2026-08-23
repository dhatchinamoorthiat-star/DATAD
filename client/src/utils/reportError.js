/**
 * One place a frontend error gets reported from.
 *
 * `main.jsx` wraps the app in `Sentry.ErrorBoundary`, which sounds like it
 * covers everything and does not: `components/common/ErrorBoundary` is mounted
 * *inside* it, around individual sections, and a React error boundary stops
 * propagation. Every section-level crash — the ones that render "This section
 * hit an unexpected error" to a student — was caught, logged to a console
 * nobody is reading, and never reported anywhere.
 *
 * Two sinks, because they fail in different ways and neither is guaranteed:
 *
 *   Sentry     rich, grouped, alertable, and present only when VITE_SENTRY_DSN
 *              is configured. Absent in development and in any deployment that
 *              has not set it up.
 *   Our API    POST /api/telemetry/error, which always exists and lands in the
 *              same server-side pipeline as a 500 — same redaction, same
 *              correlation id, same log stream. This is what makes the feature
 *              work with no vendor at all.
 */

import * as Sentry from '@sentry/react';

const ENDPOINT = `${import.meta.env.VITE_API_URL || ''}/api/telemetry/error`;

/**
 * A broken page can throw the same error on every render. Reporting each one
 * would flood the endpoint and, with a paid tracker, the quota — so identical
 * messages are reported once per session.
 */
const seen = new Set();
const MAX_DISTINCT = 20;

function alreadyReported(key) {
  if (seen.has(key)) return true;
  // Bounded: a page generating unbounded distinct messages must not grow this
  // set without limit. Past the cap we stop reporting rather than stop
  // remembering — by then the first twenty have said what there is to say.
  if (seen.size >= MAX_DISTINCT) return true;
  seen.add(key);
  return false;
}

/**
 * Report a client-side error.
 *
 * Never throws and never rejects. Every caller is already handling a failure,
 * and an exception here would replace a rendered fallback with a blank screen.
 *
 * @param {Error|string} error
 * @param {{componentStack?: string, kind?: string}} [info]
 */
export function reportError(error, info = {}) {
  try {
    const message = (error instanceof Error ? error.message : String(error)) || 'Unknown client error';
    if (alreadyReported(`${info.kind || 'error'}:${message}`)) return;

    if (import.meta.env.VITE_SENTRY_DSN) {
      Sentry.captureException(error, { extra: { componentStack: info.componentStack, kind: info.kind } });
    }

    // `keepalive` so the report survives the navigation that a crashing page
    // often triggers — without it, a reload discards the in-flight request and
    // the error that caused the reload is the one that never gets reported.
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        message,
        stack: error instanceof Error ? error.stack : undefined,
        componentStack: info.componentStack,
        kind: info.kind || 'ClientError',
        // Path only. A verification or reset link carries a single-use token in
        // the query string, and this endpoint has no business receiving one.
        url: `${window.location.origin}${window.location.pathname}`,
      }),
    }).catch(() => {
      // Offline, blocked by an extension, or the API is the thing that is down —
      // all of which are ordinary, and none of which the student should see.
    });
  } catch {
    /* reporting must never be the reason something breaks */
  }
}

/**
 * Catch errors that escape React entirely: event handlers, async callbacks,
 * and rejected promises nobody awaited. React error boundaries do not see any
 * of these, so without this they reach the console and stop there.
 *
 * Called once, from main.jsx.
 */
export function installGlobalErrorReporting() {
  window.addEventListener('error', (event) => {
    // Resource load failures (a broken <img>) also fire this with no `error`.
    // They are noise, and there are a lot of them.
    if (!event.error) return;
    reportError(event.error, { kind: 'UncaughtError' });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    reportError(reason, { kind: 'UnhandledRejection' });
  });
}
