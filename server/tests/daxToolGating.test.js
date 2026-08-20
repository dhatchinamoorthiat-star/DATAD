/**
 * When Dax is allowed to reach for a tool.
 *
 * Two independent guards, both added 2026-08-18 after the free-tier model
 * answered a bare "hi" by fetching tasks, resume and notes and replying
 * "You have 1 pending task and 1 overdue task...":
 *
 *   1. daxService.isSmallTalk() — a purely social turn is sent with no tools
 *      at all. The prompt asks for this too, but the free tier's model obeys
 *      only sometimes: across live runs the same "hi" fetched the resume on
 *      one attempt and nothing on the next.
 *   2. The gateway serves a repeated tool call from cache, and stops offering
 *      tools once a whole round asks for nothing new — so a model that loops
 *      cannot spend every round re-asking the same question.
 *
 * No database, no network.
 */
const { isSmallTalk } = require('../ai/daxService');

describe('isSmallTalk', () => {
  it.each([
    'hi', 'Hi', 'hii', 'hey', 'heyyy', 'hello', 'Hello!', 'yo', 'hola', 'namaste',
    'good morning', 'Good Evening', 'thanks', 'thanks!', 'Thank you', 'thx', 'ty',
    'cheers', 'bye', 'goodbye', 'hi dax', 'hey Dax!', 'thanks a lot',
  ])('treats %j as small talk', (msg) => {
    expect(isSmallTalk(msg)).toBe(true);
  });

  it.each([
    'hi, what are my tasks?',
    'hey can you check my resume',
    'thanks — now summarise my notes',
    'good morning, what should I study today?',
    'what are my tasks?',
    'hello world program in python',
  ])('leaves %j alone', (msg) => {
    expect(isSmallTalk(msg)).toBe(false);
  });

  // A bare affirmation can be the student agreeing to something Dax just
  // offered to do, so it must keep its tools even though it reads like chatter.
  it.each(['ok', 'okay', 'sure', 'yes', 'yep', 'got it', 'cool', 'nice'])(
    'does NOT strip tools from the affirmation %j',
    (msg) => {
      expect(isSmallTalk(msg)).toBe(false);
    }
  );

  it('ignores anything longer than a pleasantry', () => {
    expect(isSmallTalk('thanks '.repeat(10))).toBe(false);
  });

  it('handles empty and missing input', () => {
    expect(isSmallTalk('')).toBe(false);
    expect(isSmallTalk(undefined)).toBe(false);
  });
});

describe('repeated tool calls', () => {
  let mockChain = [];
  let executed = [];

  beforeEach(() => {
    jest.resetModules();
    executed = [];
    jest.doMock('../ai/providers', () => ({
      getProviderChain: () => mockChain,
      getProvider: () => mockChain[0],
      buildProvider: () => {},
      clearCache: () => {},
    }));
    jest.doMock('../ai/intelligence-layer', () => ({ buildStudentProfile: async () => null }));
    jest.doMock('../ai/usageMeter', () => ({ chargeCredits: async () => {} }));
    jest.doMock('../ai/tools', () => ({
      ...jest.requireActual('../ai/tools'),
      executeTool: async (call) => {
        executed.push(`${call.name}(${call.arguments || ''})`);
        return { tasks: [] };
      },
    }));
  });

  /** Emits the scripted tool calls per round, then prose once tools stop. */
  function scriptedProvider(script) {
    let round = 0;
    return {
      name: 'cloudflare',
      async *completeStream() { yield 'no-tools path'; },
      async *completeStreamRich({ tools: offered }) {
        const step = script[round++];
        if (!offered || !step) {
          yield { type: 'text', text: 'You have no tasks due.' };
          return;
        }
        yield { type: 'tool_calls', toolCalls: step };
      },
    };
  }

  async function run() {
    const gateway = require('../ai/aiGateway');
    let out = '';
    for await (const c of gateway.processStream({
      messages: [{ role: 'user', content: 'what are my tasks?' }],
      userId: 'u1',
      tools: [{ type: 'function', function: { name: 'list_my_tasks' } }],
    })) out += c;
    return out;
  }

  it('executes an identical repeat only once', async () => {
    // The live shape: the same no-argument call three times over, spelled two
    // different ways on the wire ('' and '{}').
    mockChain = [scriptedProvider([
      [{ id: 'a', name: 'list_my_tasks', arguments: '' }],
      [{ id: 'b', name: 'list_my_tasks', arguments: '{}' }],
      [{ id: 'c', name: 'list_my_tasks', arguments: '' }],
    ])];

    await expect(run()).resolves.toBe('You have no tasks due.');
    expect(executed).toEqual(['list_my_tasks()']);
  });

  it('canonicalises argument key order before comparing', async () => {
    mockChain = [scriptedProvider([
      [{ id: 'a', name: 'list_my_tasks', arguments: '{"onlyOverdue":true,"limit":5}' }],
      [{ id: 'b', name: 'list_my_tasks', arguments: '{"limit":5,"onlyOverdue":true}' }],
    ])];

    await run();
    expect(executed).toHaveLength(1);
  });

  it('still executes a genuinely different call', async () => {
    mockChain = [scriptedProvider([
      [{ id: 'a', name: 'list_my_tasks', arguments: '{}' }],
      [{ id: 'b', name: 'list_my_tasks', arguments: '{"onlyOverdue":true}' }],
    ])];

    await run();
    expect(executed).toEqual(['list_my_tasks({})', 'list_my_tasks({"onlyOverdue":true})']);
  });

  it('stops offering tools after a round that asked for nothing new', async () => {
    // Round 2 repeats round 1, so round 3 must be prose — not a fourth
    // request. Without the guard this burned every remaining round.
    const seenOffers = [];
    let round = 0;
    mockChain = [{
      name: 'cloudflare',
      async *completeStream() { yield 'unused'; },
      async *completeStreamRich({ tools: offered }) {
        seenOffers.push(Boolean(offered));
        if (round++ < 2) {
          yield { type: 'tool_calls', toolCalls: [{ id: `r${round}`, name: 'list_my_tasks', arguments: '{}' }] };
          return;
        }
        yield { type: 'text', text: 'You have no tasks due.' };
      },
    }];

    await expect(run()).resolves.toBe('You have no tasks due.');
    expect(seenOffers).toEqual([true, true, false]);
    expect(executed).toEqual(['list_my_tasks({})']);
  });
});
