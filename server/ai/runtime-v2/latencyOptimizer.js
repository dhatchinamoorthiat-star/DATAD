const { getAvailableModels, MODELS } = require('./modelRegistry');
const { computeRequiredCapabilities, findBestModels } = require('./capabilityEngine');

const MODEL_LATENCY_PROFILES = {
  // NVIDIA NIM
  'deepseek-ai/deepseek-v4-flash': { avgResponseMs: 550, latencyScore: 90 },
  'deepseek-ai/deepseek-v4-pro': { avgResponseMs: 900, latencyScore: 76 },
  'deepseek-ai/deepseek-r1': { avgResponseMs: 2500, latencyScore: 40 },
  'deepseek-ai/deepseek-r1-distill-llama-8b': { avgResponseMs: 350, latencyScore: 96 },
  'deepseek-ai/deepseek-r1-distill-llama-70b': { avgResponseMs: 700, latencyScore: 85 },
  'deepseek-ai/deepseek-r1-distill-qwen-32b': { avgResponseMs: 600, latencyScore: 88 },
  'meta/llama-3.3-70b-instruct': { avgResponseMs: 650, latencyScore: 86 },
  'meta/llama-3.1-8b-instruct': { avgResponseMs: 300, latencyScore: 97 },
  'meta/llama-3.1-70b-instruct': { avgResponseMs: 700, latencyScore: 84 },
  'meta/llama-4-maverick': { avgResponseMs: 1100, latencyScore: 68 },
  'nvidia/llama-3.1-nemotron-70b-instruct': { avgResponseMs: 750, latencyScore: 82 },
  'nvidia/nemotron-3-super-120b-a12b': { avgResponseMs: 650, latencyScore: 86 },
  'nvidia/nemotron-3-nano': { avgResponseMs: 280, latencyScore: 98 },
  'nvidia/llama-3.3-nemotron-super-49b-v1.5': { avgResponseMs: 700, latencyScore: 84 },
  'nvidia/nemotron-4-340b-instruct': { avgResponseMs: 1800, latencyScore: 50 },
  'qwen/qwen3-coder-480b-a35b-instruct': { avgResponseMs: 750, latencyScore: 82 },
  'qwen/qwen-3.5': { avgResponseMs: 800, latencyScore: 80 },
  'mistralai/mistral-large-3': { avgResponseMs: 720, latencyScore: 83 },
  'mistralai/devstral-2-123b': { avgResponseMs: 650, latencyScore: 86 },
  'minimax/minimax-m2.7-230b': { avgResponseMs: 900, latencyScore: 76 },
  'google/gemma-4-31b-it': { avgResponseMs: 500, latencyScore: 92 },
  'google/gemma-2-2b-it': { avgResponseMs: 200, latencyScore: 99 },
  'google/gemma-2-9b-it': { avgResponseMs: 350, latencyScore: 96 },
  'glm-5/glm-5': { avgResponseMs: 2800, latencyScore: 35 },
  'glm-5/glm-5.2': { avgResponseMs: 3000, latencyScore: 32 },
  'openai/gpt-oss-120b': { avgResponseMs: 900, latencyScore: 76 },
  'openai/gpt-oss-20b': { avgResponseMs: 500, latencyScore: 92 },
  'nvidia/nv-embedqa-e5-v5': { avgResponseMs: 200, latencyScore: 99 },
  'nvidia/bge-m3': { avgResponseMs: 250, latencyScore: 98 },
  'nvidia/nv-embedcode-7b-v1': { avgResponseMs: 250, latencyScore: 98 },
  'bigcode/starcoder2-7b': { avgResponseMs: 300, latencyScore: 97 },
  'meta/codellama-13b-instruct': { avgResponseMs: 400, latencyScore: 95 },
  'meta/codellama-34b-instruct': { avgResponseMs: 600, latencyScore: 88 },
  'meta/codellama-70b-instruct': { avgResponseMs: 800, latencyScore: 80 },
  'nvidia/cosmos-reason2-8b': { avgResponseMs: 600, latencyScore: 88 },
  'nvidia/cosmos-transfer1-7b': { avgResponseMs: 700, latencyScore: 84 },
  'nvidia/cosmos3-nano': { avgResponseMs: 350, latencyScore: 96 },
  'nvidia/cosmos3-nano-reasoner': { avgResponseMs: 450, latencyScore: 94 },
  'sarvamai/sarvam-m': { avgResponseMs: 400, latencyScore: 95 },
  'utter-project/eurollm-9b-instruct': { avgResponseMs: 400, latencyScore: 95 },
  'speakleash/bielik-11b-v2.3-instruct': { avgResponseMs: 400, latencyScore: 95 },
  // Ollama
  'llama3.2': { avgResponseMs: 300, latencyScore: 95 },
  'mistral': { avgResponseMs: 350, latencyScore: 92 },
};

const PROVIDER_LATENCY_PROFILES = {
  nvidia: { avgResponseMs: 600, tier: 'fast', latencyScore: 88 },
  ollama: { avgResponseMs: 300, tier: 'fast', latencyScore: 95 },
  groq: { avgResponseMs: 400, tier: 'fast', latencyScore: 95 },
  gemini: { avgResponseMs: 600, tier: 'fast', latencyScore: 85 },
  mistral: { avgResponseMs: 800, tier: 'moderate', latencyScore: 75 },
  openai: { avgResponseMs: 1200, tier: 'moderate', latencyScore: 60 },
  cohere: { avgResponseMs: 1000, tier: 'moderate', latencyScore: 55 },
};

function selectFastestModels(capabilities, availableModels, intent) {
  const candidates = findBestModels(capabilities, availableModels, 20);

  return candidates
    .map((c) => {
      const modelProfile = MODEL_LATENCY_PROFILES[c.key];
      if (modelProfile) {
        return { ...c, ...modelProfile };
      }
      const profile = PROVIDER_LATENCY_PROFILES[c.provider] || { avgResponseMs: 1000, latencyScore: 50 };
      return { ...c, avgResponseMs: profile.avgResponseMs, latencyScore: profile.latencyScore };
    })
    .filter((c) => c.latencyScore >= 30)
    .sort((a, b) => a.avgResponseMs - b.avgResponseMs)
    .slice(0, 5);
}

function estimateLatency(provider, model) {
  if (model && MODEL_LATENCY_PROFILES[model]) {
    return MODEL_LATENCY_PROFILES[model].avgResponseMs;
  }
  const profile = PROVIDER_LATENCY_PROFILES[provider];
  if (!profile) return 1000;
  return profile.avgResponseMs;
}

function getLatencyProfile(provider, model) {
  if (model && MODEL_LATENCY_PROFILES[model]) {
    return MODEL_LATENCY_PROFILES[model];
  }
  return PROVIDER_LATENCY_PROFILES[provider] || { avgResponseMs: 1000, tier: 'unknown', latencyScore: 50 };
}

module.exports = {
  MODEL_LATENCY_PROFILES,
  PROVIDER_LATENCY_PROFILES,
  selectFastestModels,
  estimateLatency,
  getLatencyProfile,
};
