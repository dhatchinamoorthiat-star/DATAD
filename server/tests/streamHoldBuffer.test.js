/**
 * The hold buffer — an early provider death should fail over invisibly.
 * No database, no network.
 */
process.env.AI_BREAKER_FAILURE_THRESHOLD = '3';
process.env.DAX_STREAM_HOLD_CHARS = '50';
process.env.DAX_STREAM_HOLD_MS = '5000';

let mockChain = [];
jest.mock('../ai/providers', () => ({
  getProviderChain: () => mockChain,
  getProvider: () => mockChain[0],
  buildProvider: () => {},
  clearCache: () => {},
}));
jest.mock('../ai/intelligence-layer', () => ({ buildStudentProfile: async () => null }));
jest.mock('../ai/usageMeter', () => ({ chargeCredits: async () => {} }));

const gateway = require('../ai/aiGateway');
const circuitBreaker = require('../ai/runtime-v2/circuitBreaker');

/**
 * Emits `chunks`, then optionally throws — simulating a mid-stream death.
 *
 * Yields PLAIN STRINGS, matching what the real providers emit
 * (openaiCompatible.js and nvidiaProvider.js both `yield ev.text`) and what
 * daxService.streamChat() consumes (`reply += delta`). This stub used to yield
 * { text } objects, and the gateway's hold window measured `value?.text.length`
 * to match — so the char counter passed here while counting 0 against every
 * real provider, pinning time-to-first-token to the full HOLD_MS in production.
 */
function stubProvider(name, { chunks = [], throwAfter = null, delayMs = 0 } = {}) {
  return {
    name,
    async *completeStream() {
      for (const text of chunks) {
        if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
        yield text;
      }
      if (throwAfter) throw throwAfter;
    },
  };
}

async function ask(request = {}) {
  let out = '';
  for await (const chunk of gateway.processStream({ messages: [{ role: 'user', content: 'hi' }], ...request })) {
    out += chunk;
  }
  return out;
}

beforeEach(() => circuitBreaker.resetAll());

it('hides an early provider death behind a clean failover', async () => {
  // groq emits a few tokens then dies — under the old yield-immediately code
  // the student saw "Well, the" and then an error.
  mockChain = [
    stubProvider('groq', { chunks: ['Well, ', 'the '], throwAfter: Object.assign(new Error('boom'), { status: 500 }) }),
    stubProvider('nvidia', { chunks: ['The answer is 42.'] }),
  ];

  // No fragment of the dead provider's output leaks into the reply.
  await expect(ask()).resolves.toBe('The answer is 42.');
  expect(circuitBreaker.getState('groq').consecutiveFailureCount).toBe(1);
});

it('still surfaces a death that happens after the commit point', async () => {
  // Past the hold window the client has already rendered text; restarting
  // would append a second independent answer to a half-read one.
  const long = 'x'.repeat(80);   // exceeds the 50-char hold
  mockChain = [
    stubProvider('groq', { chunks: [long], throwAfter: Object.assign(new Error('late boom'), { status: 500 }) }),
    stubProvider('nvidia', { chunks: ['unused'] }),
  ];

  await expect(ask()).rejects.toThrow('late boom');
});

it('passes through a reply shorter than the hold window', async () => {
  // The window must not swallow a short but complete answer.
  mockChain = [stubProvider('groq', { chunks: ['ok'] })];

  await expect(ask()).resolves.toBe('ok');
});

it('preserves chunk order and content exactly', async () => {
  mockChain = [stubProvider('groq', { chunks: ['a', 'b', 'c', 'd'] })];

  await expect(ask()).resolves.toBe('abcd');
});

it('treats a cancelled turn as cancelled, not as a provider failure', async () => {
  // The critical case: an abort inside the hold window must NOT reroute and
  // answer a question the student just cancelled.
  const abortErr = Object.assign(new Error('Request was aborted.'), { name: 'APIUserAbortError' });
  mockChain = [
    stubProvider('groq', { chunks: ['par'], throwAfter: abortErr }),
    stubProvider('nvidia', { chunks: ['SHOULD NOT BE CALLED'] }),
  ];

  await expect(ask()).rejects.toThrow('Request was aborted.');
  // And the cancellation is not held against the provider.
  expect(circuitBreaker.getState('groq').consecutiveFailureCount).toBe(0);
});

it('still counts a genuinely empty stream as a failure', async () => {
  mockChain = [stubProvider('groq', { chunks: [] }), stubProvider('nvidia', { chunks: ['hello'] })];

  await expect(ask()).resolves.toBe('hello');
  expect(circuitBreaker.getState('groq').consecutiveFailureCount).toBe(1);
});
