/**
 * Adapter for any OpenAI-compatible API:
 * Groq, OpenAI, Gemini, OpenRouter, NVIDIA NIM, Ollama
 */
const OpenAI = require('openai');
const { withStreamIdleTimeout } = require('./streamIdleTimeout');

// Per-request ceiling for any single provider call. Overridable so a slow
// self-hosted backend can be given more room without a code change.
const REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS) || 20000;

class OpenAICompatibleProvider {
  constructor(config) {
    this.name = config.name;
    this.model = config.model;
    this.maxTokens = config.maxTokens || 2048;
    this.temperature = config.temperature ?? 0.7;
    this._client = null;
    this._config = config;
  }

  _getClient() {
    if (!this._client) {
      const opts = {
        apiKey: this._config.apiKey,
        // The SDK defaults to a 10-minute timeout and silent retries. In a
        // failover chain that means a stalled provider blocks every backup
        // behind it, so a slow provider looks like a total outage. Fail fast
        // and let getProviderChain() move on to the next one instead.
        timeout: REQUEST_TIMEOUT_MS,
        maxRetries: 0,
      };
      if (this._config.baseURL) opts.baseURL = this._config.baseURL;
      this._client = new OpenAI(opts);
    }
    return this._client;
  }

  isAvailable() {
    return Boolean(this._config.apiKey);
  }

  async complete({ messages, maxTokens, temperature, responseFormat, model }) {
    const start = Date.now();
    const resolvedModel = model || this.model;
    const params = {
      model: resolvedModel,
      messages,
      max_tokens: maxTokens || this.maxTokens,
      temperature: temperature ?? this.temperature,
    };
    if (responseFormat) params.response_format = responseFormat;

    const res = await this._getClient().chat.completions.create(params);
    const text = res.choices[0].message.content.trim();
    return {
      text,
      provider: this.name,
      model: resolvedModel,
      tokensUsed: res.usage?.total_tokens || 0,
      promptTokens: res.usage?.prompt_tokens || 0,
      completionTokens: res.usage?.completion_tokens || 0,
      latencyMs: Date.now() - start,
    };
  }

  // Streaming was missing entirely on this adapter, so every provider it backs
  // (Groq, OpenAI, Gemini, OpenRouter, Ollama) failed the chat path with
  // "does not support streaming" — a user who picked a Groq model in the model
  // picker got a 500 on every message. The endpoints are all OpenAI-compatible,
  // so this is the same implementation as the NVIDIA provider's.
  async *completeStream({ messages, system, maxTokens, temperature, model, signal }) {
    for await (const ev of this.completeStreamRich({ messages, system, maxTokens, temperature, model, signal })) {
      if (ev.type === 'text') yield ev.text;
    }
  }

  /**
   * Typed streaming events, including reassembled tool calls.
   * See nvidiaProvider.completeStreamRich() for the contract.
   */
  async *completeStreamRich({ messages, system, maxTokens, temperature, model, signal, tools }) {
    const resolvedModel = model || this.model;
    const params = {
      model: resolvedModel,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        ...messages,
      ],
      max_tokens: maxTokens || this.maxTokens,
      temperature: temperature ?? this.temperature,
      stream: true,
    };
    if (tools?.length) {
      params.tools = tools;
      params.tool_choice = 'auto';
    }

    const stream = await this._getClient().chat.completions.create(params, { signal });
    const pending = new Map();

    for await (const chunk of withStreamIdleTimeout(stream)) {
      const choice = chunk.choices?.[0];
      if (!choice) continue;

      const delta = choice.delta?.content;
      if (delta) yield { type: 'text', text: delta };

      for (const tc of choice.delta?.tool_calls || []) {
        const idx = tc.index ?? 0;
        if (!pending.has(idx)) pending.set(idx, { id: '', name: '', arguments: '' });
        const acc = pending.get(idx);
        if (tc.id) acc.id = tc.id;
        if (tc.function?.name) acc.name += tc.function.name;
        // Arguments stream in fragments; concatenate, never replace.
        if (tc.function?.arguments) acc.arguments += tc.function.arguments;
      }
    }

    if (pending.size) {
      yield { type: 'tool_calls', toolCalls: [...pending.values()].filter((t) => t.name) };
    }
  }

  async generate({ system, user, context, query, taskName, intent, userId, model }) {
    const messages = [
      ...(context ? [{ role: 'system', content: context }] : []),
      ...(system ? [{ role: 'system', content: system }] : []),
      ...(user ? [{ role: 'user', content: user }] : []),
      ...(query ? [{ role: 'user', content: query }] : []),
    ];
    return this.complete({ messages, model });
  }
}

module.exports = OpenAICompatibleProvider;
