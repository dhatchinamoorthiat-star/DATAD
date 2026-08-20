/**
 * Model equivalence across providers — keeping the capability contract intact
 * when the failover chain reroutes a request.
 *
 * The problem this solves: aiGateway's streaming loop passes the requested
 * model only to the provider that was asked for. On failover, the model goes
 * `undefined` and the next provider silently uses whatever its own config
 * names. A student on `openai/gpt-oss-20b` (reasoning 78, write tools ON) who
 * trips a Groq quota can land on a model at reasoning 64, and write tools
 * disappear mid-conversation with nothing said. That is not a fallback, it is
 * an unannounced product change.
 *
 * NOTE ON NAMING: "tier" already means the student's subscription in this
 * codebase (free / pro / placement — see daxService.selectTierModel). This
 * module deals with model CAPABILITY CLASS, which is a different axis, so it
 * deliberately avoids the word tier.
 *
 * Nothing here invents model slugs. Every mapping below is a key that exists
 * in runtime-v2/modelRegistry.js, and the module asserts that at load time —
 * a mistyped slug would otherwise reach a provider as a 404 (classified
 * bad_request, which correctly does NOT bench the provider, so it would fail
 * the request rather than reroute it).
 */

const modelRegistry = require('./runtime-v2/modelRegistry');

// ── Capability classes ──────────────────────────────────────────────────────
// Boundaries are reasoningScore thresholds. 78 is not arbitrary: it is the
// write-tool gate (ai/tools/index.js MIN_WRITE_REASONING), so "balanced" means
// exactly "can be trusted to propose writes".
const CLASS_THRESHOLDS = [
  ['deep', 84],
  ['balanced', 78],
  ['fast', 0],
];

/**
 * Models that score well but misbehave with tools attached.
 *
 * llama-3.3-70b-versatile (reasoning 80) was demoted out of the 'max' default
 * on 2026-07-28 after live testing caught it writing raw `<function=name>{...}`
 * pseudo-syntax into the visible reply instead of using the API's tool_calls
 * mechanism — leaking malformed text straight to the student. The registry
 * scores capability, not that failure mode, so it has to be recorded here or
 * failover would happily route a tool-carrying request onto it.
 * See daxService.selectTierModel for the original finding.
 */
const TOOL_UNSAFE = new Set(['llama-3.3-70b-versatile']);

/**
 * Preferred model per provider per class.
 *
 * Only providers with a registry entry appear. openrouter is deliberately
 * absent: it has no registry entries at all, so there is nothing truthful to
 * map it to, and resolve() falls back to its configured default rather than
 * guessing a slug.
 */
const PREFERRED = {
  deep: {
    nvidia: 'nvidia/nemotron-3-super-120b-a12b',
    openai: 'gpt-4o',
    anthropic: 'claude-sonnet-4-20250514',
  },
  balanced: {
    nvidia: 'meta/llama-3.1-70b-instruct',
    groq: 'openai/gpt-oss-20b',
    cloudflare: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    openai: 'gpt-4o-mini',
    // Restored 2026-08-18 once gemini-flash-lite-latest was probed live and
    // added to the registry. The previous entry (gemini-2.0-flash) 404'd, so
    // mapping it would have replaced a working call with a broken one. This
    // slug answered 4/4 on an objective probe and returned a well-formed
    // tool_calls response, so it is a genuine balanced-class failover target
    // rather than a fallback to the provider default.
    gemini: 'gemini-flash-lite-latest',
  },
  fast: {
    nvidia: 'meta/llama-3.1-8b-instruct',
    ollama: 'llama3.2',
    // groq is absent for the same reason: llama-3.1-8b-instant 404s on this
    // account (verified live 2026-08-18). Groq's only reachable model here is
    // openai/gpt-oss-20b, which is balanced-class, so a fast-class request
    // routed to Groq correctly finds nothing and uses its configured default.
  },
};

