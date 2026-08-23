/**
 * One-shot signal for "this person just signed in".
 *
 * The greeting has to outlive the page that triggers it — LoginPage unmounts
 * the instant we navigate — so the curtain is mounted app-wide and listens
 * here instead of being rendered by the form that knows about the login.
 */

const listeners = new Set();

/**
 * @param {{ name?: string, target?: string }} payload
 *   `name` is the first name to greet; `target` is the route being entered,
 *   which is what the curtain waits on before lifting.
 */
export function signalWelcome(payload) {
  listeners.forEach((fn) => fn(payload));
}

/** Returns an unsubscribe function. */
export function subscribeWelcome(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
