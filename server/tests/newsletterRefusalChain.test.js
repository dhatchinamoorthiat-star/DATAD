/**
 * H4, link 2 — a model refusal must stop the provider chain.
 *
 * In the Phase 2 run Groq refused the injected newsletter prompt:
 *
 *   [AI Runner] groq failed (bad_response, candidate 1/7): No JSON object found
 *   Raw: I'm sorry, but I can't help with that.
 *
 * The runner could not tell a refusal from a mangled response, so it advanced to
 * the next provider, and that one complied. Failover — the resilience feature —
 * became a brute-force search for the most permissive model in the chain.
 *
 * Real runner, real refusal detection, stubbed providers. The assertion that
 * matters is that the compliant provider is never called at all.
 */

const mockCalled = [];
let mockChain = [];

jest.mock('../ai/providers', () => ({
  getProviderChain: () => mockChain,
  getProvider: () => mockChain[0],
  buildProvider: () => {},
  clearCache: () => {},
}));

// run() reaches for the gateway first; this test is about the native chain.
jest.mock('../ai/aiGateway', () => ({
  isConfigured: () => false,
  processRequest: async () => { throw new Error('gateway off'); },
}));

const { run } = require('../ai/runner');
const { RefusalError } = require('../ai/refusal');
const circuitBreaker = require('../ai/runtime-v2/circuitBreaker');

const CLEAN = { subject: 'This week at DATAD', intro: 'A quiet week.', sections: {} };

function provider(name, behavior) {
  return {
    name,
    async complete() {
      mockCalled.push(name);
      if (behavior === 'refuse') return { text: "I'm sorry, but I can't help with that." };
      if (behavior === 'policy') throw Object.assign(new Error('content_policy violation'), { status: 400 });
      if (behavior === 'unavailable') throw Object.assign(new Error('unavailable'), { status: 503 });
      return { text: JSON.stringify(CLEAN) };
    },
  };
}

beforeEach(() => {
  mockCalled.length = 0;
  circuitBreaker.resetAll();
});

it('never reaches the compliant provider after the first one declines', async () => {
  mockChain = [provider('groq', 'refuse'), provider('nvidia', 'comply')];

  await expect(run({ system: 's', user: 'u', json: true })).rejects.toThrow(RefusalError);
  expect(mockCalled).toEqual(['groq']);
});

it('reports the refusal as terminal and as a decision, not a fault', async () => {
  mockChain = [provider('groq', 'refuse'), provider('nvidia', 'comply')];

  const err = await run({ system: 's', user: 'u', json: true }).catch((e) => e);
  expect(err).toBeInstanceOf(RefusalError);
  expect(err.terminal).toBe(true);
  expect(err.statusCode).toBe(422);
  expect(err.provider).toBe('groq');
});

it('treats a provider-side policy block the same way', async () => {
  mockChain = [provider('groq', 'policy'), provider('nvidia', 'comply')];

  await expect(run({ system: 's', user: 'u', json: true })).rejects.toThrow(RefusalError);
  expect(mockCalled).toEqual(['groq']);
});

it('does not bench a provider for declining', async () => {
  // Otherwise the breaker would, over time, promote whichever provider refuses
  // least — the same failure the chain fix removed, on a slower clock.
  mockChain = [provider('groq', 'refuse'), provider('nvidia', 'comply')];

  await run({ system: 's', user: 'u', json: true }).catch(() => {});
  expect(circuitBreaker.getState('groq').consecutiveFailureCount).toBe(0);
});

it('still fails over for a genuine outage', async () => {
  // The fix must not have cost the resilience it was carved out of.
  mockChain = [provider('groq', 'unavailable'), provider('nvidia', 'comply')];

  const { result } = await run({ system: 's', user: 'u', json: true });
  expect(result.subject).toBe('This week at DATAD');
  expect(mockCalled).toEqual(['groq', 'nvidia']);
});

it('still fails over for a malformed response', async () => {
  // A mangled answer is not an answer — this is the case the refusal was being
  // confused with, and it must keep its old behaviour.
  mockChain = [
    { name: 'groq', async complete() { mockCalled.push('groq'); return { text: 'not json at all, just prose' }; } },
    provider('nvidia', 'comply'),
  ];

  const { result } = await run({ system: 's', user: 'u', json: true });
  expect(result.subject).toBe('This week at DATAD');
  expect(mockCalled).toEqual(['groq', 'nvidia']);
});
