const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

/**
 * Every limit in one place, and exported, so the numbers are assertable in
 * tests — express-rate-limit does not expose its configuration on the
 * middleware it returns.
 */
const LIMITS = {
  general: { windowMinutes: 15, max: 1000 },
  authNetwork: { windowMinutes: 15, max: 300 },
  loginAccount: { windowMinutes: 15, max: 10 },
  heavy: { windowMinutes: 15, max: 40 },
};

const make = (windowMinutes, max, message, extra = {}) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message },
    ...extra,
  });

/**
 * Key a general API request by the account making it, falling back to the
 * network address only when the request carries no usable token.
 *
 * This is the same correction already applied to sign-in below, for the same
 * reason. Keyed on IP, this limit had exactly the property that made the old
 * 20-per-15-minutes login limit unusable: a campus reaches the internet through
 * a handful of NAT addresses, so one ceiling was shared by every student behind
 * it. The numbers make that concrete — a single dashboard load fires roughly 15
 * requests, so 1000 per 15 minutes is about 66 page loads for an entire campus,
 * after which everyone on that Wi-Fi gets 429s that are indistinguishable from
 * an outage. Students on mobile data are unaffected, which makes it present as
 * intermittent and user-specific rather than as the shared limit it is.
 *
 * Per account, 1000 per 15 minutes is ~66 page loads for one student, which no
 * legitimate session approaches.
 *
 * The signature is verified rather than merely decoded. A decoded-only key
 * would let anyone mint a token with an arbitrary `userId` and get a fresh
 * quota per request, which is worse than keying on IP rather than better. An
 * invalid or absent token falls through to the address, so unauthenticated
 * traffic is still bounded.
 */
const generalKey = (req) => {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const { userId } = jwt.verify(header.slice(7), process.env.JWT_SECRET);
      if (userId) return `user:${userId}`;
    } catch {
      // Unverifiable token — fall through and key on the address.
    }
  }
  // ipKeyGenerator normalises IPv6 down to a /64 subnet key.
  return `ip:${rateLimit.ipKeyGenerator(req.ip)}`;
};

// Generous ceiling across the whole API — just anti-abuse, not felt in normal use.
const generalLimiter = make(
  LIMITS.general.windowMinutes,
  LIMITS.general.max,
  'Too many requests, please slow down and try again shortly',
  { keyGenerator: generalKey }
);

/**
 * Per-IP ceiling on the unauthenticated endpoints.
 *
 * This used to be 20 per 15 minutes, which is a sensible number for one person
 * and a broken one for this audience: a college campus reaches the internet
 * through a handful of NAT addresses, so the whole cohort shared 20 attempts.
 * On an orientation-day rollout the 21st student to try logging in would be
 * told "Too many attempts" — indistinguishable from an outage, and triggered
 * by entirely legitimate use.
 *
 * Brute-force protection now lives in loginAccountLimiter below, keyed on the
 * account rather than the network. This stays as a scripted-abuse ceiling, set
 * high enough that a shared egress IP will not reach it in normal use.
 */
const authLimiter = make(
  LIMITS.authNetwork.windowMinutes,
  LIMITS.authNetwork.max,
  'Too many attempts from this network, please try again later'
);

/**
 * Key a login attempt by the account being targeted, falling back to the IP
 * when the request names no account.
 */
const loginAccountKey = (req) => {
  const email = String(req.body?.email || '').toLowerCase().trim();
  // ipKeyGenerator normalises IPv6 down to a /64 subnet key.
  return email || `ip:${rateLimit.ipKeyGenerator(req.ip)}`;
};

/**
 * Brute-force protection, keyed on the targeted account.
 *
 * Guessing one account's password is bounded to 10 tries per 15 minutes no
 * matter how many IPs the attacker has, which is the property the IP limiter
 * never actually provided. Keying on the email also means one student
 * fat-fingering their password cannot lock out anyone else on their campus.
 *
 * Applied to /login only. Deliberately NOT applied to the recovery endpoints:
 * an account-keyed limit there would let anyone lock a victim out of password
 * reset and verification resend by exhausting the quota on their behalf. Those
 * keep the IP limiter, and resend has its own per-account send cooldown.
 */
const loginAccountLimiter = make(
  LIMITS.loginAccount.windowMinutes,
  LIMITS.loginAccount.max,
  'Too many sign-in attempts for this account, please try again in a few minutes',
  {
    keyGenerator: loginAccountKey,
    // A successful sign-in should not consume the account's budget — otherwise
    // a shared lab machine legitimately used by many students in one period
    // trips a limiter meant for guessing.
    skipSuccessfulRequests: true,
  }
);

// Expensive operations: file uploads and fan-out emails.
const heavyLimiter = make(
  LIMITS.heavy.windowMinutes,
  LIMITS.heavy.max,
  'Too many uploads or sends, please try again later'
);

module.exports = {
  generalLimiter,
  authLimiter,
  loginAccountLimiter,
  heavyLimiter,
  // Exported for tests: the middleware itself hides its configuration.
  loginAccountKey,
  generalKey,
  LIMITS,
};
