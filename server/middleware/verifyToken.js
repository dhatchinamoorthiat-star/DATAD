const jwt = require('jsonwebtoken');
const sessionVersion = require('../services/sessionVersion');
const deviceSessions = require('../services/deviceSessions');

/**
 * Authenticate a bearer token.
 *
 * A valid signature is necessary but not sufficient. The token lasts 7 days and
 * carries `role`, so it is also checked against the account's current session
 * version — see services/sessionVersion.js for why. That same lookup supplies
 * the live `role` and `status`, so a demoted admin loses admin routes on their
 * next request rather than whenever their token happens to expire.
 */
const verifyToken = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  let payload;
  try {
    payload = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  try {
    const session = await sessionVersion.get(payload.userId);

    // Account deleted (or the id is bogus) — the signature is still valid, so
    // this is the only thing standing between a deleted user and their data.
    if (!session) {
      return res.status(401).json({ message: 'Session is no longer valid' });
    }

    // Tokens minted before the current version were revoked by a password
    // change, reset, or role change. `tv` is absent on tokens issued before
    // this check existed; those read as 0 and stay valid until the first bump.
    if ((payload.tv || 0) !== session.tokenVersion) {
      return res.status(401).json({ message: 'Session is no longer valid' });
    }

    // Every token must name the device it was issued to.
    //
    // This used to be `if (payload.did && …)`, allowing tokens that predated
    // device sessions through unchecked. But `did` comes from a client-supplied
    // header, so that branch was reachable on demand: sign in without
    // `x-device-id` and the resulting token was never bound to a device, never
    // evicted by the cap, and never listed in "Your devices" — so the student
    // could not revoke it either. A control that an attacker can switch off is
    // not a control. signToken now always sets `did` (see deviceFromRequest),
    // so a token without one is either from before this change or was minted by
    // omitting the header; both must sign in again.
    if (!payload.did) {
      return res.status(401).json({
        message: 'Please sign in again to continue.',
        code: 'SESSION_UPGRADE_REQUIRED',
      });
    }

    // The device that this token was issued to must still hold a session.
    // Signing in on a fourth device evicts the least recently used one, and
    // that device lands here on its next request.
    // The owner account (ADMIN_EMAIL) is exempt — see deviceSessions.isExempt.
    if (
      !deviceSessions.isExempt(session.email) &&
      !deviceSessions.isActive(session.sessions, payload.did)
    ) {
      // `maxDevices` rides along so the client can name the limit without
      // hardcoding a number that only this module actually knows — it is
      // configurable via MAX_DEVICES_PER_USER, and a client-side copy of it
      // would quietly start lying the moment that env var is set.
      return res.status(401).json({
        message: 'Signed out because this account was used on another device.',
        code: 'DEVICE_REVOKED',
        maxDevices: deviceSessions.MAX_DEVICES,
      });
    }

    // Fire-and-forget, throttled to at most one write per device per 15 min.
    deviceSessions.touch(payload.userId, payload.did);

    // Claims win for identity, database wins for authority.
    req.user = { ...payload, role: session.role, status: session.status, deviceId: payload.did };
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = verifyToken;
