const cfg = require('../../config/automation');

const CAPABILITY_CATEGORIES = [
  'chat', 'reasoning', 'coding', 'vision', 'embeddings',
  'reranking', 'summarisation', 'translation', 'classification',
  'extraction', 'planning', 'recommendation',
];

const MODELS = {
  // ═══════════════════════════════════════════════════════════════
  // NVIDIA NIM — Primary Provider
  // ═══════════════════════════════════════════════════════════════

  // Verified against the live NVIDIA NIM API on 2026-07-27
  // (see server/scripts/verifyModelRegistry.js). Of 30 previously-listed
  // models, only these 7 actually resolved — the rest 404/410'd (retired or
  // wrong slug) or consistently timed out under load. Trimmed rather than
  // left in so tier routing and the model picker never offer a model that
  // cannot serve a request.

  'deepseek-ai/deepseek-v4-flash': {
    provider: 'nvidia',
    model: 'deepseek-ai/deepseek-v4-flash',
    parameters: '284b',
    contextWindow: 1048576,
    maxTokens: 8192,
    capabilities: ['chat', 'reasoning', 'coding', 'extraction', 'summarisation'],
    reasoningScore: 88,
    codingScore: 92,
    writingScore: 80,
    visionScore: 0,
    embeddingScore: 0,
    latencyScore: 82,
    costScore: 85,
    healthScore: 95,
    availability: 0.96,
    supportsVision: false,
    supportsEmbedding: false,
    supportsJson: true,
    supportsStreaming: true,
    supportsToolCalling: true,
    tier: 'free',
  },
  'meta/llama-3.1-8b-instruct': {
    provider: 'nvidia',
    model: 'meta/llama-3.1-8b-instruct',
    parameters: '8b',
    contextWindow: 128000,
    maxTokens: 2048,
    capabilities: ['chat', 'summarisation', 'classification'],
    reasoningScore: 65,
    codingScore: 62,
    writingScore: 66,
    visionScore: 0,
    embeddingScore: 0,
    latencyScore: 93,
    costScore: 96,
    healthScore: 98,
    availability: 0.99,
    supportsVision: false,
    supportsEmbedding: false,
    supportsJson: true,
    supportsStreaming: true,
    supportsToolCalling: true,
    tier: 'free',
  },
  'meta/llama-3.1-70b-instruct': {
    provider: 'nvidia',
    model: 'meta/llama-3.1-70b-instruct',
    parameters: '70b',
    contextWindow: 128000,
    maxTokens: 2048,
    capabilities: ['chat', 'reasoning', 'summarisation', 'extraction'],
    reasoningScore: 80,
    codingScore: 72,
    writingScore: 76,
    visionScore: 0,
    embeddingScore: 0,
    latencyScore: 78,
    costScore: 76,
    healthScore: 96,
    availability: 0.96,
    supportsVision: false,
    supportsEmbedding: false,
    supportsJson: true,
    supportsStreaming: true,
    supportsToolCalling: true,
    tier: 'free',
  },
  'nvidia/nemotron-3-super-120b-a12b': {
    provider: 'nvidia',
    model: 'nvidia/nemotron-3-super-120b-a12b',
    parameters: '120b-a12b',
    contextWindow: 262000,
    maxTokens: 8192,
    capabilities: ['chat', 'reasoning', 'planning', 'extraction', 'coding'],
    reasoningScore: 90,
    codingScore: 85,
    writingScore: 80,
    visionScore: 0,
    embeddingScore: 0,
    latencyScore: 78,
    costScore: 80,
    healthScore: 93,
    availability: 0.93,
    supportsVision: false,
    supportsEmbedding: false,
    supportsJson: true,
    supportsStreaming: true,
    supportsToolCalling: true,
    tier: 'free',
  },
  'nvidia/nemotron-3-nano-30b-a3b': {
    provider: 'nvidia',
    model: 'nvidia/nemotron-3-nano-30b-a3b',
    parameters: '8b',
    contextWindow: 128000,
    maxTokens: 2048,
    capabilities: ['chat', 'summarisation', 'classification'],
    reasoningScore: 62,
    codingScore: 58,
    writingScore: 64,
    visionScore: 0,
    embeddingScore: 0,
    latencyScore: 94,
    costScore: 97,
    healthScore: 97,
    availability: 0.98,
    supportsVision: false,
    supportsEmbedding: false,
    supportsJson: true,
    supportsStreaming: true,
    supportsToolCalling: true,
    tier: 'free',
  },
  'nvidia/llama-3.3-nemotron-super-49b-v1.5': {
    provider: 'nvidia',
    model: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
    parameters: '49b',
    contextWindow: 128000,
    maxTokens: 4096,
    capabilities: ['chat', 'reasoning', 'summarisation', 'extraction'],
    reasoningScore: 84,
    codingScore: 78,
    writingScore: 80,
    visionScore: 0,
    embeddingScore: 0,
    latencyScore: 78,
    costScore: 76,
    healthScore: 94,
    availability: 0.94,
    supportsVision: false,
    supportsEmbedding: false,
    supportsJson: true,
    supportsStreaming: true,
    supportsToolCalling: true,
    tier: 'free',
  },
  'openai/gpt-oss-20b': {
    provider: 'nvidia',
    model: 'openai/gpt-oss-20b',
    parameters: '20b',
    contextWindow: 128000,
    maxTokens: 4096,
    capabilities: ['chat', 'summarisation', 'classification', 'extraction'],
    reasoningScore: 72,
    codingScore: 68,
    writingScore: 74,
    visionScore: 0,
    embeddingScore: 0,
    latencyScore: 86,
    costScore: 88,
    healthScore: 95,
    availability: 0.95,
    supportsVision: false,
    supportsEmbedding: false,
    supportsJson: true,
    supportsStreaming: true,
    supportsToolCalling: true,
    tier: 'free',
  },


  // ═══════════════════════════════════════════════════════════════
  // Ollama — Local Fallback Provider
  // ═══════════════════════════════════════════════════════════════

  'llama3.2': {
    provider: 'ollama',
    model: 'llama3.2',
    parameters: '3b',
    contextWindow: 8192,
    maxTokens: 2048,
    capabilities: ['chat', 'summarisation', 'classification'],
    reasoningScore: 55,
    codingScore: 50,
    writingScore: 52,
    visionScore: 0,
    embeddingScore: 0,
    latencyScore: 95,
    costScore: 100,
    healthScore: 90,
    availability: 0.90,
    supportsVision: false,
    supportsEmbedding: false,
    supportsJson: false,
    supportsStreaming: true,
    supportsToolCalling: false,
    tier: 'free',
  },
  'mistral': {
    provider: 'ollama',
    model: 'mistral',
    parameters: '7b',
    contextWindow: 8192,
    maxTokens: 2048,
    capabilities: ['chat', 'summarisation'],
    reasoningScore: 58,
    codingScore: 55,
    writingScore: 56,
    visionScore: 0,
    embeddingScore: 0,
    latencyScore: 92,
    costScore: 100,
    healthScore: 88,
    availability: 0.88,
    supportsVision: false,
    supportsEmbedding: false,
    supportsJson: false,
    supportsStreaming: true,
    supportsToolCalling: false,
    tier: 'free',
  },

  // ═══════════════════════════════════════════════════════════════
  // Legacy Providers — Preserved for backward compatibility
  // ═══════════════════════════════════════════════════════════════

  // Cloudflare Workers AI — first failover behind NVIDIA. Tool calling is
  // model-dependent on Workers AI and unverified for this slug, so it is
  // declared false: capability gating may route a tool-using request past
  // this entry, which is the correct degradation. Flip it once confirmed
  // against a live account.
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast': {
    provider: 'cloudflare',
    model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    parameters: '70b',
    contextWindow: 24000,
    maxTokens: 2048,
    capabilities: ['chat', 'reasoning', 'summarisation', 'extraction'],
    reasoningScore: 78,
    codingScore: 70,
    writingScore: 76,
    visionScore: 0,
    embeddingScore: 0,
    latencyScore: 80,
    costScore: 95,
    healthScore: 90,
    availability: 0.9,
    supportsVision: false,
    supportsEmbedding: false,
    supportsJson: true,
    supportsStreaming: true,
    supportsToolCalling: false,
    tier: 'free',
  },

  'llama-3.3-70b-versatile': {
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    parameters: '70b',
    contextWindow: 128000,
    maxTokens: 2048,
    capabilities: ['chat', 'reasoning', 'summarisation', 'extraction'],
    reasoningScore: 80,
    codingScore: 72,
    writingScore: 78,
    visionScore: 0,
    embeddingScore: 0,
    latencyScore: 90,
    costScore: 85,
    healthScore: 98,
    availability: 0.98,
    supportsVision: false,
    supportsEmbedding: false,
    supportsJson: true,
    supportsStreaming: true,
    supportsToolCalling: true,
    tier: 'free',
  },
  // Both verified live 2026-07-28: real streaming, real native tool calls
  // confirmed via completeStreamRich(), and no reasoning_content emitted
  // (plain instruct models — see selectTierModel() in daxService.js for why
  // that matters).
  'openai/gpt-oss-20b': {
    provider: 'groq',
    model: 'openai/gpt-oss-20b',
    parameters: '20b',
    contextWindow: 128000,
    maxTokens: 8192,
    capabilities: ['chat', 'summarisation', 'classification', 'extraction'],
    reasoningScore: 78,
    codingScore: 74,
    writingScore: 76,
    visionScore: 0,
    embeddingScore: 0,
    latencyScore: 88,
    costScore: 92,
    healthScore: 96,
    availability: 0.96,
    supportsVision: false,
    supportsEmbedding: false,
    supportsJson: true,
    supportsStreaming: true,
    supportsToolCalling: true,
    tier: 'free',
  },
  'llama-3.1-8b-instant': {
    provider: 'groq',
    model: 'llama-3.1-8b-instant',
    parameters: '8b',
    contextWindow: 128000,
    maxTokens: 2048,
    capabilities: ['chat', 'summarisation', 'classification'],
    reasoningScore: 64,
    codingScore: 60,
    writingScore: 66,
    visionScore: 0,
    embeddingScore: 0,
    latencyScore: 97,
    costScore: 98,
    healthScore: 98,
    availability: 0.98,
    supportsVision: false,
    supportsEmbedding: false,
    supportsJson: true,
    supportsStreaming: true,
    supportsToolCalling: true,
    tier: 'free',
  },
  'gpt-4o-mini': {
    provider: 'openai',
    model: 'gpt-4o-mini',
    parameters: 'unknown',
    contextWindow: 128000,
    maxTokens: 16384,
    capabilities: ['chat', 'reasoning', 'coding', 'vision', 'summarisation', 'extraction', 'classification'],
    reasoningScore: 80,
    codingScore: 82,
    writingScore: 85,
    visionScore: 85,
    embeddingScore: 0,
    latencyScore: 85,
    costScore: 92,
    healthScore: 99,
    availability: 0.995,
    supportsVision: true,
    supportsEmbedding: false,
    supportsJson: true,
    supportsStreaming: true,
    supportsToolCalling: true,
    tier: 'paid',
  },
  'gpt-4o': {
    provider: 'openai',
    model: 'gpt-4o',
    parameters: 'unknown',
    contextWindow: 128000,
    maxTokens: 16384,
    capabilities: ['chat', 'reasoning', 'coding', 'vision', 'summarisation', 'extraction', 'classification', 'planning'],
    reasoningScore: 92,
    codingScore: 90,
    writingScore: 92,
    visionScore: 92,
    embeddingScore: 0,
    latencyScore: 75,
    costScore: 50,
    healthScore: 99,
    availability: 0.995,
    supportsVision: true,
    supportsEmbedding: false,
    supportsJson: true,
    supportsStreaming: true,
    supportsToolCalling: true,
    tier: 'paid',
  },
  'claude-sonnet-4-20250514': {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
    parameters: 'unknown',
    contextWindow: 200000,
    maxTokens: 8192,
    capabilities: ['chat', 'reasoning', 'coding', 'vision', 'summarisation', 'extraction', 'classification', 'planning'],
    reasoningScore: 95,
    codingScore: 93,
    writingScore: 95,
    visionScore: 90,
    embeddingScore: 0,
    latencyScore: 72,
    costScore: 35,
    healthScore: 99,
    availability: 0.99,
    supportsVision: true,
    supportsEmbedding: false,
    supportsJson: true,
    supportsStreaming: true,
    supportsToolCalling: true,
    tier: 'paid',
  },
  'gemini-2.0-flash': {
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    parameters: 'unknown',
    contextWindow: 1048576,
    maxTokens: 8192,
    capabilities: ['chat', 'reasoning', 'coding', 'vision', 'summarisation', 'extraction'],
    reasoningScore: 78,
    codingScore: 80,
    writingScore: 75,
    visionScore: 82,
    embeddingScore: 0,
    latencyScore: 92,
    costScore: 95,
    healthScore: 97,
    availability: 0.97,
    supportsVision: true,
    supportsEmbedding: false,
    supportsJson: true,
    supportsStreaming: true,
    supportsToolCalling: true,
    tier: 'free',
  },
};

