/**
 * Provider guard — the failover chain's memory between requests.
 *
 * No database: this is pure in-process logic, so it runs everywhere.
 */
process.env.AI_BREAKER_FAILURE_THRESHOLD = '3';
process.env.AI_BREAKER_RECOVERY_MS = '150';
process.env.AI_BREAKER_HALF_OPEN_CALLS = '2';

const guard = require('../ai/providerGuard');
const circuitBreaker = require('../ai/runtime-v2/circuitBreaker');

const httpError = (status) => Object.assign(new Error(`http ${status}`), { status });
const CHAIN = [{ name: 'groq' }, { name: 'nvidia' }, { name: 'gemini' }];
const names = (chain) => chain.map((p) => p.name);

beforeEach(() => circuitBreaker.resetAll());

describe('classifyError', () => {
  it('reads a rate limit as the provider being temporarily done', () => {
    expect(guard.classifyError(httpError(429))).toBe('rate_limited');
    expect(guard.classifyError({ response: { status: 429 } })).toBe('rate_limited');
  });

  it('treats a dead key or a provider-side 5xx as unavailability', () => {
    expect(guard.classifyError(httpError(401))).toBe('provider_unavailable');
    expect(guard.classifyError(httpError(403))).toBe('provider_unavailable');
    expect(guard.classifyError(httpError(503))).toBe('provider_unavailable');
  });

  it('separates our own malformed requests from provider faults', () => {
    // 400/404/422 fail identically on every provider — they must not be
    // attributed to the provider that happened to receive them.
    expect(guard.classifyError(httpError(400))).toBe('bad_request');
    expect(guard.classifyError(httpError(404))).toBe('bad_request');
    expect(guard.classifyError(httpError(422))).toBe('bad_request');
  });

  it('classifies transport failures without an HTTP status', () => {
    expect(guard.classifyError(Object.assign(new Error('x'), { code: 'ETIMEDOUT' }))).toBe('timeout');
    expect(guard.classifyError(new Error('request timed out'))).toBe('timeout');
    // A socket that never opened is a transport failure, distinct from "the
    // provider answered and said no". The remediation sprint required these to
    // be separable; both still count as provider faults for the breaker.
    expect(guard.classifyError(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })))
      .toBe('transport_error');
    expect(guard.isProviderFault('transport_error')).toBe(true);
  });

  it('never throws on a malformed error object', () => {
    expect(guard.classifyError(undefined)).toBe('provider_unavailable');
    expect(guard.classifyError(null)).toBe('provider_unavailable');
    expect(guard.classifyError({})).toBe('provider_unavailable');
  });
});

describe('filterChain', () => {
  it('leaves a healthy chain untouched', () => {
    expect(names(guard.filterChain(CHAIN).chain)).toEqual(['groq', 'nvidia', 'gemini']);
  });

  it('benches a provider that keeps rate-limiting, preserving order', () => {
    for (let i = 0; i < 3; i++) guard.recordFailure('groq', httpError(429));

    const { chain, skipped } = guard.filterChain(CHAIN);
    expect(names(chain)).toEqual(['nvidia', 'gemini']);
    expect(skipped).toEqual(['groq']);
  });

  it('does not bench a provider over our own malformed requests', () => {
    // Otherwise one bad model slug walks every breaker open and downs the hub.
    for (let i = 0; i < 10; i++) guard.recordFailure('nvidia', httpError(400));

    expect(circuitBreaker.getState('nvidia').currentState).toBe('closed');
    expect(names(guard.filterChain(CHAIN).chain)).toHaveLength(3);
  });

  it('fails open rather than returning an empty chain', () => {
    // A breaker that can manufacture "no provider available" out of a set of
    // configured providers is worse than the problem it solves.
    for (const p of CHAIN) for (let i = 0; i < 3; i++) guard.recordFailure(p.name, httpError(429));

    expect(names(guard.filterChain(CHAIN).chain)).toHaveLength(3);
  });

  it('resets a provider to healthy after a success', () => {
    guard.recordFailure('groq', httpError(429));
    guard.recordFailure('groq', httpError(429));
    guard.recordSuccess('groq', 120);
    guard.recordFailure('groq', httpError(429));

    // The success broke the streak, so this is failure 1 of 3, not 3 of 3.
    expect(circuitBreaker.getState('groq').currentState).toBe('closed');
  });
});

describe('recovery', () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  it('returns a benched provider to trial traffic, then to full duty', async () => {
    for (let i = 0; i < 3; i++) guard.recordFailure('groq', httpError(429));
    expect(names(guard.filterChain(CHAIN).chain)).not.toContain('groq');

    await sleep(200);

    expect(names(guard.filterChain(CHAIN).chain)).toContain('groq');
    expect(circuitBreaker.getState('groq').currentState).toBe('half_open');

    guard.recordSuccess('groq', 100);
    guard.recordSuccess('groq', 100);
    expect(circuitBreaker.getState('groq').currentState).toBe('closed');
  });

  it('re-benches a provider that fails its trial call', async () => {
    for (let i = 0; i < 3; i++) guard.recordFailure('groq', httpError(429));
    await sleep(200);

    guard.filterChain(CHAIN);                        // -> half_open
    guard.recordFailure('groq', httpError(429));     // trial fails

    expect(circuitBreaker.getState('groq').currentState).toBe('open');
  });
});
