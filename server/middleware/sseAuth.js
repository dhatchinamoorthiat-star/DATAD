const verifyToken = require('./verifyToken');

/**
 * Authenticate an EventSource connection.
 *
 * EventSource cannot set request headers, so the notification stream has to
 * accept its token as a query parameter. The previous version of this handled
 * that by verifying the token itself:
 *
 *     const decoded = jwt.verify(token, process.env.JWT_SECRET);
 *     req.user = decoded;
 *     next();
 *
 * A valid signature is not sufficient, and that is the whole reason
 * services/sessionVersion.js exists. Everything verifyToken does after the
 * signature — comparing the token's session version, confirming the account
 * still exists, checking the device still holds a session, and taking `role`
 * and `status` from the database rather than the claims — was skipped here.
 * The practical effect: a password reset, the thing a student does precisely
 * because they think someone has their credentials, did not disconnect that
 * someone from their live notification stream, and would not for the token's
 * remaining seven days.
 *
 * So this no longer verifies anything. It moves the query parameter into the
 * header slot and hands off to the one middleware that knows all the rules, so
 * the two paths cannot drift apart again.
 *
 * NOTE: a token in a query string is written to access logs, proxy logs and
 * browser history by anything that records URLs. The Beacon/EventSource APIs
 * leave no alternative for this route, so it is accepted here deliberately —
 * but it is a reason to keep token lifetimes short and to scrub `token` from
 * request logging, not a pattern to copy onto routes that have a choice.
 */
function sseAuth(req, res, next) {
  if (!req.headers.authorization && req.query?.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  return verifyToken(req, res, next);
}

module.exports = sseAuth;
