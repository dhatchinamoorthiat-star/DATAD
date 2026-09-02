const cfg = require('../../config/automation');
const NvidiaProvider = require('./nvidiaProvider');
const OpenAICompatibleProvider = require('./openaiCompatible');

const providers = {};

function buildProvider(name) {
  if (providers[name]) return providers[name];
  const c = cfg.providers[name];
  if (!c) throw new Error(`Unknown AI provider: ${name}`);

  if (name === 'nvidia') {
    providers[name] = new NvidiaProvider({ ...c, name });
  } else {
    providers[name] = new OpenAICompatibleProvider({ ...c, name });
  }
  return providers[name];
}

// Failover order. Groq is primary — verified 2026-07-28 as the fastest and
// most reliable of the free-tier options (see server/scripts if present, or
// the account-level testing that prompted this reorder). NVIDIA was primary
// before this: repeatedly rate-limited under real load (observed "Worker
// local total request limit reached") and its reasoning-capable models
// (nemotron etc.) can silently truncate replies when chain-of-thought eats
// the shared token budget — a class of bug that doesn't affect the plain
// instruct models used here. NVIDIA stays in the chain as a backup.
//
// Ollama is deliberately LAST despite being the configured fallback: its key
// is a hardcoded placeholder (config/automation.js), so isAvailable() is true
// even with no local daemon running. Sitting early in the chain, a dead Ollama
// absorbed every prior failure and stalled the request before it could reach
// a working cloud backup.
const PROVIDER_ORDER = [
  'groq',        // primary — fastest and most reliable free-tier option tested
  'cloudflare',  // first backup — open-weights, generous free tier
  'nvidia',      // cloud backups, in preference order
  'openrouter',
  'gemini',
  'openai',
  'ollama',      // local last resort — may not be running at all
];

function _candidateOrder(preferredName) {
  return [
    preferredName,
    cfg.providers.primary,
    ...PROVIDER_ORDER,
    cfg.providers.fallback,
  ].filter(Boolean);
}

/**
 * Returns the best available provider.
 * Fallback chain: PROVIDER_ORDER above, first statically-available wins.
 *
 * "Available" here means isAvailable() — a static check (does this provider
 * have a key configured), not a live reachability probe. Ollama's key is a
 * hardcoded placeholder (see config/automation.js), so it reports available
 * even when no local Ollama daemon is running. Callers that only try the
 * single provider getProvider() returns have no protection against that —
 * use getProviderChain() below when the call site can retry across
 * candidates on a real failure.
 */
function getProvider(preferredName) {
  for (const name of _candidateOrder(preferredName)) {
    try {
      const p = buildProvider(name);
      if (p.isAvailable()) return p;
    } catch (_) { /* skip unknown */ }
  }
  throw new Error(
    'No AI provider available. Set NVIDIA_API_KEY or ensure Ollama is running locally.'
  );
}

/**
 * Same ordering as getProvider(), but returns every statically-available
 * candidate (not just the first) so a caller can fall through to the next
 * one if a real call fails — protects against the isAvailable()-passes-but-
 * unreachable case described above (e.g. Ollama configured but not running).
 */
function getProviderChain(preferredName) {
  const chain = [];
  for (const name of _candidateOrder(preferredName)) {
    try {
      const p = buildProvider(name);
      if (p.isAvailable() && !chain.includes(p)) chain.push(p);
    } catch (_) { /* skip unknown */ }
  }
  return chain;
}

function clearCache() {
  Object.keys(providers).forEach((key) => delete providers[key]);
}

module.exports = { getProvider, getProviderChain, buildProvider, clearCache };
