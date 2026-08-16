/**
 * Transaction helper for multi-document mutations (audit H2).
 *
 * Runs `work(session)` inside a MongoDB transaction so a partial failure rolls
 * back the whole aggregate. Degrades gracefully: if the connected server has no
 * replica set (transactions unsupported), it re-runs `work(null)` WITHOUT a
 * transaction and logs once.
 *
 * ── Documented degradation behaviour ────────────────────────────────────────
 * On a standalone mongod, cross-document atomicity is lost, BUT the per-document
 * compare-and-swap updates the callers use (atomic $inc slot claim, atomic
 * status claim) still hold individually — so the C1 guarantees (no double
 * accept, no slot oversubscription, no duplicate engagement via the unique
 * index) survive. Only the all-or-nothing rollback across the 2–3 documents is
 * forfeited. Production MUST run a replica set to get full H2 guarantees.
 *
 * On a replica set the first attempt aborts cleanly on any thrown error and
 * nothing is committed, so the fallback re-run never sees partial state.
 */

const mongoose = require('mongoose');
const logger = require('../../utils/logger');

let warnedNoTxn = false;

function isTxnUnsupported(err) {
  if (!err) return false;
  const msg = String(err.message || '');
  return (
    err.code === 20 || // IllegalOperation
    err.codeName === 'IllegalOperation' ||
    /Transaction numbers are only allowed on a replica set/i.test(msg) ||
    /Transactions are not supported/i.test(msg) ||
    /This MongoDB deployment does not support retryable writes/i.test(msg)
  );
}

async function withTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (err) {
    if (isTxnUnsupported(err)) {
      if (!warnedNoTxn) {
        warnedNoTxn = true;
        logger.warn('[talent/tx] server has no transaction support — running multi-doc writes non-transactionally. Run a replica set in production.');
      }
      return work(null);
    }
    throw err;
  } finally {
    session.endSession();
  }
}

module.exports = { withTransaction, isTxnUnsupported };
