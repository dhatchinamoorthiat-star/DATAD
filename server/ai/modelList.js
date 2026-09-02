const cfg = require('../config/automation');
const { buildProvider } = require('./providers');

// Every id here is verified against NVIDIA's live catalogue
// (GET https://integrate.api.nvidia.com/v1/models) AND confirmed to return
// a real completion when probed directly against this account's key.
// Being in the catalogue is necessary but NOT sufficient — some listed
// models 404/410 for this key, and some large ones never return in time.
// Both make the picker look broken, so re-probe before adding an entry.
//
// Re-check with: node scripts/verifyModelRegistry.js
//
// Full sweep of all 30 previously-registered NVIDIA models, run
// 2026-07-27 against this account's (rotated) key — only these 7 answered:
//   410 Gone (retired)   → meta/llama-4-maverick-17b-128e-instruct
//                          qwen/qwen3-next-80b-a3b-instruct
//                          qwen/qwen3.5-397b-a17b
//                          mistralai/mistral-large-3-675b-instruct-2512
//                          minimaxai/minimax-m2.7
//                          google/gemma-2-2b-it
//                          sarvamai/sarvam-m
//   404 (wrong/stale id) → nvidia/llama-3.1-nemotron-70b-instruct
//                          nvidia/nemotron-4-340b-instruct
//                          mistralai/codestral-22b-instruct-v0.1
//                          google/gemma-3-12b-it
//                          meta/codellama-70b, nvidia/cosmos-reason2-8b
//                          all 3 embedding-only ids (wrong endpoint shape)
//                          bigcode/starcoder2-15b
//   timed out (15-20s)   → deepseek-ai/deepseek-v4-pro
//                          meta/llama-3.3-70b-instruct
//                          google/gemma-4-31b-it, z-ai/glm-5.2
//                          openai/gpt-oss-120b
const NVIDIA_MODELS_DISPLAY = [
  { model: 'meta/llama-3.1-8b-instruct', label: 'Llama 3.1 8B', description: 'Fast, lightweight default' },
  { model: 'deepseek-ai/deepseek-v4-flash', label: 'DeepSeek V4 Flash', description: 'Fast reasoning' },
  { model: 'meta/llama-3.1-70b-instruct', label: 'Llama 3.1 70B', description: 'Balanced reasoning' },
  { model: 'nvidia/nemotron-3-super-120b-a12b', label: 'Nemotron 3 Super', description: 'NVIDIA flagship' },
  { model: 'nvidia/nemotron-3-nano-30b-a3b', label: 'Nemotron 3 Nano', description: 'Fast, lightweight' },
  { model: 'nvidia/llama-3.3-nemotron-super-49b-v1.5', label: 'Nemotron Super 49B', description: 'Strong reasoning, fast' },
  { model: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B', description: 'Open-weight, broad knowledge' },
].map((m) => ({ ...m, id: `nvidia:${m.model}`, provider: 'nvidia' }));

const HUMAN_LABELS = {
  groq: 'Groq',
  openai: 'OpenAI',
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
