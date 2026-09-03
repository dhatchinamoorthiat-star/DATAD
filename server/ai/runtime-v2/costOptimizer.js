const { getAvailableModels } = require('./modelRegistry');
const { computeRequiredCapabilities, findBestModels } = require('./capabilityEngine');

const MODEL_COST_PROFILES = {
  // NVIDIA NIM — per-model credit costs (free tier, credit-based)
  'deepseek-ai/deepseek-v4-flash': { tier: 'budget', costPerRequest: 0.00008, costScore: 92 },
  'deepseek-ai/deepseek-v4-pro': { tier: 'moderate', costPerRequest: 0.00015, costScore: 88 },
  'deepseek-ai/deepseek-r1': { tier: 'premium', costPerRequest: 0.0004, costScore: 60 },
  'deepseek-ai/deepseek-r1-distill-llama-8b': { tier: 'budget', costPerRequest: 0.00003, costScore: 98 },
  'deepseek-ai/deepseek-r1-distill-llama-70b': { tier: 'budget', costPerRequest: 0.00006, costScore: 95 },
  'deepseek-ai/deepseek-r1-distill-qwen-32b': { tier: 'budget', costPerRequest: 0.00005, costScore: 96 },
  'meta/llama-3.3-70b-instruct': { tier: 'budget', costPerRequest: 0.00006, costScore: 95 },
  'meta/llama-3.1-8b-instruct': { tier: 'free', costPerRequest: 0.00002, costScore: 100 },
  'meta/llama-3.1-70b-instruct': { tier: 'budget', costPerRequest: 0.00006, costScore: 95 },
  'meta/llama-4-maverick': { tier: 'moderate', costPerRequest: 0.00012, costScore: 88 },
  'nvidia/llama-3.1-nemotron-70b-instruct': { tier: 'budget', costPerRequest: 0.00006, costScore: 94 },
  'nvidia/nemotron-3-super-120b-a12b': { tier: 'budget', costPerRequest: 0.00008, costScore: 92 },
  'nvidia/nemotron-3-nano': { tier: 'free', costPerRequest: 0.00002, costScore: 100 },
  'nvidia/llama-3.3-nemotron-super-49b-v1.5': { tier: 'budget', costPerRequest: 0.00006, costScore: 94 },
  'nvidia/nemotron-4-340b-instruct': { tier: 'premium', costPerRequest: 0.00035, costScore: 55 },
  'qwen/qwen3-coder-480b-a35b-instruct': { tier: 'moderate', costPerRequest: 0.0001, costScore: 90 },
  'qwen/qwen-3.5': { tier: 'budget', costPerRequest: 0.00008, costScore: 92 },
  'mistralai/mistral-large-3': { tier: 'budget', costPerRequest: 0.00007, costScore: 93 },
  'mistralai/devstral-2-123b': { tier: 'budget', costPerRequest: 0.00007, costScore: 93 },
  'minimax/minimax-m2.7-230b': { tier: 'moderate', costPerRequest: 0.0001, costScore: 90 },
  'google/gemma-4-31b-it': { tier: 'budget', costPerRequest: 0.00004, costScore: 97 },
  'google/gemma-2-2b-it': { tier: 'free', costPerRequest: 0.00001, costScore: 100 },
  'google/gemma-2-9b-it': { tier: 'free', costPerRequest: 0.00002, costScore: 100 },
  'glm-5/glm-5': { tier: 'premium', costPerRequest: 0.00045, costScore: 52 },
  'glm-5/glm-5.2': { tier: 'premium', costPerRequest: 0.0005, costScore: 50 },
  'openai/gpt-oss-120b': { tier: 'moderate', costPerRequest: 0.00012, costScore: 86 },
  'openai/gpt-oss-20b': { tier: 'budget', costPerRequest: 0.00005, costScore: 96 },
  'nvidia/nv-embedqa-e5-v5': { tier: 'free', costPerRequest: 0.00001, costScore: 100 },
  'nvidia/bge-m3': { tier: 'free', costPerRequest: 0.00001, costScore: 100 },
  'nvidia/nv-embedcode-7b-v1': { tier: 'free', costPerRequest: 0.00001, costScore: 100 },
  'bigcode/starcoder2-7b': { tier: 'free', costPerRequest: 0.00002, costScore: 100 },
  'meta/codellama-13b-instruct': { tier: 'free', costPerRequest: 0.00002, costScore: 100 },
  'meta/codellama-34b-instruct': { tier: 'budget', costPerRequest: 0.00003, costScore: 98 },
  'meta/codellama-70b-instruct': { tier: 'budget', costPerRequest: 0.00005, costScore: 96 },
  'nvidia/cosmos-reason2-8b': { tier: 'budget', costPerRequest: 0.00004, costScore: 97 },
  'nvidia/cosmos-transfer1-7b': { tier: 'budget', costPerRequest: 0.00004, costScore: 97 },
  'nvidia/cosmos3-nano': { tier: 'free', costPerRequest: 0.00002, costScore: 100 },
  'nvidia/cosmos3-nano-reasoner': { tier: 'free', costPerRequest: 0.00002, costScore: 100 },
  'sarvamai/sarvam-m': { tier: 'free', costPerRequest: 0.00002, costScore: 100 },
  'utter-project/eurollm-9b-instruct': { tier: 'free', costPerRequest: 0.00002, costScore: 100 },
  'speakleash/bielik-11b-v2.3-instruct': { tier: 'free', costPerRequest: 0.00002, costScore: 100 },
  // Ollama
  'llama3.2': { tier: 'free', costPerRequest: 0, costScore: 100 },
  'mistral': { tier: 'free', costPerRequest: 0, costScore: 100 },
  // Legacy
  'gpt-4o-mini': { tier: 'moderate', costPerRequest: 0.0005, costScore: 60 },
  'gpt-4o': { tier: 'premium', costPerRequest: 0.002, costScore: 20 },
  'claude-sonnet-4-20250514': { tier: 'premium', costPerRequest: 0.003, costScore: 15 },
  // Removed 2026-08-18: llama-3.3-70b-versatile, llama-3.1-8b-instant and
  // gemini-2.0-flash are no longer served on this account.
  'gemini-flash-lite-latest': { tier: 'budget', costPerRequest: 0.00005, costScore: 95 },
  'openai/gpt-oss-120b': { tier: 'budget', costPerRequest: 0.0001, costScore: 88 },
};