// ── Capability → scoring dimensions weighting ──────────────────────
const CAPABILITY_SCORE_DIMENSIONS = {
  chat:          { writingScore: 0.25, reasoningScore: 0.20, latencyScore: 0.20, costScore: 0.20, healthScore: 0.15 },
  reasoning:     { reasoningScore: 0.50, codingScore: 0.10, writingScore: 0.05, latencyScore: 0.10, costScore: 0.10, healthScore: 0.15 },
  coding:        { codingScore: 0.50, reasoningScore: 0.20, latencyScore: 0.10, costScore: 0.10, healthScore: 0.10 },
  vision:        { visionScore: 0.50, reasoningScore: 0.15, latencyScore: 0.15, costScore: 0.10, healthScore: 0.10 },
  embeddings:    { embeddingScore: 0.60, latencyScore: 0.15, costScore: 0.15, healthScore: 0.10 },
  reranking:     { embeddingScore: 0.40, reasoningScore: 0.20, latencyScore: 0.20, costScore: 0.10, healthScore: 0.10 },
  summarisation: { writingScore: 0.35, reasoningScore: 0.15, latencyScore: 0.20, costScore: 0.15, healthScore: 0.15 },
  translation:   { writingScore: 0.30, reasoningScore: 0.15, latencyScore: 0.25, costScore: 0.15, healthScore: 0.15 },
  classification: { reasoningScore: 0.30, writingScore: 0.15, latencyScore: 0.25, costScore: 0.15, healthScore: 0.15 },
  extraction:    { reasoningScore: 0.30, writingScore: 0.15, latencyScore: 0.20, costScore: 0.15, healthScore: 0.20 },
  planning:      { reasoningScore: 0.40, writingScore: 0.10, latencyScore: 0.20, costScore: 0.15, healthScore: 0.15 },
  recommendation: { writingScore: 0.25, reasoningScore: 0.25, latencyScore: 0.20, costScore: 0.15, healthScore: 0.15 },
};

