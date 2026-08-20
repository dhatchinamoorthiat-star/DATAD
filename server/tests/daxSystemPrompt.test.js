/**
 * The Dax system prompt must survive the gateway's profile enrichment.
 *
 * It did not. Both chat paths hand the gateway a `messages` array with the
 * prompt as its leading system turn and never set `request.system`, but the
 * enrichment read only `request.system` — so the composed prompt became the
 * [Student Context] blob alone, and a `.filter(m => m.role !== 'system')`
 * deleted the real one. Dax lost its identity on every chat turn: no
 * first-person rule, no "never mention the tools" rule, no persona.
 *
 * Live replies from that window, recovered from ChatMessage:
 *   "The student has 1 pending task, which is an interview preparation task..."
 *   "Since you have 1 overdue task, I've returned the first one in the list."
 *   "This response is based on the student context provided."
 *   "The function \"update_file_system\" is not available in the given functions."
 *
 * No database, no network.
 */
let mockChain = [];
jest.mock('../ai/providers', () => ({
  getProviderChain: () => mockChain,
  getProvider: () => mockChain[0],
  buildProvider: () => {},
  clearCache: () => {},
}));
jest.mock('../ai/intelligence-layer', () => ({
  buildStudentProfile: async () => ({ enrichedContext: 'Plan: pro | How to respond: adopt a direct tone' }),
}));
jest.mock('../ai/usageMeter', () => ({ chargeCredits: async () => {} }));

const gateway = require('../ai/aiGateway');
const { withDaxIdentity } = require('../ai/dax');

const DAX_PROMPT = withDaxIdentity('You are in conversation with the student.');
const MESSAGES = [
  { role: 'system', content: DAX_PROMPT },
  { role: 'user', content: 'hi' },
];

/** Captures exactly what a provider is asked to send to the model. */
function recorder(seen, { rich = false } = {}) {
  return {
    name: 'groq',
    async complete({ messages, system }) {
      seen.push({ messages, system });
      return { text: 'ok', provider: 'groq', model: 'm' };
    },
    async *completeStream({ messages, system }) {
      seen.push({ messages, system });
      yield 'ok';
    },
    ...(rich
      ? {
          async *completeStreamRich({ messages, system }) {
            seen.push({ messages, system });
            yield { type: 'text', text: 'ok' };
          },
        }
      : {}),
  };
}

/** Everything the provider would put in front of the model, flattened. */
function sentText({ messages, system }) {
  return [system || '', ...messages.map((m) => m.content || '')].join('\n');
}

describe('streaming chat', () => {
  it('keeps the Dax system prompt, and sends it exactly once', async () => {
    const seen = [];
    mockChain = [recorder(seen)];

    let out = '';
    for await (const c of gateway.processStream({ messages: MESSAGES, userId: 'u1' })) out += c;

    expect(out).toBe('ok');
    expect(seen).toHaveLength(1);
    const sent = sentText(seen[0]);
    expect(sent).toContain('You are Dax');
    expect(sent).toContain('[Student Context]');
    // Both halves present, neither duplicated.
    expect(sent.match(/You are Dax/g)).toHaveLength(1);
    expect(sent.match(/\[Student Context\]/g)).toHaveLength(1);
  });

  it('keeps it on the tool-calling path too', async () => {
    const seen = [];
    mockChain = [recorder(seen, { rich: true })];

    let out = '';
    for await (const c of gateway.processStream({
      messages: MESSAGES,
      userId: 'u1',
      tools: [{ type: 'function', function: { name: 'list_my_tasks' } }],
    })) out += c;

    expect(out).toBe('ok');
    const sent = sentText(seen[0]);
    expect(sent).toContain('You are Dax');
    expect(sent.match(/\[Student Context\]/g)).toHaveLength(1);
  });

  it('still enriches when the caller passes `system` separately', async () => {
    const seen = [];
    mockChain = [recorder(seen)];

    for await (const _ of gateway.processStream({
      messages: [{ role: 'user', content: 'hi' }],
      system: 'TASK HANDLER PROMPT',
      userId: 'u1',
    })) { /* drain */ }

    const sent = sentText(seen[0]);
    expect(sent).toContain('TASK HANDLER PROMPT');
    expect(sent).toContain('[Student Context]');
  });
});

describe('non-streaming chat', () => {
  it('keeps the Dax system prompt', async () => {
    const seen = [];
    mockChain = [recorder(seen)];

    await gateway.process({ messages: MESSAGES, userId: 'u1' });

    // complete() on the OpenAI-compatible adapter takes no `system` argument,
    // so the prompt has to arrive inside the messages array or it is dropped.
    expect(seen[0].messages.some((m) => (m.content || '').includes('You are Dax'))).toBe(true);
    const sent = sentText(seen[0]);
    expect(sent.match(/\[Student Context\]/g)).toHaveLength(1);
  });
});

describe('assistant tool_call turns', () => {
  it('uses content:"" and normalises empty arguments, so Cloudflare accepts them', async () => {
    // Cloudflare Workers AI 400s (bodyless) on a null content here, and the
    // free tier's default model is one of theirs — so every free-tier turn
    // that touched a tool failed and survived only by burning a failover hop.
    const rounds = [];
    let round = 0;
    mockChain = [{
      name: 'cloudflare',
      async *completeStream() { yield 'unused'; },
      async *completeStreamRich({ messages }) {
        rounds.push(messages);
        if (round++ === 0) {
          // A no-argument tool call, exactly as the live model emits it.
          yield { type: 'tool_calls', toolCalls: [{ id: 'c1', name: 'list_my_tasks', arguments: '' }] };
          return;
        }
        yield { type: 'text', text: 'You have no tasks due.' };
      },
    }];

    jest.doMock('../ai/tools', () => ({
      ...jest.requireActual('../ai/tools'),
      executeTool: async () => ({ tasks: [] }),
    }));

    let out = '';
    for await (const c of gateway.processStream({
      messages: MESSAGES,
      userId: 'u1',
      tools: [{ type: 'function', function: { name: 'list_my_tasks' } }],
    })) out += c;

    expect(out).toBe('You have no tasks due.');

    const assistantTurn = rounds[1].find((m) => m.role === 'assistant' && m.tool_calls);
    expect(assistantTurn.content).toBe('');
    expect(assistantTurn.content).not.toBeNull();
    expect(assistantTurn.tool_calls[0].function.arguments).toBe('{}');
  });
});
