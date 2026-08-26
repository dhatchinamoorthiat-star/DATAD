/**
 * Single source of truth for "which hostname may appear in a link we email".
 *
 * An emailed link is a capability: password-reset and email-verification URLs
 * carry a bearer token in the query string. Whoever controls the hostname in
 * that link receives the token when the recipient clicks. So the hostname must
 * never be derived from anything the requester controls.
 *
 * The request's own Origin header IS requester-controlled — it is set by the
 * caller, not by the browser's same-origin policy, for a plain cross-origin
 * POST. Trusting it let an attacker POST /auth/forgot-password for someone
 * else's address with `Origin: https://attacker.ngrok-free.app` and have DATAD
 * mail that victim a genuine reset token pointed at the attacker's host.
 *
 * Local tunnel development still needs Origin-derived links (a localhost
 * CLIENT_URL is unreachable through an ngrok tunnel), so that behaviour is
 * kept — but strictly outside production.
 */

// ngrok's free tier rotates the subdomain on every restart, so the tunnel is
// matched by pattern rather than by an exact allow-list entry. Anchored at both
// ends: `https://evil.com/#.ngrok.io` and `https://x.ngrok.io.evil.com` must
// not match.
const DEV_TUNNEL_RE =
  /^https:\/\/[a-z0-9-]+\.(ngrok-free\.app|ngrok-free\.dev|ngrok\.app|ngrok\.io)$/;

/**
 * The origins the Capacitor shell serves the bundle from. Fixed constants of
 * the platform, not deployment config: `https://localhost` on Android (from
 * `androidScheme: "https"` in client/capacitor.config.json — the plain-http
 * default would make the WebView a non-secure context and cost us crypto.subtle
 * and durable storage) and `capacitor://localhost` on iOS.
 *
 * Deliberately NOT appended to CLIENT_URL. That variable is doing two jobs at
 * once — CORS allow-list, and the source of the hostname in every emailed reset
 * and verification link — and only the first is wanted here. Putting
 * `capacitor://localhost` in the list risks it becoming entry [0] on some
 * future edit, at which point primaryClientUrl() starts mailing students a
 * password-reset link that only resolves inside an iOS app. Separate constant,
 * consulted only by the CORS rule.
 *
 * `http://localhost` is not in the list even though it is Capacitor's default
 * Android origin, precisely because we changed that default: bare
 * `http://localhost` with no port is an origin any process on a developer's or
 * a user's machine can claim by binding port 80, and it buys nothing once
 * androidScheme is https.
 */
const NATIVE_APP_ORIGINS = ['capacitor://localhost', 'https://localhost'];

const isProduction = () => process.env.NODE_ENV === 'production';

/**
 * The canonical client origin. CLIENT_URL may be a comma-separated allow-list
 * (prod + www + localhost); the first entry is the canonical one and is the
 * only one ever used to build a link. Splitting matters: interpolating the raw
 * variable would emit "https://a.com,https://b.com/reset-password?token=…".
 */
/**
 * Split CLIENT_URL into normalised origins.
 *
 * Trailing slashes are stripped here rather than at one call site, because a
 * browser's Origin header never carries a path — it is always exactly
 * `scheme://host[:port]`. So `CLIENT_URL=https://datad.app/` matched nothing in
 * the CORS check while still producing correct emailed links, which strip the
 * slash separately. The result was a deployment where password-reset mail
 * worked perfectly and every browser API call failed "Not allowed by CORS" —
 * with a one-character cause, in production only.
 */
function clientOrigins() {
  return (process.env.CLIENT_URL || '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

function primaryClientUrl() {
  return clientOrigins()[0] || 'http://localhost:5174';
}

/** Whether an origin is a development tunnel we may honour outside production. */
function isDevTunnelOrigin(origin) {
  return Boolean(origin) && DEV_TUNNEL_RE.test(origin);
}

/**
 * Base URL for a link sent by email.
 *
 * In production this ignores the request entirely and always returns the
 * configured client URL. Outside production a tunnel Origin is honoured so
 * local ngrok testing keeps working.
 */
function emailLinkBase(req) {
  if (!isProduction()) {
    const origin = (req && typeof req.get === 'function' && req.get('origin')) || '';
    if (isDevTunnelOrigin(origin)) return origin;
  }
  return primaryClientUrl();
}

/**
 * Base URL for a link that must reach the API server itself, not the SPA.
 *
 * Almost every emailed link points at the client, which then calls the API.
 * The admin approval link cannot: it is clicked from a mail client by someone
 * who has no session, so the handler is on the server and the link has to name
 * the server's own public origin. BASE_URL is that origin (already declared for
 * both Render services); without it there is no safe guess in production, so
 * the caller is told to skip the link rather than emit one pointing at
 * localhost — a dead button in an inbox is worse than a plain notification.
 */
function serverLinkBase() {
  const configured = String(process.env.BASE_URL || process.env.API_URL || '')
    .split(',')[0]
    .trim()
    .replace(/\/+$/, '');
  if (!configured) {
    if (isProduction()) return '';
    return `http://localhost:${process.env.PORT || 5001}`;
  }
  // Render's `fromService: property: host` substitutes a bare hostname, with no
  // scheme — and render.yaml uses it precisely so nobody hand-types the origin.
  // A bare host would emit `datad.onrender.com/api/...`, which a mail client
  // resolves as a relative path and turns into a dead button, so the scheme is
  // supplied here rather than being a thing the deployer must remember.
  if (/^https?:\/\//.test(configured)) return configured;
  return `${isProduction() ? 'https' : 'http'}://${configured}`;
}

/**
 * Whether a browser Origin should be allowed through CORS. Kept here so the
 * CORS allow-list and the emailed-link allow-list cannot drift apart — the
 * tunnel exception applies to both, or to neither.
 */
function isAllowedCorsOrigin(origin) {
  // Same normalisation as the emailed links — that shared parsing is the whole
  // point of keeping both rules in this file.
  const normalised = String(origin || '').replace(/\/+$/, '');
  if (clientOrigins().includes(normalised)) return true;
  // The store builds, which are a first-party client with no configurable
  // origin. Allowed in production too, unlike the tunnel exception below —
  // that one is a wildcard over hosts anybody can register, this is two fixed
  // strings, and it is the shipped app.
  if (NATIVE_APP_ORIGINS.includes(normalised)) return true;
  return !isProduction() && isDevTunnelOrigin(origin);
}

module.exports = {
  DEV_TUNNEL_RE,
  NATIVE_APP_ORIGINS,
  isProduction,
  clientOrigins,
  primaryClientUrl,
  isDevTunnelOrigin,
  emailLinkBase,
  serverLinkBase,
  isAllowedCorsOrigin,
};
