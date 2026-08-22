/**
 * Lightweight analytics — fires a POST /api/beta/events for each tracked event.
 *
 * Designed for the closed beta (20-30 users). In production this should be
 * replaced with PostHog, Mixpanel, or GA4.
 *
 * Usage:
 *   import { track } from '../../utils/analytics';
 *   track('roadmap_generated', { role: 'ML Engineer', gaps: 5 });
 *
 * Events are non-blocking (fetch + keepalive) and never reject.
 */
const SESSION_KEY = 'datad_session_id';

function getSessionId() {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

/**
 * Track an analytics event.
 *
 * @param {string} event  — snake_case event name (e.g. roadmap_generated)
 * @param {object} [properties] — arbitrary key-value payload
 */
export function track(event, properties = {}) {
  try {
    // sendBeacon (the primary path below) cannot set custom headers, so the
    // auth token travels in the body instead — the server decodes it from
    // there. Without this, every event 401s regardless of login state.
    let token = null;
    try { token = localStorage.getItem('token'); } catch { /* no-op */ }

    const body = JSON.stringify({
      event,
      properties,
      sessionId: getSessionId(),
      timestamp: new Date().toISOString(),
      token,
    });

    // Use sendBeacon when available (page unload safe), fallback to fetch.
    //
    // The payload MUST be a Blob with an explicit JSON type. sendBeacon sends a
    // bare string as `text/plain;charset=UTF-8`, which express.json() does not
    // parse — so the server saw an empty body and answered 400 "Event name is
    // required" for every event ever sent. sendBeacon is the primary path and
    // exists in every supported browser, so the fetch fallback below never ran
    // and the failure was total: zero events reached the database.
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        '/api/beta/events',
        new Blob([body], { type: 'application/json' })
      );
    } else {
      fetch('/api/beta/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Analytics must never throw — the app runs without it.
  }
}

/**
 * Wrap a React state setter with analytics tracking.
 * Returns a function that sets state and fires an event.
 *
 * Usage:
 *   const setRole = trackable(setTargetRole, 'target_role_set');
 *   setRole('ML Engineer'); // fires event with { value: 'ML Engineer' }
 */
export function trackable(setter, eventName) {
  return (value) => {
    setter(value);
    track(eventName, { value: typeof value === 'string' ? value : undefined });
  };
}
