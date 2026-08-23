/**
 * AI Gateway — routes AI requests to the V1 execution path.
 *
 * The V2/hybrid/shadow mode switch was removed in the Sprint 2 AI consolidation
 * (July 2026). It was never reachable in production: the env var default was
 * v1_only, and the V2 exec path called an export that did not exist
 * (studentIntelligenceEngine.processIntelligenceRequest), so any other mode
 * threw immediately. See the implementation blueprint (P2: Dax is the One AI
 * Identity, P6: One Intent, One Surface) for the full rationale.
 *
 * What remains: V1 execution for task-based requests, streaming chat with tool
 * support, student-profile enrichment, and execution-metrics persistence.
 */

const cfg = require('../config/automation');

const v1Runner = require('./runner');
const usageMeter = require('./usageMeter');
const intelligenceLayer = require('./intelligence-layer');

/**
 * Build the student intelligence profile for every request.
 * The profile is attached to the normalized request so both V1 exec and the
 * caller can read it.
 */
async function _buildProfile(request) {
  const userId = request.userId || request._profileUserId;
  if (!userId) return null;
  try {
    return await intelligenceLayer.buildStudentProfile(userId);
  } catch {
    return null;
  }
}

function _enrichWithProfile(gatewayResult, profile) {
  if (!profile) return gatewayResult;
  return {
    ...gatewayResult,
    profile: {
      scores: profile.scores,
      enrichedContext: profile.enrichedContext,
    },
  };
}

/**
 * Resolves the one system prompt for a request and returns it inline at the
 * head of the message array, with every other system turn removed.
 *
 * Callers supply the prompt one of two ways: as `request.system` (the task
 * handlers) or as a leading { role: 'system' } entry inside `request.messages`
 * (both chat paths, which build a single array for the model). Both have to be
 * honoured, and the code here used to read only `request.system`.
 *
 * On the chat paths that field is always undefined, so the composition fell to
 * its else branch and the prompt became the [Student Context] blob ALONE,
 * while a `.filter(m => m.role !== 'system')` deleted the real one from the
 * array. Dax lost its entire identity on every chat turn — no first-person
 * rule, no "never mention the tools" rule, no persona, no origin answer — and
 * replied by narrating tool results in the third person ("The student has 1
 * pending task", "I've returned the first one in the list"). Found 2026-08-18.
 *
 * Returned inline rather than as a separate `system` param because that is the
 * only shape every provider honours: openaiCompatible.complete() does not
 * accept a `system` argument at all, so the non-streaming chat path would
 * silently drop it again. Providers that DO take the param prepend it to the
 * messages, so passing it both ways sent the prompt twice.
 */
function _composeSystem(system, messages = [], profileContext = '') {
  const inline = messages.filter((m) => m.role === 'system').map((m) => m.content).filter(Boolean);
  const base = [system, ...inline].filter(Boolean).join('\n\n');
  const composed = profileContext
    ? (base ? `${base}\n\n[Student Context]\n${profileContext}` : `[Student Context]\n${profileContext}`)
    : base;

  const rest = messages.filter((m) => m.role !== 'system');
  return {
    system: composed || undefined,
    messages: composed ? [{ role: 'system', content: composed }, ...rest] : rest,
  };
}

/**
 * Main entry point — process an AI request.
 * Always routes to the V1 execution path.
 */
async function processRequest(request) {
  // Build Student Intelligence Profile before routing
  const profile = await _buildProfile(request);
  request._profile = profile;

  const result = await _routeV1(request);
  return _enrichWithProfile(result, profile);
}

async function _routeV1(request) {
  const start = Date.now();
  const result = await _execV1(request);
  return _formatGatewayResult(result, 'v1', null, start);
}

// ── Streaming ──────────────────────────────────────────────────────────────
// How many times the model may call tools and be asked again within one turn.
const MAX_TOOL_ROUNDS = 3;

/**
 * Streams a reply, servicing any tool calls the model makes along the way.
 *
 * Yields only user-visible text. A tool round produces no text — the model
 * emits tool calls instead of content — so those rounds are silent from the
 * client's point of view and the visible reply is whatever the model says once
 * it has its data back.
 *
 * Falls back to a plain stream when the provider has no rich streaming or no
 * tools were requested, so non-NVIDIA providers keep working untouched.
 */
