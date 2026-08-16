const OpenAI = require('openai');
const { withStreamIdleTimeout } = require('./streamIdleTimeout');

const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';

// Per-request ceiling. Without this the SDK waits ~10 minutes, so one slow
// model holds its socket open and starves every other AI request — that is
// what wedged the whole server during testing.
const REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS) || 20000;

const NVIDIA_MODELS = {
  'deepseek-ai/deepseek-v4-flash': {
    contextWindow: 1048576, supportsVision: false, supportsEmbedding: false, maxTokens: 8192,
  },
  'deepseek-ai/deepseek-v4-pro': {
    contextWindow: 1048576, supportsVision: false, supportsEmbedding: false, maxTokens: 8192,
  },
  'deepseek-ai/deepseek-r1': {
    contextWindow: 128000, supportsVision: false, supportsEmbedding: false, maxTokens: 4096,
  },
  'deepseek-ai/deepseek-r1-distill-llama-8b': {
    contextWindow: 128000, supportsVision: false, supportsEmbedding: false, maxTokens: 4096,
  },
  'deepseek-ai/deepseek-r1-distill-llama-70b': {
    contextWindow: 128000, supportsVision: false, supportsEmbedding: false, maxTokens: 4096,
  },
  'deepseek-ai/deepseek-r1-distill-qwen-32b': {
    contextWindow: 128000, supportsVision: false, supportsEmbedding: false, maxTokens: 4096,
  },
  'meta/llama-3.3-70b-instruct': {
    contextWindow: 128000, supportsVision: false, supportsEmbedding: false, maxTokens: 2048,
  },
  'meta/llama-3.1-8b-instruct': {
    contextWindow: 128000, supportsVision: false, supportsEmbedding: false, maxTokens: 2048,
  },
  'meta/llama-3.1-70b-instruct': {
    contextWindow: 128000, supportsVision: false, supportsEmbedding: false, maxTokens: 2048,
  },
  'meta/llama-4-maverick': {
    contextWindow: 256000, supportsVision: false, supportsEmbedding: false, maxTokens: 4096,
  },
  'nvidia/llama-3.1-nemotron-70b-instruct': {
    contextWindow: 128000, supportsVision: false, supportsEmbedding: false, maxTokens: 4096,
  },
  'nvidia/nemotron-3-super-120b-a12b': {
    contextWindow: 262000, supportsVision: false, supportsEmbedding: false, maxTokens: 8192,
  },
  'nvidia/nemotron-3-nano': {
    contextWindow: 128000, supportsVision: false, supportsEmbedding: false, maxTokens: 2048,
  },
  'nvidia/llama-3.3-nemotron-super-49b-v1.5': {
    contextWindow: 128000, supportsVision: false, supportsEmbedding: false, maxTokens: 4096,
  },
  'nvidia/nemotron-4-340b-instruct': {
    contextWindow: 4096, supportsVision: false, supportsEmbedding: false, maxTokens: 1024,
  },
  'qwen/qwen3-coder-480b-a35b-instruct': {
    contextWindow: 128000, supportsVision: false, supportsEmbedding: false, maxTokens: 8192,
  },
  'qwen/qwen-3.5': {
    contextWindow: 262000, supportsVision: false, supportsEmbedding: false, maxTokens: 8192,
  },
  'mistralai/mistral-large-3': {
    contextWindow: 128000, supportsVision: false, supportsEmbedding: false, maxTokens: 4096,
  },
  'mistralai/devstral-2-123b': {
    contextWindow: 128000, supportsVision: false, supportsEmbedding: false, maxTokens: 4096,
  },
  'minimax/minimax-m2.7-230b': {
    contextWindow: 262000, supportsVision: false, supportsEmbedding: false, maxTokens: 8192,
  },
  'google/gemma-4-31b-it': {
    contextWindow: 16000, supportsVision: false, supportsEmbedding: false, maxTokens: 4096,
  },
  'google/gemma-2-2b-it': {
    contextWindow: 8192, supportsVision: false, supportsEmbedding: false, maxTokens: 2048,
  },
  'google/gemma-2-9b-it': {
    contextWindow: 8192, supportsVision: false, supportsEmbedding: false, maxTokens: 2048,
  },
  'glm-5/glm-5': {
    contextWindow: 128000, supportsVision: false, supportsEmbedding: false, maxTokens: 4096,
  },
  'glm-5/glm-5.2': {
    contextWindow: 256000, supportsVision: false, supportsEmbedding: false, maxTokens: 8192,
  },
  'openai/gpt-oss-120b': {
    contextWindow: 128000, supportsVision: false, supportsEmbedding: false, maxTokens: 4096,
  },
  'openai/gpt-oss-20b': {
    contextWindow: 128000, supportsVision: false, supportsEmbedding: false, maxTokens: 4096,
  },
  'nvidia/nv-embedqa-e5-v5': {
    contextWindow: 512, supportsVision: false, supportsEmbedding: true, maxTokens: 512,
  },
  'nvidia/bge-m3': {
    contextWindow: 8192, supportsVision: false, supportsEmbedding: true, maxTokens: 8192,
  },
  'nvidia/nv-embedcode-7b-v1': {
    contextWindow: 4096, supportsVision: false, supportsEmbedding: true, maxTokens: 4096,
  },
  'bigcode/starcoder2-7b': {
    contextWindow: 16384, supportsVision: false, supportsEmbedding: false, maxTokens: 4096,
  },
  'meta/codellama-13b-instruct': {
    contextWindow: 16384, supportsVision: false, supportsEmbedding: false, maxTokens: 4096,
  },
  'meta/codellama-34b-instruct': {
    contextWindow: 16384, supportsVision: false, supportsEmbedding: false, maxTokens: 4096,
  },
  'meta/codellama-70b-instruct': {
    contextWindow: 16384, supportsVision: false, supportsEmbedding: false, maxTokens: 4096,
  },
  'nvidia/cosmos-reason2-8b': {
    contextWindow: 32768, supportsVision: true, supportsEmbedding: false, maxTokens: 2048,
  },
  'nvidia/cosmos-transfer1-7b': {
    contextWindow: 32768, supportsVision: true, supportsEmbedding: false, maxTokens: 2048,
  },
  'nvidia/cosmos3-nano': {
    contextWindow: 16384, supportsVision: true, supportsEmbedding: false, maxTokens: 2048,
  },
  'nvidia/cosmos3-nano-reasoner': {
    contextWindow: 16384, supportsVision: true, supportsEmbedding: false, maxTokens: 2048,
  },
  'sarvamai/sarvam-m': {
    contextWindow: 8192, supportsVision: false, supportsEmbedding: false, maxTokens: 2048,
  },
  'utter-project/eurollm-9b-instruct': {
    contextWindow: 8192, supportsVision: false, supportsEmbedding: false, maxTokens: 2048,
  },
  'speakleash/bielik-11b-v2.3-instruct': {
    contextWindow: 8192, supportsVision: false, supportsEmbedding: false, maxTokens: 2048,
  },
};

