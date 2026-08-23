/**
 * Completion outcomes — the difference between "the provider broke" and
 * "the model declined".
 *
 * The 2026-08-22 Phase 2 test drove a prompt-injected post title through the
 * weekly newsletter and watched this exact sequence:
 *
 *   [AI Runner] groq failed (bad_response, candidate 1/7): No JSON object found
 *   Raw: I'm sorry, but I can't help with that.
 *
 * Groq refused. The runner could not tell a refusal from a mangled response, so
 * it classified the refusal as `bad_response` and did what it does for mangled
 * responses: it tried the next provider. The next provider complied. The
 * failover chain — the resilience feature — walked past a successful safety
 * refusal and turned it into a successful attack.
 *
 * The chain has exactly one legitimate reason to advance: the request has not
 * been answered *yet*. A refusal is an answer. Retrying an identical unsafe
 * request against a different model until one says yes is not resilience, it is
 * a brute-force search for the most permissive provider in the chain.
 *
 * So this module gives the runner the vocabulary the report asked for, and the
 * runner treats the two refusal outcomes as terminal.
 */

/**
 * Every way a completion attempt can end. The first four justify advancing to
 * the next provider; the last two do not.
 */
const OUTCOMES = {
  /** Socket-level failure: connection refused, DNS, reset. Try the next one. */
  TRANSPORT_ERROR: 'transport_error',
  /** No answer within the budget. Try the next one. */
  TIMEOUT: 'timeout',
  /** Dead key, 5xx, rate limited, benched. Try the next one. */
  PROVIDER_UNAVAILABLE: 'provider_unavailable',
  /** The model answered, but not in the shape we asked for. Try the next one. */
  MALFORMED_RESPONSE: 'malformed_response',
  /** The model understood and declined. TERMINAL — do not try another one. */
  MODEL_REFUSAL: 'model_refusal',
  /** The provider's own safety filter blocked it. TERMINAL. */
  SAFETY_REFUSAL: 'safety_refusal',
};

/** Outcomes that must stop the chain rather than advance it. */
const TERMINAL_OUTCOMES = new Set([OUTCOMES.MODEL_REFUSAL, OUTCOMES.SAFETY_REFUSAL]);

/**
 * A refusal, raised as an error so it unwinds the provider loop, but flagged
 * `terminal` so no layer above mistakes it for "this provider failed".
 *
 * `status` is 422 rather than 500: the request was understood and rejected, and
 * an operator reading the logs should see the difference immediately.
 */
class RefusalError extends Error {
  constructor(message, { provider, outcome = OUTCOMES.MODEL_REFUSAL, excerpt } = {}) {
    super(message);
    this.name = 'RefusalError';
    this.terminal = true;
    this.outcome = outcome;
    this.provider = provider;
    /** A short quote of what the model said, for the logs. Never the full body. */
    this.excerpt = excerpt;
    this.statusCode = 422;
  }
}

/**
 * Phrases a model uses when it is declining rather than failing.
 *
 * Deliberately narrow. A pattern that fires on a stray "I'm sorry" inside a
 * legitimate answer would bench a healthy provider and, worse, teach whoever
 * maintains this to loosen the whole check. The guard against false positives
 * is not pattern subtlety, it is the caller contract below: this is only
 * consulted for responses that failed to produce the structure we demanded.
 */