function selectCheapestModels(capabilities, availableModels, intent) {
  const candidates = findBestModels(capabilities, availableModels, 20);

  return candidates
    .map((c) => ({
      ...c,
      costScore: MODEL_COST_PROFILES[c.key]?.costScore || c.capabilities?.costScore || 50,
    }))
    .filter((c) => c.costScore >= 30)
    .sort((a, b) => b.costScore - a.costScore)
    .slice(0, 5);
}

function estimateCost({ provider, model, promptTokens, completionTokens, estimatedCostUsd }) {
  let costPer1kPrompt = 0;
  let costPer1kCompletion = 0;

  const modelProfile = MODEL_COST_PROFILES[model];
  if (modelProfile) {
    costPer1kPrompt = modelProfile.costPerRequest * 10;
    costPer1kCompletion = modelProfile.costPerRequest * 15;
    const estimatedPrompt = (promptTokens || 0) / 1000 * costPer1kPrompt;
    const estimatedCompletion = (completionTokens || 0) / 1000 * costPer1kCompletion;
    return estimatedCostUsd || parseFloat((estimatedPrompt + estimatedCompletion).toFixed(6));
  }

  switch (provider) {
    case 'nvidia':
      costPer1kPrompt = 0.00035;
      costPer1kCompletion = 0.00045;
      break;
    case 'ollama':
      costPer1kPrompt = 0;
      costPer1kCompletion = 0;
      break;
    case 'openai':
      costPer1kPrompt = model?.includes('gpt-4') ? 0.03 : 0.01;
      costPer1kCompletion = model?.includes('gpt-4') ? 0.06 : 0.02;
      break;
    case 'groq':
      costPer1kPrompt = 0.001;
      costPer1kCompletion = 0.002;
      break;
    case 'gemini':
      costPer1kPrompt = 0.001;
      costPer1kCompletion = 0.002;
      break;
    case 'cohere':
      costPer1kPrompt = 0.005;
      costPer1kCompletion = 0.015;
      break;
    case 'mistral':
      costPer1kPrompt = 0.002;
      costPer1kCompletion = 0.006;
      break;
    default:
      costPer1kPrompt = 0.005;
      costPer1kCompletion = 0.015;
  }

  const estimatedPrompt = (promptTokens || 0) / 1000 * costPer1kPrompt;
  const estimatedCompletion = (completionTokens || 0) / 1000 * costPer1kCompletion;

  return estimatedCostUsd || parseFloat((estimatedPrompt + estimatedCompletion).toFixed(6));
}

function getCostProfile(provider, model) {
  if (model && MODEL_COST_PROFILES[model]) {
    return MODEL_COST_PROFILES[model];
  }

  switch (provider) {
    case 'nvidia': return { tier: 'budget', costPerRequest: 0.0001, costScore: 88 };
    case 'ollama': return { tier: 'free', costPerRequest: 0, costScore: 100 };
    case 'groq': return { tier: 'budget', costPerRequest: 0.00005, costScore: 95 };
    case 'gemini': return { tier: 'budget', costPerRequest: 0.00005, costScore: 90 };
    case 'mistral': return { tier: 'budget', costPerRequest: 0.00015, costScore: 85 };
    case 'cohere': return { tier: 'moderate', costPerRequest: 0.0005, costScore: 70 };
    case 'openai':
      if (model?.includes('gpt-4')) return { tier: 'premium', costPerRequest: 0.002, costScore: 20 };
      return { tier: 'moderate', costPerRequest: 0.0005, costScore: 60 };
    default: return { tier: 'moderate', costPerRequest: 0.0005, costScore: 50 };
  }
}

// Credit weight of one request on a given model, for tier-based metering.
// Derived from costScore (100 = cheapest): cheap 8B-class models cost 1
// credit, mid-range 2-3, premium (GPT-4/Claude-class) up to 5. Unknown
// models charge the minimum so a registry gap never over-bills a student.
function getCreditCost(model, provider) {
  const profile = getCostProfile(provider, model);
  const score = typeof profile.costScore === 'number' ? profile.costScore : 100;
  const credits = Math.round((100 - score) / 20) + 1;
  return Math.max(1, Math.min(5, credits));
}

module.exports = {
  MODEL_COST_PROFILES,
  selectCheapestModels,
  estimateCost,
  getCostProfile,
  getCreditCost,
};