// ── Standby key pool ────────────────────────────────────────────────────────
// NVIDIA_API_KEY is the primary. Additional keys (from separate free-tier
// NVIDIA accounts) sit unused until the primary stops working — rate limit,
// exhausted credits, revoked key, or NVIDIA-side outage — then requests move
// to the next key automatically. With only the primary set, behaviour is
// identical to a plain single-key setup.
//
//   NVIDIA_API_KEY=nvapi-primary
//   NVIDIA_API_KEY_2=nvapi-second-account
//   NVIDIA_API_KEY_3=nvapi-third-account      (any number, in order)
//   NVIDIA_API_KEY_FALLBACK=...               (legacy name, still honoured)
const KEY_RESET_MS = 5 * 60 * 1000;
const MAX_EXTRA_KEYS = 10;

function nvidiaKeys() {
  const keys = [process.env.NVIDIA_API_KEY];
  for (let i = 2; i <= MAX_EXTRA_KEYS; i++) keys.push(process.env[`NVIDIA_API_KEY_${i}`]);
  keys.push(process.env.NVIDIA_API_KEY_FALLBACK);
  // De-duplicate so a key repeated across env vars isn't retried pointlessly.
  return [...new Set(keys.filter(Boolean))];
}

// Module-level so every NvidiaProvider instance (there's normally one)
// shares the same "primary is down, we're on key N" knowledge.
let _activeKeyIndex = 0;
let _keyFailedAt = 0;