// ── Intent → capability category mappings ─────────────────────────
const INTENT_TO_CAPABILITY = {
  explain:       'chat',
  summarize:     'summarisation',
  teach:         'reasoning',
  coach:         'chat',
  review:        'extraction',
  compare:       'reasoning',
  research:      'extraction',
  generate:      'chat',
  reason:        'reasoning',
  brainstorm:    'chat',
  career:        'chat',
  resume:        'extraction',
  interview:     'reasoning',
  planner:       'planning',
  reflection:    'chat',
  motivation:    'chat',
  coding:        'coding',
  'knowledge-graph': 'extraction',
  administration: 'classification',
};

const CAPABILITY_WEIGHTS = {
  reasoning:  { reasoningScore: 1.0 },
  coding:     { codingScore: 1.0 },
  writing:    { writingScore: 1.0 },
  speed:      { latencyScore: 1.0 },
  cost:       { costScore: 1.0 },
  vision:     { visionScore: 1.0 },
  embedding:  { embeddingScore: 1.0 },
};

const INTENT_CAPABILITY_WEIGHTS = {
  explain:       { reasoningScore: 0.3, writingScore: 0.3, latencyScore: 0.2, costScore: 0.2 },
  summarize:     { writingScore: 0.4, reasoningScore: 0.2, latencyScore: 0.2, costScore: 0.2 },
  teach:         { reasoningScore: 0.3, writingScore: 0.3, costScore: 0.2, latencyScore: 0.2 },
  coach:         { reasoningScore: 0.3, writingScore: 0.2, latencyScore: 0.2, costScore: 0.3 },
  review:        { reasoningScore: 0.4, writingScore: 0.2, costScore: 0.2, latencyScore: 0.2 },
  compare:       { reasoningScore: 0.4, writingScore: 0.2, costScore: 0.2, latencyScore: 0.2 },
  research:      { reasoningScore: 0.4, writingScore: 0.2, costScore: 0.2, latencyScore: 0.2 },
  generate:      { writingScore: 0.3, reasoningScore: 0.2, latencyScore: 0.2, costScore: 0.3 },
  reason:        { reasoningScore: 0.5, costScore: 0.2, latencyScore: 0.3 },
  brainstorm:    { reasoningScore: 0.3, writingScore: 0.2, latencyScore: 0.2, costScore: 0.3 },
  career:        { reasoningScore: 0.3, writingScore: 0.3, costScore: 0.2, latencyScore: 0.2 },
  resume:        { writingScore: 0.3, reasoningScore: 0.3, costScore: 0.2, latencyScore: 0.2 },
  interview:     { reasoningScore: 0.3, writingScore: 0.2, latencyScore: 0.2, costScore: 0.3 },
  planner:       { reasoningScore: 0.3, writingScore: 0.2, latencyScore: 0.2, costScore: 0.3 },
  reflection:    { writingScore: 0.3, reasoningScore: 0.2, latencyScore: 0.2, costScore: 0.3 },
  motivation:    { writingScore: 0.3, reasoningScore: 0.2, latencyScore: 0.2, costScore: 0.3 },
  coding:        { codingScore: 0.5, reasoningScore: 0.3, latencyScore: 0.1, costScore: 0.1 },
  'knowledge-graph': { reasoningScore: 0.3, latencyScore: 0.3, costScore: 0.2, writingScore: 0.2 },
  administration: { writingScore: 0.3, latencyScore: 0.3, costScore: 0.2, reasoningScore: 0.2 },
};