/**
 * Whether the model that will actually run can emit native tool calls.
 *
 * Handing tool definitions to a model that cannot produce structured calls
 * does not disable tools — the model complies in the only way it can, by
 * writing the call out as prose. That JSON is indistinguishable from a real
 * answer downstream, so it streams to the student as their reply.
 *
 * Only models that explicitly declare `supportsToolCalling: false` are gated.
 * Models missing from the registry keep their current behaviour rather than
 * silently losing tools.
 */
function _modelSupportsToolCalling(provider, model) {
  const name = model || provider.model;
  if (!name) return true;
  try {
    const { getModel } = require('./runtime-v2/modelRegistry');
    const meta = getModel(name);
    if (!meta) return true;
    return meta.supportsToolCalling !== false;
  } catch {
    return true;
  }
}

/**
 * Identity of a tool call, for spotting one the model has already made.
 *
 * Arguments arrive as a raw JSON string straight off the wire, so the same
 * request can look different byte-for-byte: '' vs '{}' vs '{}' with the keys
 * in another order. Canonicalising means those all collapse to one signature.
 * Unparseable arguments fall back to the raw string — worst case a repeat goes
 * undetected, which is just today's behaviour.
 */
function _callSignature(call) {
  const raw = call.arguments || '{}';
  let canonical = raw;
  try {
    const parsed = JSON.parse(raw);
    canonical = JSON.stringify(parsed, Object.keys(parsed || {}).sort());
  } catch { /* keep the raw string */ }
  return `${call.name}(${canonical})`;
}

