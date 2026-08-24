/**
 * Content Security Policy.
 *
 * The header was off entirely, with this justification:
 *
 *   // The SPA is served from this same server; the app loads cover images from
 *   // external hosts (Unsplash, Google Photos), so a strict default CSP would
 *   // break them.
 *
 * The observation is correct and the conclusion does not follow. Helmet's
 * default policy sets `img-src 'self'`, which does break external cover images.
 * The fix for that is one directive — `img-src` — not turning off the other
 * eleven. Disabling the whole policy to allow an image is the security
 * equivalent of removing a door because one key does not fit.
 *
 * WHY IT MATTERS HERE SPECIFICALLY
 *
 * The carried-forward findings list "CSP disabled" and "JWT in localStorage" as
 * two items. They are one item. A token in localStorage is readable by any
 * script running on the origin, so its entire defence against theft is that no
 * attacker-controlled script ever runs — and CSP is the control that makes that
 * true even when an XSS hole exists. With CSP off, a single injection anywhere
 * in the SPA reads the token and the session is gone; there is no second layer.
 * `script-src 'self'` is that second layer, and it is much cheaper than
 * migrating the whole auth architecture to httpOnly cookies mid-sprint.
 *
 * ROLLOUT
 *
 * A CSP that breaks the app is worse than none, because the next person will
 * turn it off again and this comment will be why. So `CSP_REPORT_ONLY=true`
 * emits `Content-Security-Policy-Report-Only`: violations are reported and
 * nothing is blocked. Run there first, read the reports, then enforce.
 */

/**
 * Hosts the app legitimately reaches.
 *
 * Images are the permissive one, and deliberately so: students paste cover
 * images from wherever they found them, and `img-src https:` cannot be used to
 * execute anything. Scripts are the restrictive one, because scripts are the
 * whole point of the policy.
 */
function directives() {
  const connect = new Set(["'self'"]);

  // Razorpay Checkout. The script is injected at checkout time by
  // client/src/utils/razorpay.js, it renders itself inside an api.razorpay.com
  // iframe, it beacons telemetry to lumberjack.razorpay.com, and a card or
  // netbanking payment POSTs the user off to their bank. Each of those is a
  // different directive, and missing any one of them fails the payment at a
  // different, more confusing point than the last — so they are listed
  // together here rather than scattered through the policy below.
  const RAZORPAY_SCRIPT = 'https://checkout.razorpay.com';
  const RAZORPAY_FRAME = ['https://api.razorpay.com', 'https://checkout.razorpay.com'];
  connect.add('https://api.razorpay.com');
  connect.add('https://lumberjack.razorpay.com');
  connect.add('https://lumberjack-cx.razorpay.com');

  // The API origin, when the SPA is served from somewhere else (Vercel client,
  // Render server). Without this, every fetch is blocked in production and
  // nothing works — the single most likely way this policy breaks the app.
  for (const url of [process.env.CLIENT_URL, process.env.API_URL, process.env.VITE_API_URL]) {
    for (const entry of String(url || '').split(',').map((s) => s.trim()).filter(Boolean)) {
      try { connect.add(new URL(entry).origin); } catch { /* not a URL — skip */ }
    }
  }

  // Error tracking and its session replay, when configured.
  if (process.env.SENTRY_DSN || process.env.VITE_SENTRY_DSN) {
    connect.add('https://*.ingest.sentry.io');
    connect.add('https://*.sentry.io');
  }

  // Server-Sent Events run over the same origin as the API, already covered.
  // Local development: Vite's dev server and its HMR websocket.
  if (process.env.NODE_ENV !== 'production') {
    connect.add('ws://localhost:*');
    connect.add('http://localhost:*');
  }

  return {
    defaultSrc: ["'self'"],

    // The directive that carries the weight. No 'unsafe-inline' and no
    // 'unsafe-eval': a production Vite build needs neither, and adding either
    // one back would defeat the purpose — 'unsafe-inline' in script-src makes
    // the policy approximately decorative against reflected XSS.
    scriptSrc: ["'self'", RAZORPAY_SCRIPT],
    scriptSrcAttr: ["'none'"], // no onclick="..." handlers, ever

    // 'unsafe-inline' here is a real concession and is worth naming. Tailwind
    // and the animation code both set inline `style` attributes, and the CSS
    // alternative (a nonce or hash per style) is not achievable without
    // reworking the styling approach. Inline *styles* cannot execute script;
    // the residual risk is CSS-based data exfiltration, which is exotic and far
    // below the risk of the app not rendering.
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],

    // The reason the policy was switched off. `data:` and `blob:` cover avatar
    // previews and generated canvases before upload.
    imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
    mediaSrc: ["'self'", 'data:', 'blob:', 'https:'],

    connectSrc: [...connect],

    // Nothing here embeds a plugin or a frame, and both are classic ways to
    // smuggle in an execution context.
    objectSrc: ["'none'"],
    frameSrc: RAZORPAY_FRAME,
    // Clickjacking. Stronger than X-Frame-Options and understood more widely.
    frameAncestors: ["'none'"],

    // Stops an injected <base> tag repointing every relative script URL at an
    // attacker's host — a bypass that works against script-src 'self'.
    baseUri: ["'self'"],
    // A form posting a student's session or profile data off-origin. Razorpay
    // is the one allowed destination: card and netbanking flows submit to the
    // gateway, which then redirects to the bank's own 3-D Secure page.
    formAction: ["'self'", 'https://api.razorpay.com'],

    workerSrc: ["'self'", 'blob:'], // the service worker in client/public/sw.js
    manifestSrc: ["'self'"],

    ...(process.env.CSP_REPORT_URI ? { reportUri: [process.env.CSP_REPORT_URI] } : {}),
    // Only in production: in development the app is served over plain http on
    // localhost, and this directive would rewrite those requests to https.
    ...(process.env.NODE_ENV === 'production' ? { upgradeInsecureRequests: [] } : {}),
  };
}

/** The object helmet's `contentSecurityPolicy` option expects. */
function cspOptions() {
  return {
    useDefaults: false, // the directives above are the complete policy
    directives: directives(),
    reportOnly: String(process.env.CSP_REPORT_ONLY || '').toLowerCase() === 'true',
  };
}

module.exports = { cspOptions, directives };
