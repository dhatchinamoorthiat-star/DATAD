const cfg = require('../../config/automation');

const STATE = {
  CLOSED: 'closed',
  OPEN: 'open',
  HALF_OPEN: 'half_open',
};

const state = {};

/**
 * Optional observer, notified whenever a provider changes breaker state.
 *
 * Kept as a single nullable callback rather than an event emitter because
 * there is exactly one consumer (ai/providerHealthStore.js) and the breaker
 * must stay usable — and synchronous — with no consumer attached at all.
 * Persistence is a side effect of this module, never a dependency of it.
 */
let _onTransition = null;

function setTransitionListener(fn) {
  _onTransition = typeof fn === 'function' ? fn : null;
}

function _transition(provider, s, next) {
  const previous = s.currentState;
  if (previous === next) return;

  s.currentState = next;
  s.lastStateChange = Date.now();

  if (!_onTransition) return;
  try {
    _onTransition(provider, {
      state: next,
      previous,
      consecutiveFailures: s.consecutiveFailureCount,
      lastFailureTime: s.lastFailureTime,
      // When trial traffic is allowed again. The persisted copy is acted on
      // by other instances, so it needs the deadline, not just the label.
      openUntil: next === STATE.OPEN ? s.lastStateChange + s.recoveryTimeout : null,
    });
  } catch (err) {
    // A failing listener must never break a provider call.
    console.warn(`[circuitBreaker] transition listener failed for ${provider}: ${err.message}`);
  }
}

function _init(provider) {
  if (!state[provider]) {
    // config/automation.js has no circuitBreaker block, so until it gains one
    // these fall through to env vars and then to defaults. The defaults are
    // tuned for the free-tier failover chain: 3 consecutive provider faults is
    // enough to conclude a provider is rate-limited or down, and waiting for 5
    // means ~2 extra wasted round-trips per user before the chain reroutes.
    const failureThreshold =
      cfg.circuitBreaker?.failureThreshold || parseInt(process.env.AI_BREAKER_FAILURE_THRESHOLD || '3', 10);
    const recoveryTimeout =
      cfg.circuitBreaker?.recoveryTimeout || parseInt(process.env.AI_BREAKER_RECOVERY_MS || '60000', 10);
    const halfOpenMaxCalls =
      cfg.circuitBreaker?.halfOpenMaxCalls || parseInt(process.env.AI_BREAKER_HALF_OPEN_CALLS || '2', 10);

    state[provider] = {
      currentState: STATE.CLOSED,
      failureCount: 0,
      successCount: 0,
      consecutiveFailureCount: 0,
      lastFailureTime: null,
      halfOpenCalls: 0,
      failureThreshold,
      recoveryTimeout,
      halfOpenMaxCalls,
      lastStateChange: Date.now(),
    };
  }
  return state[provider];
}

function isAvailable(provider) {
  const s = _init(provider);

  switch (s.currentState) {
    case STATE.CLOSED:
      return true;
    case STATE.OPEN:
      if (Date.now() - s.lastStateChange >= s.recoveryTimeout) {
        s.halfOpenCalls = 0;
        _transition(provider, s, STATE.HALF_OPEN);
        return true;
      }
      return false;
    case STATE.HALF_OPEN:
      return s.halfOpenCalls < s.halfOpenMaxCalls;
    default:
      return true;
  }
}

function recordSuccess(provider) {
  const s = _init(provider);
  s.successCount++;
  s.consecutiveFailureCount = 0;

  if (s.currentState === STATE.HALF_OPEN) {
    s.halfOpenCalls++;
    if (s.halfOpenCalls >= s.halfOpenMaxCalls) {
      s.failureCount = 0;
      _transition(provider, s, STATE.CLOSED);
    }
  }
}

function recordFailure(provider, errorType) {
  const s = _init(provider);

  if (errorType === 'provider_unavailable' || errorType === 'rate_limited') {
    s.consecutiveFailureCount++;
    s.failureCount++;

    s.lastFailureTime = Date.now();

    if (s.currentState === STATE.HALF_OPEN || (s.currentState === STATE.CLOSED && s.consecutiveFailureCount >= s.failureThreshold)) {
      _transition(provider, s, STATE.OPEN);
    }
  }
}

/**
 * Bench a provider because ANOTHER instance benched it.
 *
 * Applied without emitting a transition — otherwise the persistence layer
 * would write back what it just read, and two instances would ping-pong.
 * Only ever extends a bench; it will not close a breaker this process opened
 * on evidence of its own. See providerHealthStore for why open wins.
 */
function applyRemoteOpen(provider, openUntil) {
  const s = _init(provider);
  const remaining = new Date(openUntil).getTime() - Date.now();
  if (remaining <= 0) return false;
  if (s.currentState === STATE.OPEN) return false;

  s.currentState = STATE.OPEN;
  // Back-date the change so the existing recoveryTimeout arithmetic in
  // isAvailable() expires this bench exactly when the remote one expires.
  s.lastStateChange = Date.now() - Math.max(0, s.recoveryTimeout - remaining);
  return true;
}

function getState(provider) {
  const s = _init(provider);
  return { ...s };
}

function reset(provider) {
  if (state[provider]) {
    delete state[provider];
  }
}

function resetAll() {
  for (const p of Object.keys(state)) {
    delete state[p];
  }
}

module.exports = {
  STATE,
  setTransitionListener,
  applyRemoteOpen,
  isAvailable,
  recordSuccess,
  recordFailure,
  getState,
  reset,
  resetAll,
};