async function* _streamWithTools(provider, { messages, system, model, maxTokens, signal, userId, tools, conversationId, onProposal }) {
  if (!tools?.length
    || typeof provider.completeStreamRich !== 'function'
    || !_modelSupportsToolCalling(provider, model)) {
    yield* provider.completeStream({ messages, system, model, maxTokens, signal });
    return;
  }

  const { executeTool, isWriteTool } = require('./tools');
  const proposalService = require('./proposalService');
  const { createInlineToolCallScanner } = require('./inlineToolCallScanner');
  const working = [...messages];
  let syntheticCallSeq = 0;

  // Every read call already served this turn, keyed by name + arguments, so a
  // model that asks the same question twice gets the same answer without a
  // second execution. Observed live 2026-08-18 on the free-tier model: a
  // single "what are my tasks?" produced list_my_tasks(""), then
  // list_my_tasks({"onlyOverdue":"false"}), then list_my_tasks("") again —
  // three rounds and ~7.7s to answer a question the first call had answered.
  const served = new Map();
  // Set when a whole round asked for nothing new. Withholding tools on the
  // next round forces the model to answer from what it already has instead of
  // spending the remaining rounds re-asking, which is what turned a repeat
  // loop into MAX_TOOL_ROUNDS of latency.
  let sawOnlyRepeats = false;

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    // Tools are withheld on the final round so the model is forced to answer
    // with text rather than requesting yet another call it will never get.
    const offerTools = round < MAX_TOOL_ROUNDS && !sawOnlyRepeats;
    const rawCalls = [];
    let sawText = false;
    // Some models (observed live 2026-07-28 on multiple Groq models under
    // repeated/corrective prompting — not one model's quirk) write a tool
    // call as inline text ("<function=name>{...}</function>") instead of
    // using the API's structured tool_calls delta. Left unfiltered, that
    // raw syntax streams straight to the student. The scanner holds text
    // back only while it could still be part of such a pattern, converts a
    // completed one into a real call, and discards an incomplete one at
    // end-of-stream rather than leaking the fragment.
    const inlineScanner = createInlineToolCallScanner();

    const gen = provider.completeStreamRich({
      messages: working,
      system,
      model,
      maxTokens,
      signal,
      tools: offerTools ? tools : undefined,
    });

    let chunk;
    for await (chunk of gen) {
      if (chunk.type === 'text') {
        const { safeText, calls } = inlineScanner.push(chunk.text);
        if (safeText) { sawText = true; yield safeText; }
        for (const call of calls) {
          rawCalls.push({ id: `inline_${round}_${syntheticCallSeq++}`, name: call.name, arguments: call.arguments });
        }
      }
      // Both providers' completeStreamRich() (nvidiaProvider.js,
      // openaiCompatible.js) yield exactly one 'tool_calls' event, plural,
      // carrying every call the model made as a toolCalls array — never a
      // singular 'tool_call'. The mismatched type name here meant this branch
      // never matched anything: rawCalls stayed empty regardless of what the
      // model actually requested, so any turn that opened with a tool call
      // (rather than starting with prose) fell straight through to the
      // "no tools called" return below having yielded zero text — surfacing
      // upstream as "provider returned nothing" and burning through the
      // entire fallback chain on every such turn, for every provider.
      if (chunk.type === 'tool_calls') rawCalls.push(...chunk.toolCalls);
    }
    const trailingSafeText = inlineScanner.flush();
    if (trailingSafeText) { sawText = true; yield trailingSafeText; }

    if (!rawCalls.length) return; // No tools called — normal end of turn.

    // Tool calls were made. Reads execute immediately per-call. Writes never
    // touch data directly — they batch into one proposal per round (this
    // used to call a proposalService.present() that doesn't exist; the real
    // export is propose(userId, conversationId, requested[])) so the student
    // confirms once even if the model requested several changes at once.
    const toolResults = [];
    const writeCalls = rawCalls.filter((c) => isWriteTool(c.name));
    const readCalls = rawCalls.filter((c) => !isWriteTool(c.name));

    let novelCalls = 0;
    for (const call of readCalls) {
      const sig = _callSignature(call);
      let content = served.get(sig);
      if (content === undefined) {
        novelCalls++;
        // executeTool() takes the whole { name, arguments } call and parses
        // arguments (a JSON string) itself. It never throws — a failure
        // resolves as an { error } value instead.
        content = JSON.stringify(await executeTool(call, userId));
        served.set(sig, content);
      }
      // A repeat gets the cached answer verbatim: re-running the query would
      // cost a round trip to say the same thing, and giving a DIFFERENT answer
      // to the same question mid-turn is how a model talks itself into a loop.
      toolResults.push({ role: 'tool', tool_call_id: call.id, content });
    }

    // Writes are never deduplicated — each one is a distinct thing the student
    // is being asked to confirm — so a round containing them always counts as
    // progress.
    sawOnlyRepeats = readCalls.length > 0 && novelCalls === 0 && writeCalls.length === 0;

    if (writeCalls.length) {
      const requested = writeCalls.map((c) => {
        let args = {};
        try { args = c.arguments ? JSON.parse(c.arguments) : {}; } catch { /* validateAction rejects malformed args itself */ }
        return { tool: c.name, args };
      });
      const { proposal, rejected } = await proposalService.propose(userId, conversationId, requested);
      if (proposal && onProposal) onProposal(proposal);

      for (const call of writeCalls) {
        const rejection = rejected.find((r) => r.tool === call.name);
        const content = rejection
          ? { error: rejection.error }
          : { proposed: true, proposalId: proposal?._id };
        toolResults.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(content) });
      }
    }

    // content is '' rather than null: Cloudflare Workers AI rejects a null
    // content on an assistant tool_call turn with a bodyless 400, and the free
    // tier's default model is a Cloudflare one — so EVERY free-tier turn that
    // touched a tool 400'd here and survived only by burning a failover hop to
    // Groq (~2.9s and a wasted round trip). Verified 2026-08-18: identical
    // request with content:'' succeeds on the same model. Every other provider
    // accepts '' too, so this needs no per-provider branch.
    //
    // arguments defaults to '{}': a model that calls a no-argument tool streams
    // an empty arguments string, and '' is not valid JSON for that field.
    working.push({
      role: 'assistant',
      content: '',
      tool_calls: rawCalls.map((c) => ({
        id: c.id,
        type: 'function',
        function: { name: c.name, arguments: c.arguments || '{}' },
      })),
    });
    working.push(...toolResults);
  }
}

/**
 * Streaming entry point — used only by the chat task's SSE endpoint.
 * Always uses V1 dispatch. Profile enrichment + provider chain fallback.
 */
/**
 * Hold window — how much of a reply is buffered before the turn is committed
 * to one provider.
 *
 * Once a chunk has been yielded, the client has rendered it, and failing over
 * would append a second independent answer to the half-read first one. So the
 * moment of first yield is the point of no return. Providers that die two
 * tokens in — a stream that opens and then 500s, a connection dropped
 * mid-flight — used to land on the student as a broken half-sentence, even
 * though five working providers sat behind it in the chain.
 *
 * Buffering the opening of the reply moves the commit point later, so those
 * early deaths fail over invisibly. The cost is real and paid by every request:
 * time-to-first-token rises by however long the model takes to produce
 * HOLD_CHARS. That is why the window is also bounded in time — on a slow
 * provider the char target is abandoned rather than making the student wait.
 *
 * Set DAX_STREAM_HOLD_CHARS=0 to disable and restore yield-immediately.
 */
const HOLD_CHARS = parseInt(process.env.DAX_STREAM_HOLD_CHARS || '200', 10);
const HOLD_MS = parseInt(process.env.DAX_STREAM_HOLD_MS || '1200', 10);

