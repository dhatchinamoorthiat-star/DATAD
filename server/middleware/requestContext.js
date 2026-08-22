const logger = require('../utils/logger');

/**
 * Give every request a correlation id and make it visible from both ends.
 *
 * The id is echoed back as `X-Request-Id` so a user (or a support ticket, or a
 * failing frontend request in the network tab) can quote the exact identifier
 * that appears on every server log line for that request. Without it, matching
 * a report of "it failed around 3pm" to the logs means guessing.
 *
 * An inbound X-Request-Id is honoured so a trace started by a proxy or the
 * client survives into our logs, but only when it looks like an id: it is
 * echoed into a response header and every log line, so an unbounded
 * client-controlled string would be both a log-injection and a
 * header-injection vector. Anything else is replaced with a fresh one.
 */
const INBOUND_ID = /^[A-Za-z0-9._-]{1,128}$/;

function requestContext(req, res, next) {
  const inbound = req.get('x-request-id');
  const requestId = inbound && INBOUND_ID.test(inbound) ? inbound : logger.newRequestId();

  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);

  // Everything downstream of here — controllers, services, the error handler —
  // logs inside this context, so the id is attached without any of them
  // having to pass it around.
  logger.runWithRequestId(requestId, next);
}

module.exports = requestContext;