/** Fail loudly at boot rather than at 3am on a student's request. */
function _assertRegistryBacked() {
  const bad = [];
  for (const [cls, byProvider] of Object.entries(PREFERRED)) {
    for (const [provider, model] of Object.entries(byProvider)) {
      const meta = modelRegistry.getModel(model);
      if (!meta) bad.push(`${cls}.${provider} -> "${model}" (not in registry)`);
      else if (meta.provider !== provider) bad.push(`${cls}.${provider} -> "${model}" (registry says provider=${meta.provider})`);
    }
  }
  if (bad.length) {
    throw new Error(`[modelEquivalence] mapping does not match the model registry:\n  ${bad.join('\n  ')}`);
  }
}
_assertRegistryBacked();

/**
 * Capability class of a model. Unknown models return null rather than a guess —
 * openrouter's configured default and gemini-flash-lite-latest are both absent
 * from the registry, and pretending to know their class would be worse than
 * admitting we don't.
 */
function classOf(modelName) {
  if (!modelName) return null;
  const meta = modelRegistry.getModel(modelName);
  if (!meta) return null;
  const score = meta.reasoningScore || 0;
  for (const [cls, min] of CLASS_THRESHOLDS) {
    if (score >= min) return cls;
  }
  return 'fast';
}

/** Classes at or below `cls`, best first — used to degrade gracefully. */
function _classesFrom(cls) {
  const order = CLASS_THRESHOLDS.map(([c]) => c); // deep, balanced, fast
  const start = order.indexOf(cls);
  return start === -1 ? order : order.slice(start);
}

function _isUsable(model, { toolsafe }) {
  if (!model) return false;
  if (toolsafe && TOOL_UNSAFE.has(model)) return false;
  return true;
}

/**
 * Pick the model a provider should run for a failed-over request.
 *
 * @param {string} providerName   provider we are rerouting onto
 * @param {string} requestedModel model originally asked for (may be undefined)
 * @param {object} [opts]
 * @param {boolean} [opts.toolsafe]  request carries tools, so exclude models
 *                                   with known tool-protocol failures
 * @returns {{ model: string|null, class: string|null, requestedClass: string|null,
 *             downgraded: boolean, reason: string }}
 *
 * `model: null` means "no truthful mapping — let the provider use its own
 * configured default", which is exactly today's behavior. The difference is
 * that the result now SAYS so, instead of it being invisible.
 */
function resolve(providerName, requestedModel, opts = {}) {
  const requestedClass = classOf(requestedModel);

  if (!requestedClass) {
    return {
      model: null,
      class: null,
      requestedClass: null,
      downgraded: false,
      reason: requestedModel
        ? `"${requestedModel}" is not in the model registry, so its capability class is unknown; using ${providerName}'s configured default`
        : `no model requested; using ${providerName}'s configured default`,
    };
  }

  for (const cls of _classesFrom(requestedClass)) {
    const candidate = PREFERRED[cls]?.[providerName];
    if (_isUsable(candidate, opts)) {
      return {
        model: candidate,
        class: cls,
        requestedClass,
        downgraded: cls !== requestedClass,
        reason: cls === requestedClass
          ? `${providerName} matches the requested ${cls} class`
          : `${providerName} has no ${requestedClass}-class model; falling back to its ${cls}-class model`,
      };
    }
  }

  return {
    model: null,
    class: null,
    requestedClass,
    downgraded: true,
    reason: `${providerName} has no mapped model for the ${requestedClass} class${opts.toolsafe ? ' that is safe with tools' : ''}; using its configured default`,
  };
}

/**
 * Whether a class is trusted with write tools — the same 78 boundary the
 * write-tool gate uses, expressed once so the two cannot drift apart.
 */
function classSupportsWrites(cls) {
  return cls === 'deep' || cls === 'balanced';
}

module.exports = {
  CLASS_THRESHOLDS,
  TOOL_UNSAFE,
  PREFERRED,
  classOf,
  resolve,
  classSupportsWrites,
};
