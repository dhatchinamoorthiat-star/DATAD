const cfg = require('../config/automation');
const { buildProvider } = require('./providers');

// Every id here is verified against NVIDIA's live catalogue
// (GET https://integrate.api.nvidia.com/v1/models). Model names that don't
// exist upstream fail the request outright and make the picker look broken,
// so re-check this list against that endpoint before adding entries.
// Only models confirmed to actually answer on this NVIDIA account. Every id
// is in the live catalogue AND returned a real completion when probed.
//
// Re-check with: node scripts/verifyModelRegistry.js  (catalogue presence)
// Being in the catalogue is necessary but NOT sufficient — some listed models
// 404 for a given key, and some very large ones never return in time. Both
// make the picker look broken, so probe before adding.
//
// Deliberately excluded (verified failing on this key, 2026-07-20):
//   404 / not enabled  → mistralai/codestral-22b-instruct-v0.1
//                        nvidia/llama-3.1-nemotron-70b-instruct
//                        nvidia/llama-3.1-nemotron-ultra-253b-v1
//   hangs (>45s)       → meta/llama-3.3-70b-instruct
//                        meta/llama-4-maverick-17b-128e-instruct
//                        qwen/qwen3.5-397b-a17b
//                        mistralai/mistral-large-3-675b-instruct-2512
//                        z-ai/glm-5.2
const NVIDIA_MODELS_DISPLAY = [
  { model: 'meta/llama-3.1-8b-instruct', label: 'Llama 3.1 8B', description: 'Fast, lightweight default' },
  { model: 'deepseek-ai/deepseek-v4-flash', label: 'DeepSeek V4 Flash', description: 'Fast reasoning' },
  { model: 'deepseek-ai/deepseek-v4-pro', label: 'DeepSeek V4 Pro', description: 'High quality reasoning' },
  { model: 'qwen/qwen3-next-80b-a3b-instruct', label: 'Qwen 3 Next', description: 'Efficient general model' },
  { model: 'nvidia/nemotron-3-super-120b-a12b', label: 'Nemotron 3 Super', description: 'NVIDIA flagship' },
  { model: 'minimaxai/minimax-m2.7', label: 'MiniMax M2.7', description: 'Long-form generation' },
  { model: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B', description: 'Open-weight, broad knowledge' },
].map((m) => ({ ...m, id: `nvidia:${m.model}`, provider: 'nvidia' }));

const HUMAN_LABELS = {
  groq: 'Groq',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
  openrouter: 'OpenRouter',
  ollama: 'Ollama (Local)',
  nvidia: 'NVIDIA NIM',
};

function getAvailableModels() {
  const models = [];

  for (const [providerName, providerCfg] of Object.entries(cfg.providers)) {
    if (typeof providerCfg !== 'object' || !providerCfg.apiKey) continue;

    const name = providerName;

    if (name === 'nvidia') {
      for (const m of NVIDIA_MODELS_DISPLAY) {
        models.push({
          id: m.id,
          provider: m.provider,
          model: m.model,
          label: m.label,
          description: m.description,
          group: HUMAN_LABELS.nvidia,
        });
      }
    } else if (name === 'ollama') {
      // Ollama's key is a hardcoded placeholder, so it always looks
      // "available" — on a deployed host with no local daemon it would appear
      // in the picker and fail for anyone who chose it. Only offer it as a
      // choice when a base URL was set deliberately. It stays in the failover
      // chain regardless; this only controls whether users can select it.
      if (!process.env.OLLAMA_BASE_URL) continue;
      models.push({
        id: 'ollama:default',
        provider: 'ollama',
        model: providerCfg.model || 'llama3.2',
        label: 'Ollama Local',
        description: 'Local model via Ollama',
        group: HUMAN_LABELS.ollama,
      });
    } else {
      try {
        const p = buildProvider(name);
        if (!p.isAvailable()) continue;
      } catch {
        continue;
      }

      models.push({
        id: `${name}:${providerCfg.model}`,
        provider: name,
        model: providerCfg.model,
        label: providerCfg.model,
        description: `via ${HUMAN_LABELS[name] || name}`,
        group: HUMAN_LABELS[name] || name,
      });
    }
  }

  return models;
}

function getDefaultModelId() {
  return `nvidia:${cfg.providers.nvidia.model || 'meta/llama-3.1-8b-instruct'}`;
}

function parseModelId(modelId) {
  const idx = modelId.indexOf(':');
  if (idx === -1) return null;
  return { provider: modelId.slice(0, idx), model: modelId.slice(idx + 1) };
}

module.exports = { getAvailableModels, getDefaultModelId, parseModelId };
