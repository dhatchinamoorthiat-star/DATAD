/**
 * The API origin, for the callers that cannot go through `api/axios.js`.
 *
 * Most of the app talks to the server through the shared axios instance, which
 * carries `baseURL` and the auth/device interceptors. A handful of call sites
 * legitimately cannot: `navigator.sendBeacon` and `EventSource` are browser
 * primitives with their own URL argument, and the error reporter has to work
 * even when the module graph around axios is what broke.
 *
 * Those call sites used to hardcode `/api/...`, which is right only when the
 * client and the API share an origin. In the Capacitor shell they do not: the
 * bundle is served from the app's own local origin (`https://localhost` on
 * Android, `capacitor://localhost` on iOS), so a relative `/api` resolves to
 * the WebView's own asset server and every such call 404s against the app
 * itself — silently, because all of these are fire-and-forget.
 *
 * Same rule as api/axios.js: the build-time env var wins, `/api` is the
 * same-origin default. See client/.env.native.
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

/**
 * Join an API path onto the base. `path` is the part after `/api`, with a
 * leading slash — `apiUrl('/beta/events')`.
 */
export function apiUrl(path) {
  return `${API_BASE}${path}`;
}

export default API_BASE;
