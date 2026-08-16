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

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    // Tools are withheld on the final round so the model is forced to answer
    // with text rather than requesting yet another call it will never get.
    const offerTools = round < MAX_TOOL_ROUNDS;
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

    for (const call of readCalls) {
      // executeTool() takes the whole { name, arguments } call and parses
      // arguments (a JSON string) itself. It never throws — a failure
      // resolves as an { error } value instead.
      const result = await executeTool(call, userId);
      toolResults.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
    }

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

    working.push({
      role: 'assistant',
      content: null,
      tool_calls: rawCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.arguments } })),
    });
    working.push(...toolResults);
  }
}

/**
 * Streaming entry point — used only by the chat task's SSE endpoint.
 * Always uses V1 dispatch. Profile enrichment + provider chain fallback.
 */
async function* processStream(request) {
  const profile = await _buildProfile(request);
  const { system, messages, provider, model, maxTokens, signal } = request;

  if (!messages) throw new Error('processStream requires a messages array');

  const profileContext = profile?.enrichedContext || '';
  const enrichedSystem = profileContext
    ? (system ? `${system}\n\n[Student Context]\n${profileContext}` : `[Student Context]\n${profileContext}`)
    : system;
  const enrichedMessages = profileContext
    ? [{ role: 'system', content: enrichedSystem || '' }, ...messages.filter((m) => m.role !== 'system')]
    : messages;

  const { getProviderChain } = require('./providers');
  const chain = getProviderChain(provider);
  if (!chain.length) throw new Error('No AI provider available.');

  let lastError = null;
  for (const p of chain) {
    if (typeof p.completeStream !== 'function') {
      lastError = new Error(`Provider "${p.name}" does not support streaming.`);
      continue;
    }

    let yieldedAny = false;
    try {
      const modelForProvider = p.name === (provider || chain[0]?.name) ? model : undefined;

      const gen = _streamWithTools(p, {
        messages: enrichedMessages,
        system: enrichedSystem || undefined,
        model: modelForProvider,
        maxTokens,
        signal,
        userId: request.userId,
        tools: request.tools,
        conversationId: request.conversationId,
        onProposal: request.onProposal,
      });
      const first = await gen.next();

      // A stream that ends without emitting anything is a failed turn, not a
      // finished one — the model answered with nothing, or produced only tool
      // calls and no prose. Returning here would end the whole request with an
      // empty reply and skip every remaining provider, which callers surface
      // as "AI gateway returned empty response". Fall through instead.
      if (first.done) {
        lastError = new Error(`Provider "${p.name}" returned an empty stream.`);
        console.warn(`[aiGateway] Streaming provider "${p.name}" returned nothing, trying next.`);
        continue;
      }

      yieldedAny = true;
      yield first.value;
      yield* gen;

      usageMeter.chargeCredits({
        userId: request.userId,
        tier: request.tier,
        model: model || p.model || p.name,
        provider: p.name,
        task: request.task || request.taskName || 'chat',
      }).catch(() => {});
      return;
    } catch (err) {
      lastError = err;

      // Once tokens are out the door the client has already rendered them.
      // Restarting on another provider would append a second, independent
      // answer to the first half of one the user is already reading, so a
      // mid-stream failure has to surface rather than silently retry.
      if (yieldedAny) throw err;

      console.warn(`[aiGateway] Streaming provider "${p.name}" failed, trying next: ${err.message}`);
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
  const enrichedSystem = profileContext
    ? (system ? `${system}\n\n[Student Context]\n${profileContext}` : `[Student Context]\n${profileContext}`)
    : system;

  let result, meta;

  // Support conversation history via messages array (chat use case)
  if (messages) {
    const enrichedMessages = profileContext
      ? [
          { role: 'system', content: enrichedSystem || '' },
          ...messages.filter((m) => m.role !== 'system'),
        ]
      : messages;

    const { getProviderChain } = require('./providers');
    const chain = getProviderChain(provider);
    if (!chain.length) throw new Error('No AI provider available.');

    let raw, lastErr, attempts = 0;
    for (const p of chain) {
      attempts++;
      try {
        raw = await p.complete({ messages: enrichedMessages, system: enrichedSystem || undefined, maxTokens });
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
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
  }).catch(() => {});

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