function _currentKeyIndex() {
  if (_activeKeyIndex > 0 && Date.now() - _keyFailedAt > KEY_RESET_MS) {
    _activeKeyIndex = 0; // periodically drift back to the primary
  }
  return _activeKeyIndex;
}

// Worth trying another key: auth/quota problems and NVIDIA-side failures.
// Deliberately NOT 400/404/422 — a malformed request or unknown model name
// fails identically on every key, so rotating would just burn the pool.
function _shouldTryNextKey(err) {
  const status = err?.status || err?.response?.status;
  if (status === 401 || status === 403 || status === 429) return true; // key / quota
  if (status >= 500) return true;                                      // NVIDIA down
  if (!status) return true;                                            // network/timeout
  return false;
}

function getKeyPoolStatus() {
  return {
    totalKeys: nvidiaKeys().length,
    activeKeyIndex: _currentKeyIndex(),
    usingFallback: _currentKeyIndex() > 0,
    lastFailoverAt: _keyFailedAt ? new Date(_keyFailedAt).toISOString() : null,
  };
}

class NvidiaProvider {
  constructor(config) {
    this.name = 'nvidia';
    this.model = config.model || 'meta/llama-3.1-8b-instruct';
    this.maxTokens = config.maxTokens || 2048;
    this.temperature = config.temperature ?? 0.7;
    this._config = config;
    this._clients = {}; // one OpenAI client per key index
  }

  _getClient(keyIndex = _currentKeyIndex()) {
    const keys = nvidiaKeys();
    const idx = Math.min(keyIndex, keys.length - 1);
    if (!this._clients[idx]) {
      this._clients[idx] = new OpenAI({
        apiKey: keys[idx],
        baseURL: NVIDIA_BASE_URL,
        timeout: REQUEST_TIMEOUT_MS,
        maxRetries: 0, // the key pool + provider chain are the retry strategy
      });
    }
    return this._clients[idx];
  }

  // Run an SDK call against the active key, walking the whole standby pool
  // if that key is failing. A key that works becomes the active one, so the
  // next request goes straight to it instead of re-failing on a dead key.
  async _withKeyFallback(fn) {
    const keys = nvidiaKeys();
    const start = _currentKeyIndex();
    let lastErr;

    for (let attempt = 0; attempt < keys.length; attempt++) {
      const idx = (start + attempt) % keys.length;
      try {
        const result = await fn(this._getClient(idx));
        if (idx !== _activeKeyIndex) {
          _activeKeyIndex = idx;
          _keyFailedAt = idx > 0 ? Date.now() : 0;
          console.warn(`[nvidiaProvider] now serving on key #${idx + 1}/${keys.length}`);
        }
        return result;
      } catch (err) {
        lastErr = err;
        if (!_shouldTryNextKey(err)) throw err; // same failure on every key
        console.warn(
          `[nvidiaProvider] key #${idx + 1}/${keys.length} failed (${err?.status || 'network'}): ${err?.message?.slice(0, 80)}`
        );
      }
    }

    throw lastErr;
  }

  isAvailable() {
    return nvidiaKeys().length > 0;
  }

  getModelInfo(modelName) {
    return NVIDIA_MODELS[modelName] || NVIDIA_MODELS['meta/llama-3.1-8b-instruct'];
  }

  async complete({ messages, system, maxTokens, temperature, responseFormat, model, tools }) {
    const start = Date.now();
    const resolvedModel = model || this.model;
    const modelInfo = this.getModelInfo(resolvedModel);

    const params = {
      model: resolvedModel,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        ...messages,
      ],
      max_tokens: maxTokens || modelInfo.maxTokens || this.maxTokens,
      temperature: temperature ?? this.temperature,
    };
    if (responseFormat) params.response_format = responseFormat;
    if (tools?.length) {
      params.tools = tools;
      params.tool_choice = 'auto';
    }