/**
 * A user pressing stop must never be read as a provider failure — that would
 * reroute to the next provider and answer a question they just cancelled.
 */
function _isAbort(err, signal) {
  if (signal?.aborted) return true;
  const name = err?.name || '';
  return name === 'AbortError' || name === 'APIUserAbortError' || name === 'CanceledError';
}

async function* processStream(request) {
  const profile = await _buildProfile(request);
  const { system, messages, provider, model, maxTokens, signal } = request;

  if (!messages) throw new Error('processStream requires a messages array');

  const { messages: enrichedMessages } = _composeSystem(system, messages, profile?.enrichedContext || '');

  const { getProviderChain } = require('./providers');
  const providerGuard = require('./providerGuard');
  const modelEquivalence = require('./modelEquivalence');
  const fullChain = getProviderChain(provider);
  if (!fullChain.length) throw new Error('No AI provider available.');

  // Skip providers the breaker has benched (recent 429s, dead keys, 5xx) so a
  // rate-limited primary costs one failed request rather than one per request.
  const { chain } = providerGuard.filterChain(fullChain);

  let lastError = null;
  for (const p of chain) {
    if (typeof p.completeStream !== 'function') {
      lastError = new Error(`Provider "${p.name}" does not support streaming.`);
      continue;
    }

    let yieldedAny = false;
    const startedAt = Date.now();
    try {
      // The originally requested model belongs to one provider's namespace, so
      // it cannot simply be handed to whoever we failed over onto. Resolve the
      // nearest same-capability model in the new provider's namespace instead
      // of dropping to undefined, which silently accepts whatever that
      // provider's config happens to name — including, in the worst case, a
      // model below the write-tool threshold, so tools vanish mid-conversation.
      const isFirstChoice = p.name === (provider || chain[0]?.name);
      let modelForProvider;
      if (isFirstChoice) {
        modelForProvider = model;
      } else {
        const equivalent = modelEquivalence.resolve(p.name, model, {
          toolsafe: Array.isArray(request.tools) && request.tools.length > 0,
        });
        modelForProvider = equivalent.model || undefined;
        console.warn(
          `[aiGateway] failover ${model || '(default)'} -> ${p.name}:${equivalent.model || '(provider default)'} — ${equivalent.reason}`
        );
      }

      const gen = _streamWithTools(p, {
        messages: enrichedMessages,
        // System prompt rides at the head of enrichedMessages. Passing it here
        // too would make providers that prepend the param send it twice.
        system: undefined,
        model: modelForProvider,
        maxTokens,
        signal,
        userId: request.userId,
        tools: request.tools,
        conversationId: request.conversationId,
        onProposal: request.onProposal,
      });

      // ── Hold window ──────────────────────────────────────────────────────
      // Buffer the opening of the reply before committing to this provider.
      // Anything thrown while we are still inside this loop is recoverable:
      // nothing has reached the client, so the chain can still reroute.
      const held = [];
      let heldChars = 0;
      let streamEnded = false;
      const holdStart = Date.now();

      // The first pull is unconditional; only the ones after it are governed by
      // the hold budget. That distinction is the whole of a production bug:
      // `streamEnded` was only ever assigned inside this loop, and .env ships
      // DAX_STREAM_HOLD_CHARS=0, so on every real deployment the loop body never
      // ran. `streamEnded` stayed false, `held` stayed empty, the empty-stream
      // check below was unreachable, and a provider that yielded nothing was
      // booked as a SUCCESS whose reply was the empty string — the exact
      // "AI gateway returned empty response" the check was written to prevent,
      // reintroduced by a setting meant to affect only latency.
      //
      // Pulling once costs nothing: the chunk is buffered, not delayed beyond
      // what yield-immediately already implies, and failover stays available
      // until it is handed on.
      while (!streamEnded &&
             (held.length === 0 || (heldChars < HOLD_CHARS && Date.now() - holdStart < HOLD_MS))) {
        const next = await gen.next();
        if (next.done) { streamEnded = true; break; }
        held.push(next.value);
        // _streamWithTools yields plain strings, not { text } objects — this
        // read `next.value?.text`, which is always undefined on a string, so
        // heldChars never left 0. The HOLD_CHARS target was therefore never
        // reachable and every turn sat out the full HOLD_MS before releasing
        // its first token: a flat +1.2s on time-to-first-token, every message.
        heldChars += (next.value || '').length;
      }

      // A stream that ends without emitting anything is a failed turn, not a
      // finished one — the model answered with nothing, or produced only tool
      // calls and no prose. Returning here would end the whole request with an
      // empty reply and skip every remaining provider, which callers surface
      // as "AI gateway returned empty response". Fall through instead.
      //
      // Tested on held.length rather than heldChars: a chunk carrying no text
      // (a proposal card, say) is a real answer, and the pre-hold code treated
      // it as one.
      if (streamEnded && held.length === 0) {
        lastError = new Error(`Provider "${p.name}" returned an empty stream.`);
        // A silent empty stream is a provider fault, not a user one — it counts
        // against the provider's health so a consistently empty backend gets
        // benched instead of being retried first on every request.
        providerGuard.recordFailure(p.name, lastError, Date.now() - startedAt);
        console.warn(`[aiGateway] Streaming provider "${p.name}" returned nothing, trying next.`);
        continue;
      }

      // Commit: failover is off the table only once a chunk has ACTUALLY been
      // handed to the client, so the flag is set per chunk rather than up front.
      //
      // It used to be set here, before the yields. With a hold window that is
      // fine — the first chunk has already been pulled, so output really does
      // exist. But with DAX_STREAM_HOLD_CHARS=0 the hold loop never runs, so
      // `held` is empty and the first provider call happens inside `yield* gen`
      // BELOW this line: any failure there was treated as mid-stream, failover
      // was skipped, and a recoverable provider 400 became a hard 500 for the
      // student. Found 2026-08-18 after disabling the hold window.
      for (const chunk of held) { yieldedAny = true; yield chunk; }
      if (!streamEnded) {
        for await (const chunk of gen) { yieldedAny = true; yield chunk; }
      }

      providerGuard.recordSuccess(p.name, Date.now() - startedAt);

      usageMeter.chargeCredits({
        userId: request.userId,
        tier: request.tier,
        model: model || p.model || p.name,
        provider: p.name,
        task: request.task || request.taskName || 'chat',
      })
        .then(() => usageMeter.checkAndNotifyCredits(request.userId, request.tier))
        .catch(() => {});
      return;
    } catch (err) {
      lastError = err;

      // The student cancelled. Not a provider fault, and emphatically not a
      // reason to ask a different provider the same question.
      if (_isAbort(err, signal)) throw err;

      const kind = providerGuard.recordFailure(p.name, err, Date.now() - startedAt);

      // Once tokens are out the door the client has already rendered them.
      // Restarting on another provider would append a second, independent
      // answer to the first half of one the user is already reading, so a
      // mid-stream failure has to surface rather than silently retry.
      if (yieldedAny) throw err;

      // NOTE: bad_request deliberately does NOT short-circuit the chain here.
      // The original reasoning — "a malformed request fails identically on
      // every provider" — stopped being true once modelEquivalence started
      // handing each provider a DIFFERENT model. A live preflight found Groq
      // 404ing on its configured model while NVIDIA and Cloudflare answered
      // fine; short-circuiting would have failed that request outright instead
      // of rerouting it. bad_request is still kept off the breaker (see
      // providerGuard) — it says nothing about provider health — but the chain
      // is still walked, because the next provider gets a different model.

      console.warn(`[aiGateway] Streaming provider "${p.name}" failed (${kind}), trying next: ${err.message}`);
    }
  }

  throw new Error(
    `Streaming failed on all ${chain.length} available provider(s): ${lastError?.message || 'unknown error'}`
  );
}

