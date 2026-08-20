/**
 * Durable breaker state.
 *
 * The Mongo-backed half cannot be proven without a database, so this covers
 * what CAN be verified offline: that persistence is optional, that transitions
 * are emitted exactly once, and that a remote bench is applied and expires.
 * The live-database behavior is still unproven — see tests marked with a note.
 */
process.env.AI_BREAKER_FAILURE_THRESHOLD = '3';
process.env.AI_BREAKER_RECOVERY_MS = '200';

const circuitBreaker = require('../ai/runtime-v2/circuitBreaker');
const providerHealthStore = require('../ai/providerHealthStore');
const guard = require('../ai/providerGuard');

const httpError = (status) => Object.assign(new Error(`http ${status}`), { status });

afterEach(() => {
  circuitBreaker.setTransitionListener(null);
  circuitBreaker.resetAll();
});

describe('transition events', () => {
  it('emits once per state change, not once per failure', () => {
    const seen = [];
    circuitBreaker.setTransitionListener((provider, change) => seen.push({ provider, ...change }));

    // Five failures, one crossing of the threshold.
    for (let i = 0; i < 5; i++) circuitBreaker.recordFailure('groq', 'rate_limited');

    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ provider: 'groq', state: 'open', previous: 'closed' });
  });

  it('carries the deadline other instances need, not just the label', () => {
    const seen = [];
    circuitBreaker.setTransitionListener((provider, change) => seen.push(change));
    for (let i = 0; i < 3; i++) circuitBreaker.recordFailure('groq', 'rate_limited');

    expect(seen[0].openUntil).toBeGreaterThan(Date.now());
  });

  it('reports recovery transitions too', () => {
    const seen = [];
    circuitBreaker.setTransitionListener((provider, change) => seen.push(change.state));

    for (let i = 0; i < 3; i++) circuitBreaker.recordFailure('groq', 'rate_limited');
    circuitBreaker.getState('groq');
    expect(seen).toEqual(['open']);
  });

  it('survives a listener that throws', () => {
    // A broken persistence layer must never break a provider call.
    circuitBreaker.setTransitionListener(() => { throw new Error('mongo exploded'); });

    expect(() => {
      for (let i = 0; i < 3; i++) circuitBreaker.recordFailure('groq', 'rate_limited');
    }).not.toThrow();
    expect(circuitBreaker.getState('groq').currentState).toBe('open');
  });
});

describe('remote benches', () => {
  it('benches a provider another instance benched', () => {
    expect(circuitBreaker.isAvailable('groq')).toBe(true);

    const applied = circuitBreaker.applyRemoteOpen('groq', new Date(Date.now() + 5000));

    expect(applied).toBe(true);
    expect(circuitBreaker.isAvailable('groq')).toBe(false);
    expect(guard.filterChain([{ name: 'groq' }, { name: 'nvidia' }]).chain.map((p) => p.name))
      .toEqual(['nvidia']);
  });

  it('ignores an already-expired bench', () => {
    // A row left by a crashed process must not bench a healthy provider.
    expect(circuitBreaker.applyRemoteOpen('groq', new Date(Date.now() - 1000))).toBe(false);
    expect(circuitBreaker.isAvailable('groq')).toBe(true);
  });

  it('expires a remote bench on schedule rather than holding it forever', async () => {
    circuitBreaker.applyRemoteOpen('groq', new Date(Date.now() + 100));
    expect(circuitBreaker.isAvailable('groq')).toBe(false);

    await new Promise((r) => setTimeout(r, 150));
    expect(circuitBreaker.isAvailable('groq')).toBe(true);   // half-open trial
  });

  it('does not echo a remote bench back as a local transition', () => {
    // Otherwise two instances write back what they just read, forever.
    const seen = [];
    circuitBreaker.setTransitionListener((p, c) => seen.push(c));

    circuitBreaker.applyRemoteOpen('groq', new Date(Date.now() + 5000));

    expect(seen).toHaveLength(0);
  });
});

describe('without a database', () => {
  it('degrades to in-memory behavior instead of throwing', async () => {
    // mongoose is not connected in this suite, which is the point.
    expect(providerHealthStore.status().connected).toBe(false);

    await expect(providerHealthStore.refresh()).resolves.toEqual([]);
    expect(() => providerHealthStore.start()).not.toThrow();

    // The breaker still works entirely on its own.
    for (let i = 0; i < 3; i++) guard.recordFailure('groq', httpError(429));
    expect(circuitBreaker.getState('groq').currentState).toBe('open');

    providerHealthStore.stop();
  });
});