    const res = await this._withKeyFallback((client) => client.chat.completions.create(params));
    const message = res.choices[0].message;
    // A tool-calling turn returns content: null — .trim() on it threw before
    // this branch existed.
    const text = (message.content || '').trim();
    return {
      text,
      // Normalised to { id, name, arguments } so callers never have to know the
      // provider's nested function-call shape.
      toolCalls: (message.tool_calls || []).map((tc) => ({
        id: tc.id,
        name: tc.function?.name,
        arguments: tc.function?.arguments,
      })),
      finishReason: res.choices[0].finish_reason,
      provider: 'nvidia',
      model: resolvedModel,
      tokensUsed: res.usage?.total_tokens || 0,
      promptTokens: res.usage?.prompt_tokens || 0,
      completionTokens: res.usage?.completion_tokens || 0,
      latencyMs: Date.now() - start,
    };
  }

  // Real token-by-token streaming via NVIDIA NIM's OpenAI-compatible
  // chat/completions endpoint. `signal` is passed as the SDK's request-options
  // arg so an aborted Express request genuinely cancels the upstream call,
  // not just the client-side read.
  async *completeStream({ messages, system, maxTokens, temperature, model, signal }) {
    for await (const ev of this.completeStreamRich({ messages, system, maxTokens, temperature, model, signal })) {
      if (ev.type === 'text') yield ev.text;
    }
  }

  /**
   * Streaming with tool-call support.
   *
   * completeStream() above yields bare content strings, which cannot express
   * "the model wants to call a tool" — so this yields typed events instead and
   * completeStream() is now a filter over it, keeping every existing caller
   * working unchanged.
   *
   * Yields:
   *   { type: 'text', text }              content delta, as it arrives
   *   { type: 'tool_calls', toolCalls }   once, terminally, if the model
   *                                       decided to call tools this turn
   *
   * Tool calls arrive fragmented across chunks — the name in one delta, the
   * JSON arguments split across many more — keyed by `index`, so they have to
   * be reassembled before they mean anything.
   */
  async *completeStreamRich({ messages, system, maxTokens, temperature, model, signal, tools }) {
    const resolvedModel = model || this.model;
    const modelInfo = this.getModelInfo(resolvedModel);

    const params = {
      model: resolvedModel,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        ...messages,
      ],
      max_tokens: maxTokens || modelInfo.maxTokens || this.maxTokens,
      temperature: temperature ?? this.temperature,
      stream: true,
    };
    if (tools?.length) {
      params.tools = tools;
      params.tool_choice = 'auto';
    }

    const stream = await this._withKeyFallback((client) => client.chat.completions.create(params, { signal }));

    const pending = new Map(); // index -> { id, name, arguments }

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
        // Concatenated, never replaced: the arguments JSON is streamed in
        // fragments and is only parseable once every fragment has landed.
        if (tc.function?.arguments) acc.arguments += tc.function.arguments;
      }
    }

    if (pending.size) {
      yield { type: 'tool_calls', toolCalls: [...pending.values()].filter((t) => t.name) };
    }
  }

  async generateEmbeddings(inputs, model) {
    const embedModel = model || 'nvidia/nv-embedqa-e5-v5';
    const inputsArr = Array.isArray(inputs) ? inputs : [inputs];
    const res = await this._withKeyFallback((client) => client.embeddings.create({
      model: embedModel,
      input: inputsArr,
    }));
    return res.data.map((d) => d.embedding);
  }

  async generate({ system, user, context, query, taskName, intent, userId, model }) {
    const messages = [
      ...(context ? [{ role: 'system', content: context }] : []),
      ...(system ? [{ role: 'system', content: system }] : []),
      ...(user ? [{ role: 'user', content: user }] : []),
      ...(query ? [{ role: 'user', content: query }] : []),
    ];
    return this.complete({ messages, system, model });
  }
}

module.exports = NvidiaProvider;
module.exports.getKeyPoolStatus = getKeyPoolStatus;
module.exports.nvidiaKeys = nvidiaKeys;