// ── Helper functions ──────────────────────────────────────────────

function _val(v, fallback = 50) {
  return typeof v === 'number' ? v : fallback;
}

function getModel(modelKey) {
  return MODELS[modelKey] || null;
}

function findModelsByProvider(providerName) {
  return Object.entries(MODELS)
    .filter(([, m]) => m.provider === providerName)
    .map(([key, m]) => ({ key, ...m }));
}

function findModelsByCapability(capability) {
  return Object.entries(MODELS)
    .filter(([, m]) => m.capabilities && m.capabilities.includes(capability))
    .map(([key, m]) => ({ key, ...m }));
}

function scoreModelForCapability(modelKey, capability) {
  const model = MODELS[modelKey];
  if (!model) return 0;

  const weights = CAPABILITY_WEIGHTS[capability];
  if (!weights) return model.writingScore || 50;

  let score = 0;
  for (const [field, weight] of Object.entries(weights)) {
    if (field === 'visionScore') score += (model.supportsVision ? 100 : 0) * weight;
    else if (field === 'embeddingScore') score += (model.supportsEmbedding ? 100 : 0) * weight;
    else score += _val(model[field]) * weight;
  }
  return Math.round(score);
}

function computeCapabilityScore(modelKey, capabilityCategory) {
  const model = MODELS[modelKey];
  if (!model) return 0;

  const dims = CAPABILITY_SCORE_DIMENSIONS[capabilityCategory];
  if (!dims) return _val(model.writingScore);

  if (!model.capabilities || !model.capabilities.includes(capabilityCategory)) {
    return Math.round(_val(model[Object.keys(dims)[0]]) * 0.3);
  }

  let score = 0;
  for (const [field, weight] of Object.entries(dims)) {
    score += _val(model[field]) * weight;
  }
  return Math.round(score);
}

