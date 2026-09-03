/**
 * Capability-driven task router.
 *
 * Routes each task to the best model using the ModelRegistry's
 * capability scoring system instead of hardcoded provider lists.
 *
 * Fallback chain:
 *   NVIDIA NIM → Ollama (local) → Error
 */

const cfg = require('../config/automation');
const { rankModelsForIntent, findBestModelForCapability, scoreModelForIntent } = require('./runtime-v2/modelRegistry');

const TASK_CAPABILITY = {
  'summarise-note':       'summarize',
  'news-summary':         'summarize',
  'moderation':           'administration',
  'resume-tip':           'resume',
  'daily-reflection':     'reflection',
  'daily-briefing':       'summarize',
  'daily-case':           'teach',
  'company-enrichment':   'research',
  'interview-questions':  'interview',
  'planner-suggest':      'planner',
  'chat':                 'explain',
  'review-resume':        'review',
  'career-advice':        'career',
  'case-framework':       'teach',
  'weekly-newsletter':    'generate',
  'fact-verify':          'reason',

  'flashcard-generate':   'generate',
  'quiz-generate':        'generate',
  'finance-assist':       'explain',
  'dashboard-insights':   'research',
  'company-research':     'research',
  'resume-ats':           'resume',
};

function routeTask(taskName) {
  const capability = TASK_CAPABILITY[taskName] || 'explain';

  const ranked = rankModelsForIntent(capability, 5);
  for (const model of ranked) {
    const providerCfg = cfg.providers[model.provider];
    if (!providerCfg) continue;
    if (model.provider === 'ollama') return model.provider;
    if (model.provider === 'nvidia' && process.env.NVIDIA_API_KEY) return model.provider;
    if (providerCfg.apiKey) return model.provider;
  }

  if (process.env.NVIDIA_API_KEY) return 'nvidia';
  return 'ollama';
}

function estimateCost(provider, promptTokens = 0, completionTokens = 0) {
  const costScores = {
    nvidia:  { input: 0.35, output: 0.45 },
    ollama:  { input: 0,    output: 0    },
    groq:    { input: 0.59, output: 0.79 },
    openai:  { input: 0.15, output: 0.60 },
    gemini:  { input: 0.075, output: 0.30 },
    openrouter: { input: 0.59, output: 0.79 },
    // Cloudflare Workers AI bills in "neurons", not tokens — these are a
    // token-denominated approximation for llama-3.3-70b-fp8-fast so metering
    // records a non-zero cost. Without an entry here the default placeholder
    // rate rounds to $0.000000 and Cloudflare usage bills as free.
    // TODO: reconcile against the Workers AI pricing page / neuron rate.
    cloudflare: { input: 0.29, output: 2.25 },
  };
  const rates = costScores[provider] || { input: 0.005, output: 0.015 };
  return (promptTokens / 1_000_000) * rates.input + (completionTokens / 1_000_000) * rates.output;
}

module.exports = { routeTask, estimateCost, TASK_CAPABILITY };
