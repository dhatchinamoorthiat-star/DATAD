/**
 * A provider that answers with no text must not end the turn.
 *
 * The streaming path has always rerouted an empty stream. The two
 * non-streaming paths did not: an empty string counted as a finished reply,
 * the chain stopped at the first provider, and the student got a blank
 * message. Found 2026-08-19 against groq's gpt-oss-20b, which returns nothing
 * for short conversational turns ("hi") while answering longer questions
 * normally. JSON tasks were unaffected — the parse failed and rerouted them —
 * so this covers the chat path and the plain-text (json: false) task path.
 *
 * Stubbed providers, no database, no network.
 */
const called = [];

function stubProvider(name, text) {
  return {
    name,
    async complete() {
      called.push(name);
      return { text, provider: name, model: `${name}-model`, tokensUsed: 1 };
    },
  };
}

// `mock`-prefixed so jest's hoisted module factory may close over it.
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
const runner = require('../ai/runner');
const circuitBreaker = require('../ai/runtime-v2/circuitBreaker');

beforeEach(() => {
  circuitBreaker.resetAll();
  called.length = 0;
});

describe('chat path (messages array)', () => {
  it('rerouts past a provider that returns an empty completion', async () => {
    mockChain = [stubProvider('groq', ''), stubProvider('cloudflare', 'hello there')];

    const res = await gateway.process({ messages: [{ role: 'user', content: 'hi' }] });

    expect(res.result).toBe('hello there');
    expect(res.provider).toBe('cloudflare');
    expect(called).toEqual(['groq', 'cloudflare']);
  });

  it('treats whitespace-only text as empty', async () => {
    mockChain = [stubProvider('groq', '   \n  '), stubProvider('cloudflare', 'hello there')];

    const res = await gateway.process({ messages: [{ role: 'user', content: 'hi' }] });

    expect(res.result).toBe('hello there');
  });

  it('still stops at the first provider when it answers', async () => {
    mockChain = [stubProvider('groq', 'hello'), stubProvider('cloudflare', 'unused')];

    const res = await gateway.process({ messages: [{ role: 'user', content: 'hi' }] });

    expect(res.result).toBe('hello');
    expect(called).toEqual(['groq']);
  });

  it('fails the request when every provider comes back empty', async () => {
    mockChain = [stubProvider('groq', ''), stubProvider('cloudflare', '')];

    await expect(gateway.process({ messages: [{ role: 'user', content: 'hi' }] }))
      .rejects.toThrow(/empty completion/);
  });
});

describe('plain-text task path (json: false)', () => {
  it('rerouts past a provider that returns an empty completion', async () => {
    mockChain = [stubProvider('groq', ''), stubProvider('cloudflare', 'a briefing')];

    const { result, meta } = await runner.run({
      system: 'sys',
      user: 'write a briefing',
      json: false,
      _gatewayBypass: true,
    });

    expect(result).toBe('a briefing');
    expect(meta.provider).toBe('cloudflare');
    expect(called).toEqual(['groq', 'cloudflare']);
  });
});
