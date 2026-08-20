/**
 * The failover chain skips providers the breaker has benched.
 *
 * This exercises the real aiGateway streaming loop with stubbed providers —
 * the guard's own unit tests prove the classification, this proves the wiring.
 * No database.
 */
process.env.AI_BREAKER_FAILURE_THRESHOLD = '3';

const called = [];
const modelsSeen = [];

// completeStream() yields PLAIN STRINGS, not { text } objects — see
// openaiCompatible.js and nvidiaProvider.js, both of which do `yield ev.text`,
// and daxService.streamChat(), which consumes them as `reply += delta`. These
// stubs used to yield { text }, which let the gateway's hold window count
// `value?.text?.length` and appear to work in tests while counting 0 against
// every real provider in production.
function stubProvider(name, behavior) {
  return {
    name,
    async *completeStream({ model } = {}) {
      called.push(name);
      modelsSeen.push({ provider: name, model });
      if (behavior === 'rate_limited') throw Object.assign(new Error('rate limited'), { status: 429 });
      if (behavior === 'empty') return;
      yield `hello from ${name}`;
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
  modelsSeen.length = 0;
});

async function askWith(request) {
  let out = '';
  for await (const chunk of gateway.processStream(request)) {
    out += chunk;
  }
  return out;
}

it('falls through a rate-limited provider to a working one', async () => {
  mockChain = [stubProvider('groq', 'rate_limited'), stubProvider('nvidia', 'ok')];

  await expect(ask()).resolves.toBe('hello from nvidia');
  expect(called).toEqual(['groq', 'nvidia']);
});

it('stops calling a provider once it is benched', async () => {
  mockChain = [stubProvider('groq', 'rate_limited'), stubProvider('nvidia', 'ok')];

  // Three rate-limited turns trip the breaker.
  await ask(); await ask(); await ask();
  expect(circuitBreaker.getState('groq').currentState).toBe('open');

  // The point of the whole exercise: the fourth request must not pay a
  // round-trip to a provider already known to be rate-limited.
  called.length = 0;
  await expect(ask()).resolves.toBe('hello from nvidia');
  expect(called).toEqual(['nvidia']);
});

it('counts a silently empty stream against the provider', async () => {
  mockChain = [stubProvider('groq', 'empty'), stubProvider('nvidia', 'ok')];

  await expect(ask()).resolves.toBe('hello from nvidia');
  expect(circuitBreaker.getState('groq').consecutiveFailureCount).toBe(1);
});

it('keeps a provider that answers in rotation', async () => {
  mockChain = [stubProvider('groq', 'ok'), stubProvider('nvidia', 'ok')];

  await ask(); await ask();
  expect(circuitBreaker.getState('groq').currentState).toBe('closed');
  expect(called).toEqual(['groq', 'groq']);
});

describe('model equivalence on failover', () => {
  it('reroutes to a same-capability model in the new provider namespace', async () => {
    mockChain = [stubProvider('groq', 'rate_limited'), stubProvider('nvidia', 'ok')];

    await askWith({
      messages: [{ role: 'user', content: 'hi' }],
      model: 'openai/gpt-oss-20b',   // groq, balanced class
      tools: [{ type: 'function', function: { name: 'x' } }],
    });

    // Without equivalence this was `undefined`, letting nvidia fall back to
    // its configured 8B default and silently dropping write-tool eligibility.
    expect(modelsSeen).toEqual([
      { provider: 'groq', model: 'openai/gpt-oss-20b' },
      { provider: 'nvidia', model: 'meta/llama-3.1-70b-instruct' },
    ]);
  });

  it('leaves the first-choice provider untouched', async () => {
    mockChain = [stubProvider('groq', 'ok')];

    await askWith({ messages: [{ role: 'user', content: 'hi' }], model: 'openai/gpt-oss-20b' });

    expect(modelsSeen).toEqual([{ provider: 'groq', model: 'openai/gpt-oss-20b' }]);
  });

  it('defers to the provider default when no truthful mapping exists', async () => {
    mockChain = [stubProvider('groq', 'rate_limited'), stubProvider('openrouter', 'ok')];

    await askWith({ messages: [{ role: 'user', content: 'hi' }], model: 'openai/gpt-oss-20b' });

    // openrouter has no registry entries — undefined means "use your own
    // configured model", which is correct; inventing a slug would 404.
    expect(modelsSeen[1]).toEqual({ provider: 'openrouter', model: undefined });
  });
});

describe('unknown-model 404s', () => {
  it('reroutes rather than failing the request', async () => {
    // Live preflight (2026-08-18) found Groq 404ing on its configured model
    // while NVIDIA and Cloudflare answered fine. A 404 is bad_request, and an
    // earlier version of this loop short-circuited on that — which would have
    // failed the whole turn instead of rerouting to a provider that works.
    const notFound = Object.assign(new Error('404 model does not exist'), { status: 404 });
    mockChain = [
      { name: 'groq', async *completeStream() { called.push('groq'); throw notFound; } },
      stubProvider('nvidia', 'ok'),
    ];

    await expect(ask()).resolves.toBe('hello from nvidia');
    expect(called).toEqual(['groq', 'nvidia']);
  });

  it('still does not hold a 404 against the provider', async () => {
    // An unknown model slug says nothing about whether the provider is healthy.
    const notFound = Object.assign(new Error('404'), { status: 404 });
    mockChain = [
      { name: 'groq', async *completeStream() { throw notFound; } },
      stubProvider('nvidia', 'ok'),
    ];

    await ask(); await ask(); await ask(); await ask();
    expect(circuitBreaker.getState('groq').currentState).toBe('closed');
  });
});

describe('failover with the hold window disabled', () => {
  it('still reroutes when the first provider throws immediately', async () => {
    // DAX_STREAM_HOLD_CHARS=0 means no chunk is pulled before committing, so
    // the first provider call happens inside the streaming loop. Marking the
    // turn "committed" before any chunk was yielded made that failure look
    // mid-stream, disabling failover — a recoverable 400 became a hard 500.
    const prev = process.env.DAX_STREAM_HOLD_CHARS;
    process.env.DAX_STREAM_HOLD_CHARS = '0';
    jest.resetModules();
    const gw = require('../ai/aiGateway');

    const badRequest = Object.assign(new Error('400 status code (no body)'), { status: 400 });
    mockChain = [
      { name: 'cloudflare', async *completeStream() { called.push('cloudflare'); throw badRequest; } },
      stubProvider('nvidia', 'ok'),
    ];

    let out = '';
    for await (const chunk of gw.processStream({ messages: [{ role: 'user', content: 'hi' }] })) {
      out += chunk;
    }

    expect(out).toBe('hello from nvidia');
    expect(called).toEqual(['cloudflare', 'nvidia']);

    process.env.DAX_STREAM_HOLD_CHARS = prev;
    jest.resetModules();
  });
});