function scoreModelForIntent(modelKey, intent) {
  const model = MODELS[modelKey];
  if (!model) return 0;

  const weights = INTENT_CAPABILITY_WEIGHTS[intent];
  if (!weights) return _val(model.writingScore);

  let score = 0;
  for (const [field, weight] of Object.entries(weights)) {
    score += _val(model[field]) * weight;
  }
  return Math.round(score);
}

function rankModelsForCapability(capability, count = 3) {
  const scored = Object.keys(MODELS).map((key) => ({
    key,
    provider: MODELS[key].provider,
    model: MODELS[key].model,
    score: scoreModelForCapability(key, capability),
    capabilityScore: computeCapabilityScore(key, capability),
  }));
  return scored.sort((a, b) => b.capabilityScore - a.capabilityScore).slice(0, count);
}

function rankModelsForIntent(intent, count = 3) {
  const scored = Object.keys(MODELS).map((key) => ({
    key,
    provider: MODELS[key].provider,
    model: MODELS[key].model,
    score: scoreModelForIntent(key, intent),
  }));
  return scored.sort((a, b) => b.score - a.score).slice(0, count);
}

function findBestModelForCapability(capability) {
  const ranked = rankModelsForCapability(capability, 1);
  return ranked.length > 0 ? ranked[0] : null;
}

