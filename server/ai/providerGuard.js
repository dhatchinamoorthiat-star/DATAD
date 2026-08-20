/**
 * Provider guard — the memory between requests in the failover chain.
 *
 * getProviderChain() (ai/providers/index.js) returns every provider that has a
 * key configured, in a fixed preference order. That ordering is static: it has
 * no idea that the provider at the front of the chain returned 429 four times
 * in the last minute. So on free tiers, where quota exhaustion is routine
 * rather than exceptional, every single request paid a full round-trip to a
 * provider we already knew was rate-limited before falling through to one that
 * works — and then the next request did it again.
 *
 * This module is the missing feedback path. `circuitBreaker` (open/closed
 * state per provider) and `providerHealthEngine` (rolling success rate,
 * latency, rate-limit counts) both already existed; the breaker was called
 * only from a dormant code path and the health engine was written to by
 * nobody, read only by the /observability route. Both are wired here, behind
 * one interface, so the live chain loops in aiGateway and runner can filter
 * out benched providers before calling them and report what happened after.
 *
 * State is in-process and dies on restart. That is a real limitation — see
 * the note on filterChain() — but it is strictly better than no memory at all.
 */

const circuitBreaker = require('./runtime-v2/circuitBreaker');
const providerHealthEngine = require('./runtime-v2/providerHealthEngine');
const providerHealthStore = require('./providerHealthStore');

/**
 * Classify a provider error into the vocabulary the breaker understands.
 *
 * The distinction that matters is whether trying a DIFFERENT provider would
 * plausibly help, and whether this provider deserves to be benched:
 *
 *   rate_limited         quota/throttle — this provider is temporarily done,
 *                        another one will work. The case free tiers live in.
 *   provider_unavailable dead key, provider-side 5xx, connection refused —
 *                        benching is correct, another provider will work.
 *   bad_request          400/404/422: malformed request, unknown model slug.
 *                        Our fault, not theirs. It will fail identically on
 *                        every provider, so it must NOT trip the breaker —
 *                        otherwise one bad model id in a request walks the
 *                        whole chain open and takes the entire hub down.
 *   timeout              no status, aborted or timed out mid-flight.
 *
 * This is the "real transient-vs-hard classification" that ai/runner.js flags
 * as future work in its own header comment.
 */
function classifyError(err) {
  const status = err?.status ?? err?.response?.status ?? err?.statusCode;

  if (status === 429) return 'rate_limited';
  if (status === 401 || status === 403) return 'provider_unavailable';
  if (status >= 500) return 'provider_unavailable';
  if (status === 400 || status === 404 || status === 422) return 'bad_request';

  if (status) return 'provider_unavailable';

  // No HTTP status at all: network layer, abort, or idle-timeout.
  const code = err?.code || '';
  const msg = String(err?.message || '').toLowerCase();
  if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT' || msg.includes('timeout') || msg.includes('timed out')) {
    return 'timeout';
  }
  return 'provider_unavailable';
}

/** Errors that say something about the provider's health, rather than ours. */
function isProviderFault(kind) {
  return kind === 'rate_limited' || kind === 'provider_unavailable' || kind === 'timeout';
}

/**
 * Drop providers whose breaker is open, preserving chain order.
 *
 * Deliberately fails OPEN: if every provider is benched, the full chain is
 * returned unchanged rather than an empty list. A breaker that can produce
 * "no AI provider available" out of a set of configured, keyed providers is
 * worse than the problem it solves — a shared outage, or a bug in the
 * classifier above, would take the product down rather than degrade it. In
 * that state we try anyway and let the calls decide.
 *
 * Note that circuitBreaker.isAvailable() is not a pure read: on an OPEN
 * breaker past its recovery timeout it transitions to HALF_OPEN and returns
 * true, which is how a benched provider gets its trial traffic back. So this
 * must be called once per request, not speculatively.
 *
 * @returns {{ chain: object[], skipped: string[] }}
 */
function filterChain(chain) {
  // Idempotent and non-blocking; see providerHealthStore.start() for why this
  // is triggered from the request path rather than from server startup.
  providerHealthStore.start();

  const skipped = [];
  const usable = chain.filter((p) => {
    if (circuitBreaker.isAvailable(p.name)) return true;
    skipped.push(p.name);
    return false;
  });

  if (!usable.length) {
    if (skipped.length) {
      console.warn(
        `[providerGuard] every provider is circuit-open (${skipped.join(', ')}) — ignoring the breaker for this request rather than failing hard`
      );
    }
    return { chain, skipped: [] };
  }

  if (skipped.length) {
    console.warn(`[providerGuard] skipping circuit-open provider(s): ${skipped.join(', ')}`);
  }
  return { chain: usable, skipped };
}

/** Record a completed provider call. Never throws — telemetry must not break a turn. */
function recordSuccess(providerName, latencyMs = 0) {
  try {
    circuitBreaker.recordSuccess(providerName);
    providerHealthEngine.recordSuccess({ provider: providerName, latencyMs, costUsd: 0 });
  } catch (e) {
    console.warn(`[providerGuard] recordSuccess failed for ${providerName}: ${e.message}`);
  }
}

/**
 * Record a failed provider call.
 * @returns {string} the classification, so callers can branch on it.
 */
function recordFailure(providerName, err, latencyMs = 0) {
  const kind = classifyError(err);
  try {
    if (isProviderFault(kind)) {
      // The breaker only acts on these two labels (see circuitBreaker.recordFailure);
      // a timeout is a provider-availability problem as far as it is concerned.
      circuitBreaker.recordFailure(
        providerName,
        kind === 'rate_limited' ? 'rate_limited' : 'provider_unavailable'
      );
    }
    // The health engine keys rate limits and timeouts separately for scoring.
    providerHealthEngine.recordFailure({
      provider: providerName,
      errorType: kind === 'rate_limited' ? 'rate_limit' : kind,
      latencyMs,
    });
  } catch (e) {
    console.warn(`[providerGuard] recordFailure failed for ${providerName}: ${e.message}`);
  }
  return kind;
}

module.exports = {
  classifyError,
  isProviderFault,
  filterChain,
  recordSuccess,
  recordFailure,
};
