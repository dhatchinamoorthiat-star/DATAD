/**
 * AI Runner — wraps provider calls with:
 *   • Retry with exponential backoff
 *   • Provider fallback
 *   • Automatic JSON parsing
 *   • Execution metadata + cost estimation
 *
 * When aiGateway is configured, all calls route through the gateway
 * so it can decide V1 vs V2 based on the active mode.
 */
const { getProviderChain } = require('./providers');
const providerGuard = require('./providerGuard');
const { parseJSON } = require('./parser');
const { OUTCOMES, RefusalError, detectRefusal, isPolicyRefusalError, isRefusal } = require('./refusal');
const cfg = require('../config/automation');
const { estimateCost } = require('./router');

/**
 * Native V1 implementation — called directly when gateway is bypassed
 * or when gateway isn't configured.
 *
 * Iterates every statically-available provider candidate (getProviderChain),
 * not just the first (getProvider). isAvailable() is a static "has a key"
 * check, not a live reachability probe — Ollama's key is a hardcoded
 * placeholder (config/automation.js), so a configured-but-not-actually-
 * running local Ollama daemon reports available and only fails on the real
 * call. Previously this loop retried the SAME resolved provider up to
 * maxAttempts times with backoff — against a connection-refused endpoint
 * that never becomes reachable, that's maxAttempts wasted round-trips, not
 * a real retry. Confirmed live: forcing a Runtime V2 rollout task to fail
 * so its V1 fallback ran for real (a free-tier user, whose routing prefers
 * Ollama) reproduced exactly this — 3 failed attempts against the same dead
 * provider, then a hard throw, even though Groq (the one provider with a
 * real key in this environment) was available the whole time. Same category
 * of bug already fixed for the chat path (aiGateway.js's messages branch);
 * this brings the non-chat path to the same standard.
 *
 * One attempt per candidate, not maxAttempts-with-backoff per candidate:
 * an earlier version of this fix kept a per-provider backoff-retry loop
 * "for genuinely transient failures," but a live test proved that claim
 * false — the loop broke out to the next provider on the very first
 * failure regardless of error type, so the inner retry never actually ran.
 * Distinguishing a transient error (rate limit) from a hard one (connection
 * refused) from the message string alone is guesswork; rather than ship a
 * claim the code doesn't back up, this tries each candidate once and moves
 * on. cfg.retry's maxAttempts/delayMs/backoffMultiplier are unused here as
 * a result — left in config for now rather than removed, since a real
 * transient-vs-hard classification is a reasonable future improvement, not
 * a reason to leave today's behavior misdescribed.
 */