function findBestModelForIntent(intent) {
  const cap = INTENT_TO_CAPABILITY[intent];
  if (cap) {
    const byCap = findBestModelForCapability(cap);
    if (byCap && byCap.capabilityScore >= 50) return byCap;
  }
  const ranked = rankModelsForIntent(intent, 1);
  return ranked.length > 0 ? ranked[0] : null;
}

function autoSelectModel(intent, tier = 'free', { preferLowCost = false, preferSpeed = false } = {}) {
  const cap = INTENT_TO_CAPABILITY[intent] || 'chat';

  const candidates = Object.keys(MODELS)
    .map((key) => {
      const m = MODELS[key];
      if (tier === 'free' && m.tier === 'paid') return null;

      const capabilityScore = computeCapabilityScore(key, cap);
      const intentScore = scoreModelForIntent(key, intent);
      const providerCfg = cfg.providers[m.provider];
      if (!providerCfg) return null;
      if (m.provider !== 'ollama' && m.provider !== 'nvidia') {
        if (!providerCfg.apiKey) return null;
      }
      if (m.provider === 'nvidia' && !process.env.NVIDIA_API_KEY) return null;

      let finalScore = capabilityScore * 0.6 + intentScore * 0.4;

      if (preferLowCost) {
        finalScore = finalScore * 0.6 + _val(m.costScore) * 0.4;
      }
      if (preferSpeed) {
        finalScore = finalScore * 0.6 + _val(m.latencyScore) * 0.4;
      }

      return {
        key,
        provider: m.provider,
        model: m.model,
        capabilityScore,
        intentScore,
        finalScore,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.finalScore - a.finalScore);

  if (candidates.length === 0) {
    // findBestModelForIntent returns a different shape (no finalScore) —
    // normalize so callers reading .finalScore never see undefined.
    const fallback = findBestModelForIntent(intent);
    return fallback ? { ...fallback, finalScore: fallback.finalScore ?? 0 } : null;
  }

  return candidates[0];
}

function listAllModels() {
  return Object.entries(MODELS).map(([key, m]) => ({ key, ...m }));
}

function getAvailableModels() {
  return Object.entries(MODELS)
    .filter(([, m]) => {
      const providerCfg = cfg.providers[m.provider];
      if (!providerCfg) return false;
      if (m.provider === 'ollama') return true;
      if (m.provider === 'nvidia') return Boolean(process.env.NVIDIA_API_KEY);
      return Boolean(providerCfg.apiKey);
    })
    .map(([key, m]) => ({ key, ...m }));
}

function listModelsByCapability(capability) {
  return Object.entries(MODELS)
    .filter(([, m]) => m.capabilities && m.capabilities.includes(capability))
    .map(([key, m]) => ({
      key,
      provider: m.provider,
      model: m.model,
      capabilityScore: computeCapabilityScore(key, capability),
      ...m,
    }))
    .sort((a, b) => b.capabilityScore - a.capabilityScore);
}

module.exports = {
  MODELS,
  CAPABILITY_CATEGORIES,
  CAPABILITY_WEIGHTS,
  INTENT_CAPABILITY_WEIGHTS,
  INTENT_TO_CAPABILITY,
  CAPABILITY_SCORE_DIMENSIONS,
  getModel,
  findModelsByProvider,
  findModelsByCapability,
  scoreModelForCapability,
  computeCapabilityScore,
  scoreModelForIntent,
  rankModelsForCapability,
  rankModelsForIntent,
  findBestModelForCapability,
  findBestModelForIntent,
  autoSelectModel,
  listAllModels,
  getAvailableModels,
  listModelsByCapability,
};
