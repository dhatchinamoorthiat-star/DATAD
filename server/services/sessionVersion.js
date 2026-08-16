/**
 * Session validity for stateless JWTs (P1-1).
 *
 * The tokens are self-contained and last 7 days, and they carry `role` and
 * `tier` as claims. verifyToken previously did `jwt.verify` and nothing else,
 * which meant nothing could be taken back for up to a week:
 *
 *   - a password reset did not evict whoever stole the password, so the
 *     recovery flow did not actually recover the account;
 *   - a demoted admin kept every admin route, because checkRole reads the
 *     claim, not the database;
 *   - a deleted account's token still authenticated.
 *
 * Each user carries a `tokenVersion`; it is signed into the token and compared
 * on every request. Bumping it invalidates every token issued before the bump.
 *
 * Reading the user on every request would add a query to every authenticated
 * call, so versions are cached for a short TTL. bump() deletes the cache entry
 * as it writes, so revocation inside this process is immediate rather than
 * TTL-bounded — which is exact at the single instance render.yaml pins. If the
 * service is ever scaled out, a peer's cache can lag by up to the TTL; that is
 * a 60-second revocation window instead of a 7-day one, and the fix at that
 * point is a shared cache, not a longer comment.
 */

const User = require('../models/User');

const TTL_MS = Number(process.env.SESSION_VERSION_TTL_MS) || 60_000;
// Bounds memory on a large user base; entries are cheap to rebuild.
const MAX_ENTRIES = Number(process.env.SESSION_VERSION_CACHE_MAX) || 10_000;

/** @type {Map<string, {record: {tokenVersion:number, role:string, status:string}|null, exp:number}>} */
const cache = new Map();

/**
 * Current session record for a user, or null if the account no longer exists.
 * `role` and `status` ride along because we are already reading the document —
 * that is what makes the stale-role problem go away rather than just the
 * stale-password one.
 */
async function get(userId) {
  const key = String(userId);
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.record;

  const doc = await User.findById(key).select('tokenVersion role status sessions email').lean();
  const record = doc
    ? {
        // Accounts predating this field have no value; treat it as 0 so a
        // deploy does not log every existing user out. They become revocable
        // from their next credential change onward.
        tokenVersion: doc.tokenVersion || 0,
        role: doc.role || 'member',
        status: doc.status || 'approved',
        // Read here so the device check costs no extra query.
        sessions: doc.sessions || [],
        email: doc.email || '',
      }
    : null;

  if (cache.size >= MAX_ENTRIES) cache.clear();
  cache.set(key, { record, exp: Date.now() + TTL_MS });
  return record;
}

/**
 * Invalidate every token issued for this user so far.
 * Call after a password change, a password reset, or a role/status change.
 */
async function bump(userId) {
  const key = String(userId);
  cache.delete(key); // drop first: a concurrent read must not repopulate a stale value
  await User.updateOne({ _id: key }, { $inc: { tokenVersion: 1 } });
  cache.delete(key);
}

/** Drop a cached entry without bumping — used after a role/status write. */
function invalidate(userId) {
  cache.delete(String(userId));
}

/** Test seam. */
function _reset() {
  cache.clear();
}

module.exports = { get, bump, invalidate, _reset, TTL_MS };