async function _nativeRun({ system, user, provider: preferredProvider, json = true, maxTokens }) {
  const fullChain = getProviderChain(preferredProvider);
  if (!fullChain.length) throw new Error('No AI provider available.');

  // Providers the breaker has benched are skipped — see ai/providerGuard.js.
  // This is also where the "real transient-vs-hard classification" noted above
  // now lives: providerGuard.classifyError() separates a rate limit from a
  // malformed request, and only the former counts against a provider.
  const { chain } = providerGuard.filterChain(fullChain);

  let lastError;
  let attempts = 0;

  for (const p of chain) {
    attempts++;
    const startedAt = Date.now();
    // The provider call and the JSON parse fail for different reasons. A parse
    // failure still falls through to the next provider (a different model may
    // return well-formed JSON), but it must not count against this provider's
    // health — the call itself succeeded. This flag keeps one attempt from
    // being recorded as both a success and a failure.
    let callSucceeded = false;
    try {
      const messages = [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: user },
      ];

      const raw = await p.complete({ messages, system, maxTokens });
      // An empty completion is a failed turn. With json: true the parse below
      // already rejects it, so only the plain-text tasks were exposed — they
      // returned the empty string as a finished answer and stopped the chain
      // on the first provider. Checked before recordSuccess so the catch books
      // it against provider health, matching processStream's empty-stream
      // branch in aiGateway.js.
      if (!String(raw?.text ?? '').trim()) {
        throw new Error(`Provider "${p.name}" returned an empty completion.`);
      }

      // A refusal is an ANSWER, and the chain only exists to keep looking when
      // the request has not been answered. Before this check, groq's "I'm
      // sorry, but I can't help with that" reached parseJSON, failed to yield
      // an object, was booked as `bad_response`, and the loop moved on to a
      // provider that complied — turning a working safety refusal into the H4
      // newsletter phish. Detected here, before the parse, so the two cannot be
      // confused again.
      //
      // The provider is credited with a success: it responded correctly and
      // promptly. Benching it for declining would, over time, promote whichever
      // provider declines least.
      const refusal = detectRefusal(raw.text, { json });
      if (refusal) {
        callSucceeded = true;
        providerGuard.recordSuccess(p.name, Date.now() - startedAt);
        console.warn(
          `[AI Runner] ${p.name} declined the request (${refusal.outcome}); ` +
            'stopping the chain rather than failing over'
        );
        throw new RefusalError(`AI provider "${p.name}" declined this request.`, {
          provider: p.name,
          outcome: refusal.outcome,
          excerpt: refusal.excerpt,
        });
      }

      callSucceeded = true;
      providerGuard.recordSuccess(p.name, Date.now() - startedAt);
      const result = json ? parseJSON(raw.text, `attempt ${attempts}`) : raw.text;

      const costUsd = estimateCost(raw.provider, raw.promptTokens, raw.completionTokens);
      return {
        result,
        meta: {
          provider: raw.provider,
          model: raw.model,
          tokensUsed: raw.tokensUsed,
          promptTokens: raw.promptTokens,
          completionTokens: raw.completionTokens,
          latencyMs: raw.latencyMs,
          estimatedCostUsd: parseFloat(costUsd.toFixed(6)),
          attempts,
        },
      };
    } catch (err) {
      // Terminal outcomes leave the loop immediately. Everything below this
      // line is the "try the next provider" path, and a refusal must never
      // reach it — that is the whole of the H4 fix.
      if (isRefusal(err)) throw err;

      // Some providers express a safety block as an ordinary 400, which
      // providerGuard reads as `bad_request`: "our fault, a different model may
      // accept it". For a policy block that reasoning is exactly inverted.
      if (isPolicyRefusalError(err)) {
        console.warn(`[AI Runner] ${p.name} blocked the request on policy; stopping the chain`);
        throw new RefusalError(`AI provider "${p.name}" blocked this request on content policy.`, {
          provider: p.name,
          outcome: OUTCOMES.SAFETY_REFUSAL,
          excerpt: String(err?.message || '').slice(0, 200),
        });
      }

      lastError = err;
      const kind = callSucceeded
        ? OUTCOMES.MALFORMED_RESPONSE
        : providerGuard.recordFailure(p.name, err, Date.now() - startedAt);
      // bad_request is not short-circuited: providers run different models, so
      // an unknown-model 404 on one can still succeed on the next. It stays off
      // the breaker (providerGuard) since it is not a health signal.
      console.warn(`[AI Runner] ${p.name} failed (${kind}, candidate ${attempts}/${chain.length}): ${err.message}`);
    }
  }

  throw new Error(`AI generation failed after trying all ${chain.length} available provider(s): ${lastError?.message}`);
}

/**
 * Public run function — routes through aiGateway when available,
 * otherwise falls back to native V1 execution.
 *
 * @param {object} opts
 * @param {string}  opts.system   - System prompt
 * @param {string}  opts.user     - User prompt
 * @param {string}  [opts.provider] - Preferred provider name
 * @param {boolean} [opts.json]  - Parse response as JSON (default true)
 * @param {number}  [opts.maxTokens]
 * @param {boolean} [opts._gatewayBypass] - Internal flag to skip gateway delegation
 * @returns {Promise<{ result, meta }>}
 */
async function run(opts) {
  // Bypass gateway when called from within the gateway itself (prevents recursion)
  if (opts._gatewayBypass) {
    return _nativeRun(opts);
  }

  try {
    // Lazy require — breaks circular dep: aiGateway requires runner,
    // runner lazily requires aiGateway only at call time (not module load).
    const gateway = require('./aiGateway');
    const gwResult = await gateway.process(opts);

    return {
      result: gwResult.result,
      meta: {
        provider: gwResult.provider,
        model: gwResult.model,
        tokensUsed: gwResult.tokensUsed || 0,
        promptTokens: gwResult._execMeta?.promptTokens || 0,
        completionTokens: gwResult._execMeta?.completionTokens || 0,
        latencyMs: gwResult.latencyMs || 0,
        estimatedCostUsd: gwResult.estimatedCostUsd || 0,
        attempts: gwResult._execMeta?.attempts || 1,
        runtime: gwResult.runtime,
      },
    };
  } catch (err) {
    // Same rule one layer up. This blanket catch is a second failover — if the
    // gateway throws for any reason we re-run the request natively — and it
    // would have re-run a refused request against the whole chain again,
    // undoing the fix inside _nativeRun. A refusal is a decision, and repeating
    // the request does not change it.
    if (isRefusal(err)) throw err;
    return _nativeRun(opts);
  }
}

module.exports = { run };