// ── V1 Execution ───────────────────────────────────────────────────────────

async function _execV1(request) {
  const { system, user, messages, provider, json, maxTokens, task } = request;

  if (!system && !user && !messages) {
    throw new Error('V1 execution requires system/user prompts or messages array');
  }

  // Inject student intelligence profile context into the system prompt
  const profile = request._profile;
  const profileContext = profile?.enrichedContext || '';
  const { system: enrichedSystem, messages: enrichedMessages } = _composeSystem(
    system,
    messages || [],
    profileContext
  );

  let result, meta;

  // Support conversation history via messages array (chat use case)
  if (messages) {
    const { getProviderChain } = require('./providers');
    const providerGuard = require('./providerGuard');
    const fullChain = getProviderChain(provider);
    if (!fullChain.length) throw new Error('No AI provider available.');

    // Same breaker filter as the streaming path — see _streamV1.
    const { chain } = providerGuard.filterChain(fullChain);

    let raw, lastErr, attempts = 0;
    for (const p of chain) {
      attempts++;
      const startedAt = Date.now();
      try {
        // System prompt rides at the head of enrichedMessages — the only shape
        // every provider honours (openaiCompatible.complete() takes no `system`
        // argument, so passing it that way dropped it silently).
        raw = await p.complete({ messages: enrichedMessages, maxTokens });
        // A completion with no text is a failed turn, not a finished one, and
        // it has to be caught here because nothing downstream re-checks it: an
        // empty string flows out as a successful reply, the chain stops on the
        // first provider, and the student gets a blank bubble.
        //
        // The streaming path has always treated an empty stream this way (see
        // the `streamEnded && held.length === 0` branch in processStream); this
        // branch did not, so the same provider behaved differently depending on
        // whether the caller streamed. Found 2026-08-19: groq's gpt-oss-20b
        // returns nothing at all for short conversational turns ("hi", "hello")
        // while answering substantive questions fine — as the first provider in
        // the chain, it made every greeting come back empty. The JSON tasks
        // were unaffected only because the parse failed and rerouted them.
        //
        // Thrown before recordSuccess so the catch below books it as a provider
        // failure: a consistently empty backend gets benched by the breaker
        // rather than being retried first on every request.
        if (!String(raw?.text ?? '').trim()) {
          throw new Error(`Provider "${p.name}" returned an empty completion.`);
        }
        providerGuard.recordSuccess(p.name, Date.now() - startedAt);
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        const kind = providerGuard.recordFailure(p.name, err, Date.now() - startedAt);
        console.warn(`[aiGateway] Provider "${p.name}" failed (${kind}), trying next: ${err.message}`);
      }
    }
    if (lastErr) throw new Error(`Chat failed on all ${attempts} available provider(s): ${lastErr.message}`);

    result = raw.text;
    meta = {
      provider: raw.provider,
      model: raw.model,
      tokensUsed: raw.tokensUsed,
      promptTokens: raw.promptTokens,
      completionTokens: raw.completionTokens,
      latencyMs: raw.latencyMs,
      estimatedCostUsd: 0,
      attempts,
    };
  } else {
    const runResult = await v1Runner.run({
      system: enrichedSystem || '',
      user: user || '',
      provider,
      json: json !== false,
      maxTokens,
      _gatewayBypass: true,
    });
    result = runResult.result;
    meta = runResult.meta;
  }

  // Credit metering — fire-and-forget, common point after both branches.
  usageMeter.chargeCredits({
    userId: request.userId,
    tier: request.tier,
    model: meta.model,
    provider: meta.provider,
    promptTokens: meta.promptTokens,
    completionTokens: meta.completionTokens,
    task: task || request.taskName || '',
    latencyMs: meta.latencyMs,
  })
    .then(() => usageMeter.checkAndNotifyCredits(request.userId, request.tier))
    .catch(() => {});

  return {
    result,
    provider: meta.provider,
    model: meta.model,
    tokensUsed: meta.tokensUsed || 0,
    promptTokens: meta.promptTokens || 0,
    completionTokens: meta.completionTokens || 0,
    latencyMs: meta.latencyMs || 0,
    estimatedCostUsd: meta.estimatedCostUsd || 0,
    confidence: meta.confidence || null,
    verificationScore: null,
    verificationStatus: null,
    cacheHit: false,
    promptVersion: 'v1',
    attempts: meta.attempts || 1,
    task: task || null,
    _rawMeta: meta,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function _formatGatewayResult(execResult, runtime, fallback, startTime) {
  const latencyMs = Date.now() - startTime;

  return {
    result: execResult?.result ?? null,
    runtime,
    fallbackRuntime: fallback || null,
    provider: execResult?.provider ?? null,
    model: execResult?.model ?? null,
    latencyMs,
    cacheHit: execResult?.cacheHit ?? false,
    confidence: execResult?.confidence ?? null,
    verificationScore: execResult?.verificationScore ?? null,
    verificationStatus: execResult?.verificationStatus ?? null,
    estimatedCostUsd: execResult?.estimatedCostUsd ?? 0,
    tokensUsed: execResult?.tokensUsed ?? 0,
    promptVersion: execResult?.promptVersion ?? 'v1',
    intent: execResult?.intent?.primaryIntent ?? execResult?.intent ?? null,
    capabilityProfile: execResult?.capabilityProfile ?? null,
    promptId: execResult?.promptId ?? null,
    task: execResult?.task ?? null,
    _execMeta: execResult?._rawMeta ?? null,
  };
}

// ── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  process: processRequest,
  processStream,
};
