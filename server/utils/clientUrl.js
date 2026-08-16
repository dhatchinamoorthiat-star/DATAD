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

const isProduction = () => process.env.NODE_ENV === 'production';

/**
 * The canonical client origin. CLIENT_URL may be a comma-separated allow-list
 * (prod + www + localhost); the first entry is the canonical one and is the
 * only one ever used to build a link. Splitting matters: interpolating the raw
 * variable would emit "https://a.com,https://b.com/reset-password?token=…".
 */
function primaryClientUrl() {
  const raw = process.env.CLIENT_URL || 'http://localhost:5174';
  return raw.split(',')[0].trim().replace(/\/+$/, '');
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
 * Whether a browser Origin should be allowed through CORS. Kept here so the
 * CORS allow-list and the emailed-link allow-list cannot drift apart — the
 * tunnel exception applies to both, or to neither.
 */
function isAllowedCorsOrigin(origin) {
  const allowed = (process.env.CLIENT_URL || '').split(',').map((o) => o.trim()).filter(Boolean);
  if (allowed.includes(origin)) return true;
  return !isProduction() && isDevTunnelOrigin(origin);
}

module.exports = {
  DEV_TUNNEL_RE,
  isProduction,
  primaryClientUrl,
  isDevTunnelOrigin,
  emailLinkBase,
  isAllowedCorsOrigin,
};
