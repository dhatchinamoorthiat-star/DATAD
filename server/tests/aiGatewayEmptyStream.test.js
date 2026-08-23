/**
 * An empty stream must fail over even with the hold window switched off.
 *
 * `aiGatewayFailover.test.js` covers the same property at the default
 * DAX_STREAM_HOLD_CHARS=200. This file exists because the bug was only
 * reachable at 0 — and 0 is what server/.env ships, so the configuration that
 * was never covered is the one that actually runs in production.
 *
 * `streamEnded` used to be assigned only inside the hold loop, and at 0 that
 * loop never executed: the empty-stream check was unreachable, a provider that
 * yielded nothing was recorded as a success, and the student received "".
 *
 * Set before requiring the gateway — HOLD_CHARS is read once at module load.
 */
process.env.DAX_STREAM_HOLD_CHARS = '0';
process.env.DAX_STREAM_HOLD_MS = '0';
process.env.AI_BREAKER_FAILURE_THRESHOLD = '3';

const called = [];

function stubProvider(name, behavior) {
  return {
    name,
    async *completeStream() {
      called.push(name);
      if (behavior === 'empty') return;
      yield `hello from ${name}`;
    },
  };
}

let mockChain = [];
jest.mock('../ai/providers', () => ({
  getProviderChain: () => mockChain,
  getProvider: () => mockChain[0],
  buildProvider: () => {},
  clearCache: () => {},
}));
jest.mock('../ai/intelligence-layer', () => ({ buildStudentProfile: async () => null }));
jest.mock('../ai/usageMeter', () => ({ chargeCredits: async () => {}, checkAndNotifyCredits: async () => {} }));

const gateway = require('../ai/aiGateway');
const circuitBreaker = require('../ai/runtime-v2/circuitBreaker');

async function ask() {
  let out = '';
  for await (const chunk of gateway.processStream({ messages: [{ role: 'user', content: 'hi' }] })) {
    out += chunk;
  }
  return out;
}

beforeEach(() => {
  circuitBreaker.resetAll();
  called.length = 0;
});

it('fails over past an empty stream when the hold window is disabled', async () => {
  mockChain = [stubProvider('groq', 'empty'), stubProvider('nvidia', 'ok')];

  await expect(ask()).resolves.toBe('hello from nvidia');
  expect(called).toEqual(['groq', 'nvidia']);
});

it('counts the empty provider as unhealthy rather than successful', async () => {
  mockChain = [stubProvider('groq', 'empty'), stubProvider('nvidia', 'ok')];

  await ask();
  expect(circuitBreaker.getState('groq').consecutiveFailureCount).toBe(1);
  expect(circuitBreaker.getState('nvidia').consecutiveFailureCount).toBe(0);
});

it('still streams a normal reply without buffering it', async () => {
  mockChain = [stubProvider('groq', 'ok')];

  await expect(ask()).resolves.toBe('hello from groq');
  expect(called).toEqual(['groq']);
});

it('surfaces an error when every provider streams nothing', async () => {
  mockChain = [stubProvider('groq', 'empty'), stubProvider('nvidia', 'empty')];

  await expect(ask()).rejects.toThrow(/all 2 available provider/i);
});