const REFUSAL_PATTERNS = [
  /\bi(?:'m|’m| am) sorry,?\s*(?:but\b|i\b)/i,
  /\bi (?:can(?:'|’)?t|cannot|can not|won(?:'|’)?t|will not) (?:help|assist|comply|do that|provide|create|generate|write|produce|fulfil|fulfill|continue)\b/i,
  /\bi(?:'m|’m| am) (?:not able|unable) to (?:help|assist|comply|provide|create|generate|write|do)\b/i,
  /\bi (?:must|have to|will) (?:decline|refuse)\b/i,
  /\bas an ai\b[^.]{0,60}\bi (?:can(?:'|’)?t|cannot|won(?:'|’)?t)\b/i,
  /\b(?:violates|goes against|conflicts with)\b[^.]{0,40}\b(?:policy|policies|guidelines|content policy|terms)\b/i,
  /\b(?:content|safety|usage)[ _-]?policy\b[^.]{0,40}\b(?:violation|prevents|blocks)\b/i,
  /\bthat (?:request|content) (?:is not something|isn(?:'|’)?t something) i\b/i,
];

/** Provider-side safety blocks, which arrive as errors rather than as text. */
const POLICY_ERROR_PATTERNS = [
  /content[_ -]?policy/i,
  /content[_ -]?filter/i,
  /safety[_ -]?(?:filter|system|violation)/i,
  /\bflagged\b[^.]{0,30}\b(?:policy|safety|content)\b/i,
  /responsible[_ -]?ai/i,
  /\bprohibited[_ -]?content\b/i,
];

const REFUSAL_LOOKS_LIKE_JSON = /[{[]/;

/**
 * Decide whether a completion is a refusal.
 *
 * Contract, and the reason this is safe to act on:
 *
 *   With `json: true` we asked for a JSON object. A response that both fails to
 *   contain any JSON *and* reads like a decline is a decline — a model
 *   generating a newsletter does not accidentally emit a bare apology and no
 *   object. That conjunction is what keeps this from misfiring on prose that
 *   merely contains the word "sorry" somewhere inside a valid payload.
 *
 *   With `json: false` there is no structure to lean on, so the length ceiling
 *   does the same job: refusals are short. A long answer that happens to open
 *   with an apology is an answer.
 *
 * @param {string} text  the raw completion
 * @param {{json?: boolean}} [opts]
 * @returns {{outcome: string, excerpt: string}|null}
 */
function detectRefusal(text, { json = true } = {}) {
  const body = String(text ?? '').trim();
  if (!body) return null;

  // A response carrying the structure we asked for is an answer, whatever
  // sentences it contains.
  if (json && REFUSAL_LOOKS_LIKE_JSON.test(body)) return null;
  if (!json && body.length > 600) return null;

  const head = body.slice(0, 600);
  if (!REFUSAL_PATTERNS.some((re) => re.test(head))) return null;

  return { outcome: OUTCOMES.MODEL_REFUSAL, excerpt: body.slice(0, 200) };
}

/**
 * Decide whether a thrown provider error is a safety block rather than a fault.
 *
 * Providers signal this as an ordinary 400, which `providerGuard.classifyError`
 * reads as `bad_request` — "our fault, try the next provider, it may accept a
 * different model". For a policy block that reasoning is inverted: the next
 * provider is precisely where it must not go.
 */
function isPolicyRefusalError(err) {
  const status = err?.status ?? err?.response?.status ?? err?.statusCode;
  // Only 4xx. A 500 mentioning "filter" is a provider fault, not a decision.
  if (status && (status < 400 || status >= 500)) return false;

  const haystack = [
    err?.message,
    err?.code,
    err?.error?.type,
    err?.error?.code,
    err?.response?.data?.error?.message,
  ]
    .filter(Boolean)
    .join(' ');

  return POLICY_ERROR_PATTERNS.some((re) => re.test(haystack));
}

/** Is this outcome one the failover chain must not walk past? */
function isTerminalOutcome(outcome) {
  return TERMINAL_OUTCOMES.has(outcome);
}

/**
 * Is this error a refusal? Structural check, deliberately not `instanceof`.
 *
 * `instanceof` compares constructor identity, so it answers false whenever the
 * error was built from a different copy of this module than the caller holds —
 * two entries in the require cache, a jest registry reset, a bundled duplicate.
 * The regression suite caught exactly that: a refusal raised by one copy sailed
 * past an `instanceof` guard in another, `_nativeRun` ran the request again, and
 * the compliant provider returned the phishing payload.
 *
 * The failure direction is what makes this worth a named function. An identity
 * check that goes wrong fails OPEN — it re-enables the H4 chain and nothing
 * looks broken. Matching on the shape instead means a duplicate module is
 * merely a duplicate module.
 */
function isRefusal(err) {
  return Boolean(err) && err.name === 'RefusalError' && err.terminal === true;
}

module.exports = {
  OUTCOMES,
  RefusalError,
  detectRefusal,
  isPolicyRefusalError,
  isTerminalOutcome,
  isRefusal,
  // Exported for the regression suite, which asserts on the patterns directly
  // so a future edit that guts them fails loudly rather than silently.
  REFUSAL_PATTERNS,
  POLICY_ERROR_PATTERNS,
};
