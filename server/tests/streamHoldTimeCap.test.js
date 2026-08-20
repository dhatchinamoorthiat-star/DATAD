/**
 * The hold window is bounded in time as well as in characters.
 *
 * Separate file because it needs a different DAX_STREAM_HOLD_MS, and env is
 * read at module load — resetting modules mid-file would hand the gateway a
 * different circuitBreaker instance than the assertions read.
 */
process.env.DAX_STREAM_HOLD_CHARS = '5000';  // unreachable, so time is the only limit
process.env.DAX_STREAM_HOLD_MS = '40';

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

it('stops holding a slow reply instead of buffering the whole thing', async () => {
  // 6 chunks at 30ms each = 180ms of generation. With only a char target, the
  // student would wait for all of it before seeing a single token.
  // Plain strings, matching the real provider contract — see the note in
  // streamHoldBuffer.test.js.
  mockChain = [{
    name: 'groq',
    async *completeStream() {
      for (const text of ['a', 'b', 'c', 'd', 'e', 'f']) {
        await new Promise((r) => setTimeout(r, 30));
        yield text;
      }
    },
  }];

  const seenAt = [];
  const startedAt = Date.now();
  let out = '';
  for await (const c of gateway.processStream({ messages: [{ role: 'user', content: 'hi' }] })) {
    out += c;
    seenAt.push(Date.now() - startedAt);
  }

  expect(out).toBe('abcdef');                 // nothing lost
  expect(seenAt[0]).toBeLessThan(150);        // released well before the stream ended
});
