const crypto = require('crypto');

/**
 * The token in an emailed "Approve" link.
 *
 * This link is a capability handed to whoever opens the admin's inbox, so it is
 * built the same way a session token is: signed with JWT_SECRET, never stored,
 * never guessable. It is deliberately *not* a random value persisted on the
 * user — an HMAC over facts already on the document needs no schema change and
 * no cleanup, and it self-invalidates for free:
 *
 *   - `createdAt` is in the signed payload, so a deleted-and-re-registered
 *     account does not honour the old mail's link;
 *   - the handler refuses anything whose status is no longer `pending`, so the
 *     link stops working the moment the account is approved by any route. That
 *     is what makes it single-use in practice.
 *
 * Comparison is constant-time. A timing-leaky compare on a 32-byte HMAC is not
 * a realistic attack over the network, but there is no reason to hand-roll the
 * weaker version when timingSafeEqual is one call.
 */

const secret = () => {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error('JWT_SECRET is required to sign approval links');
  return value;
};

const payload = (user) => `approve:${String(user._id)}:${new Date(user.createdAt || 0).getTime()}`;

function mintApprovalToken(user) {
  return crypto.createHmac('sha256', secret()).update(payload(user)).digest('base64url');
}

function approvalTokenMatches(user, token) {
  const expected = Buffer.from(mintApprovalToken(user));
  const given = Buffer.from(String(token || ''));
  if (expected.length !== given.length) return false;
  return crypto.timingSafeEqual(expected, given);
}

module.exports = { mintApprovalToken, approvalTokenMatches };
