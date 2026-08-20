#!/usr/bin/env node
/**
 * Model benchmark — pick Dax's models from evidence, not from catalogue copy.
 *
 * A provider catalogue is a list of names. It does not tell you which models
 * your key can actually call, which ones answer a quantitative question
 * correctly, which ones honour a JSON contract, which ones emit real tool_calls
 * rather than narrating pseudo-syntax at the student, or which ones leak
 * chain-of-thought into the visible reply. Every one of those has bitten this
 * codebase, and each was found by probing rather than by reading.
 *
 * This walks a provider's live catalogue and reports all of it.
 *
 *   node server/scripts/benchmarkModels.js                    # nvidia, top 25 candidates
 *   node server/scripts/benchmarkModels.js --provider groq
 *   node server/scripts/benchmarkModels.js --provider nvidia --limit 60
 *   node server/scripts/benchmarkModels.js --dry-run          # no network: show what would run
 *   node server/scripts/benchmarkModels.js --models a,b,c     # probe an explicit shortlist
 *   node server/scripts/benchmarkModels.js --out results.json # machine-readable, for diffing accounts
 *
 * Two stages, because most catalogue entries are not chat models: a cheap
 * liveness probe first, then the full evaluation only on what survives. That
 * keeps a 100+ model catalogue to a sensible number of real requests.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const cfg = require('../config/automation');
const { buildProvider } = require('../ai/providers');
const providerGuard = require('../ai/providerGuard');
const { parseJSON } = require('../ai/parser');

// ── args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true);
};
const PROVIDER = flag('provider', 'nvidia');
const LIMIT = parseInt(flag('limit', '25'), 10);
const DRY = argv.includes('--dry-run');
const OUT = flag('out', null);
const ONLY = flag('models', null);
// Serial by default. A concurrency of 3 tripped NVIDIA's per-account worker
// cap mid-run on 2026-08-18 ("ResourceExhausted: Worker local total request
// limit reached (37/32)"), after which 429s were being recorded as model
// failures and latencies were inflated ~4x. Throughput is worthless here if it
// corrupts the measurement.
const CONCURRENCY = parseInt(flag('concurrency', '1'), 10);
const DELAY_MS = parseInt(flag('delay', '250'), 10);
const MAX_RETRIES = parseInt(flag('retries', '3'), 10);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Abort the whole run once the account is clearly exhausted.
 *
 * Learned the hard way on 2026-08-18: a 60-model run drained the NVIDIA free
 * quota, and the re-run then measured nothing but throttling — 3 of 60
 * callable, every survivor scoring 0/6. Worse, retrying `provider_unavailable`
 * turned each failure into four requests, so the "fix" for rate limiting
 * consumed quota four times faster.
 *
 * Past this many consecutive throttled requests the account is not going to
 * recover inside the run, and every further request makes the situation worse
 * while producing data that cannot be trusted. Stop and say so.
 */
const ABORT_AFTER = parseInt(flag('abort-after', '12'), 10);
let consecutiveThrottled = 0;
let aborted = false;

function noteThrottle(isThrottled) {
  if (isThrottled) {
    consecutiveThrottled++;
    if (consecutiveThrottled >= ABORT_AFTER) aborted = true;
  } else {
    consecutiveThrottled = 0;
  }
}

/**
 * Retry throttle-shaped failures with exponential backoff.
 *
 * Distinguishes "this model is unsuitable" from "the account was busy", which
 * the first version of this script conflated — it rejected glm-5.2, minimax-m3
 * and laguna-xs-2.1 on the strength of nothing but 429 storms.
 *
 * @returns {{ ok: true, value } | { ok: false, kind, message, throttled: boolean }}
 */
async function attempt(fn) {
  if (aborted) return { ok: false, kind: 'aborted', message: 'run aborted — account throttled', throttled: true };
  let last;
  for (let i = 0; i <= MAX_RETRIES; i++) {
    try {
      const value = await fn();
      noteThrottle(false);
      return { ok: true, value };
    } catch (err) {
      last = err;
      const kind = providerGuard.classifyError(err);
      const throttled = kind === 'rate_limited' || kind === 'timeout' || kind === 'provider_unavailable';
      // Only rate limits are worth retrying. Retrying provider_unavailable
      // against an exhausted account quadruples the request count for nothing.
      const retryable = kind === 'rate_limited';
      noteThrottle(throttled);
      if (!retryable || i === MAX_RETRIES || aborted) {
        return { ok: false, kind, message: err.message, throttled };
      }
      await sleep(Math.min(1000 * 2 ** i, 8000));
    }
  }
  return { ok: false, kind: providerGuard.classifyError(last), message: last?.message, throttled: true };
}

const g = (s) => `\x1b[32m${s}\x1b[0m`;
const r = (s) => `\x1b[31m${s}\x1b[0m`;
const y = (s) => `\x1b[33m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

// ── what to exclude ─────────────────────────────────────────────────────────
// Name-based, deliberately. Catalogues describe task types inconsistently
// across providers, but naming is reliable enough to skip the obvious non-chat
// entries — and a false exclusion only costs a candidate, while a false
// inclusion costs a wasted probe and a confusing row.
const NOT_CHAT = new RegExp([
  'embed', 'bge-', 'e5-', 'nvclip', 'rerank',            // retrieval, not chat
  'guard', 'safety', 'moderat', 'shield',                 // classifiers
  'whisper', 'speech', 'tts', 'audio', 'voice', 'riva', 'parakeet', 'canary',
  'image', 'vision', '-vl\\b', 'diffusion', 'sana', 'flux', 'ocr', 'video',
  'super-resolution', 'deplot', 'fuyu', 'paddle', 'florence', 'clip',
  'translate', 'codegemma', 'codestral', 'coder', 'starcoder', '-code-', 'code-instruct',
  'protein', 'molecul', 'biomed', 'clara', 'earth', 'weather', 'calibration',
].join('|'), 'i');

/**
 * Rank candidates so a --limit cut keeps the plausible chat models.
 *
 * The catalogue comes back alphabetical, so slicing it raw meant probing
 * "01-ai" and "adept" while never reaching nemotron or llama. This is a
 * heuristic for ORDERING only — nothing is excluded by it, and a low score
 * still gets probed if the limit allows.
 */
const FAMILY = /nemotron|llama|qwen|mistral|mixtral|gemma|phi|granite|gpt-oss|deepseek|glm|yi-|jamba|command/i;
function candidateScore(name) {
  let s = 0;
  if (/instruct|chat|-it\b/i.test(name)) s += 2;
  if (FAMILY.test(name)) s += 2;
  if (/nano|mini|small|flash|lite|fast|8b|7b|9b|12b/i.test(name)) s += 1;  // free-tier shaped
  return s;
}

async function catalogue(providerName) {
  const c = cfg.providers[providerName];
  if (!c?.apiKey) throw new Error(`${providerName} has no API key configured`);

  // Cloudflare has no OpenAI-style /models; it has its own search endpoint.
  if (providerName === 'cloudflare') {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/models/search?per_page=200`,
      { headers: { Authorization: `Bearer ${c.apiKey}` } }
    );
    const body = await res.json();
    return (body.result || [])
      .filter((m) => /Text Generation/i.test(m.task?.name || ''))
      .map((m) => m.name);
  }

  const baseURL = (c.baseURL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const res = await fetch(`${baseURL}/models`, { headers: { Authorization: `Bearer ${c.apiKey}` } });
  if (!res.ok) throw new Error(`${providerName} /models returned ${res.status}`);
  const body = await res.json();
  const list = Array.isArray(body) ? body : body.data || [];
  // Gemini namespaces ids as "models/<slug>" but accepts the bare slug.
  return list.map((m) => String(m.id).replace(/^models\//, '')).filter(Boolean);
}

// ── the evaluation ──────────────────────────────────────────────────────────
// Objective and domain-relevant: Dax's students ask quantitative placement and
// finance questions, which is exactly where small models fail.
const QUESTIONS = [
  { q: 'A firm has ROIC 12% and WACC 15%. Is it creating or destroying value? One word.', ok: /destroy/i },
  { q: 'Debt is 40% of capital at 10% pre-tax cost; equity 60% at 15%. Tax 30%. Compute WACC. Only the number as a percent.', ok: /11\.8|11,8/ },
  { q: 'A train travels 60 km in 45 minutes. Speed in km/h? Number only.', ok: /\b80\b/ },
  { q: 'Order smallest first: 0.9, 0.85, 0.099. Comma list only.', ok: /0\.099\s*,\s*0\.85\s*,\s*0\.9/ },
  { q: 'Sells 200 units at Rs.50, variable cost Rs.30/unit, fixed costs Rs.2000. Profit in Rs? Number only.', ok: /\b2000\b/ },
  { q: 'Which is the odd one out and why, in under 10 words: NPV, IRR, Payback, CAPM?', ok: /capm/i },
];

const JSON_TASK = `Summarise this note.
Note title: WACC basics
Content: WACC blends cost of equity and after-tax cost of debt, weighted by capital structure. Used as a DCF discount rate. A firm creates value when ROIC exceeds WACC.

Reply in this exact JSON format and nothing else:
{"summary":"…","keyPoints":["…","…","…"],"frameworks":"…"}`;

const TOOLS = [{
  type: 'function',
  function: {
    name: 'list_my_tasks',
    description: "List the student's tasks, soonest first.",
    parameters: { type: 'object', properties: { onlyOverdue: { type: 'boolean' } }, required: [] },
  },
}];

// Visible chain-of-thought or tool plumbing reaching the student. Both have
// shipped to real users in this codebase before.
const LEAK = /<function=|<\|python_tag\|>|<think>|◁think▷|analysisWe|<\|channel\|>/i;

async function liveness(provider, model) {
  const t0 = Date.now();
  const res = await attempt(() =>
    provider.complete({ messages: [{ role: 'user', content: 'Say ok.' }], maxTokens: 16, model })
  );
  if (res.ok) return { ok: true, ms: Date.now() - t0, empty: !(res.value.text || '').trim() };
  return { ok: false, kind: res.kind, message: res.message, throttled: res.throttled };
}

async function evaluate(provider, model) {
  const row = { model, correct: 0, asked: QUESTIONS.length, lat: [], json: 'n/a', tools: 'n/a', leak: false, errors: 0, throttled: 0 };

  for (const item of QUESTIONS) {
    const t0 = Date.now();
    const res = await attempt(() =>
      provider.complete({ messages: [{ role: 'user', content: item.q }], maxTokens: 400, model })
    );
    if (!res.ok) { row.errors++; if (res.throttled) row.throttled++; await sleep(DELAY_MS); continue; }
    row.lat.push(Date.now() - t0);
    const text = res.value.text || '';
    if (LEAK.test(text)) row.leak = true;
    if (item.ok.test(text)) row.correct++;
    await sleep(DELAY_MS);
  }

  const jsonRes = await attempt(() =>
    provider.complete({ messages: [{ role: 'user', content: JSON_TASK }], maxTokens: 700, model })
  );
  if (!jsonRes.ok) { row.json = jsonRes.throttled ? 'throttled' : 'fail'; if (jsonRes.throttled) row.throttled++; }
  else {
    try {
      const parsed = parseJSON(jsonRes.value.text, 'bench');
      row.json = parsed?.summary && Array.isArray(parsed.keyPoints) ? 'ok' : 'partial';
    } catch { row.json = 'fail'; }
  }
  await sleep(DELAY_MS);

  // Tools must go through completeStreamRich — complete() ignores the `tools`
  // parameter entirely, which made an earlier hand-rolled probe meaningless.
  if (typeof provider.completeStreamRich === 'function') {
    try {
      let calls = [], text = '';
      for await (const ev of provider.completeStreamRich({
        messages: [{ role: 'user', content: 'What tasks do I have due? Use your tools.' }],
        maxTokens: 300, model, tools: TOOLS,
      })) {
        if (ev.type === 'text' && ev.text) text += ev.text;
        if (ev.text && !ev.type) text += ev.text;
        if (ev.toolCalls) calls = calls.concat(ev.toolCalls);
        if (ev.toolCall) calls.push(ev.toolCall);
      }
      if (LEAK.test(text)) { row.tools = 'leak'; row.leak = true; }
      else row.tools = calls.length ? 'ok' : 'none';
    } catch (err) {
      const kind = providerGuard.classifyError(err);
      const throttled = kind === 'rate_limited' || kind === 'timeout' || kind === 'provider_unavailable';
      row.tools = throttled ? 'throttled' : 'fail';
      if (throttled) row.throttled++;
    }
  }

  row.mean = row.lat.length ? Math.round(row.lat.reduce((a, b) => a + b, 0) / row.lat.length) : 0;
  return row;
}

/** Bounded concurrency — enough to finish a large catalogue, gentle enough not to trip rate limits. */
async function mapLimit(items, limit, fn) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }));
  return out;
}

async function main() {
  console.log(`\nModel benchmark — provider: ${PROVIDER}\n${'='.repeat(78)}`);

  let candidates;
  if (ONLY && ONLY !== true) {
    candidates = String(ONLY).split(',').map((s) => s.trim()).filter(Boolean);
    console.log(`explicit shortlist: ${candidates.length} model(s)`);
  } else {
    const all = await catalogue(PROVIDER);
    const chat = all
      .filter((m) => !NOT_CHAT.test(m))
      .sort((a, b) => candidateScore(b) - candidateScore(a) || a.localeCompare(b));
    candidates = chat.slice(0, LIMIT);
    console.log(`catalogue: ${all.length} | after dropping non-chat names: ${chat.length} | probing: ${candidates.length}`);
    if (chat.length > candidates.length) {
      console.log(dim(`  (raise --limit to go past ${LIMIT})`));
    }
  }

  if (DRY) {
    console.log('\n--dry-run, no requests will be made:\n');
    candidates.forEach((m) => console.log('  ' + m));
    console.log('');
    return;
  }

  const provider = buildProvider(PROVIDER);

  // Stage 1 — cheap liveness. Most catalogue entries are not callable chat models.
  console.log(`\nStage 1: liveness (${candidates.length} models, concurrency ${CONCURRENCY})`);
  const live = [];
  const dead = [];
  await mapLimit(candidates, CONCURRENCY, async (model) => {
    const res = await liveness(provider, model);
    if (res.ok && !res.empty) { live.push(model); process.stdout.write(g('.')); }
    else if (res.ok && res.empty) { live.push(model); process.stdout.write(y('?')); } // reasoning models can be empty at 16 tokens
    else { dead.push({ model, kind: res.kind, message: res.message }); process.stdout.write(r('x')); }
  });
  console.log(`\n  callable: ${live.length}/${candidates.length}`);

  if (dead.length) {
    // A catalogue listing is not an entitlement: providers advertise models the
    // key cannot call (downloadable-only, partner-hosted, or retired). Naming
    // the reason distinguishes "not on your plan" from "your key is broken".
    const byKind = dead.reduce((acc, d) => { (acc[d.kind] ||= []).push(d.model); return acc; }, {});
    console.log(dim('  not callable:'));
    for (const [kind, models] of Object.entries(byKind)) {
      console.log(dim(`    ${kind} (${models.length}): ${models.slice(0, 4).join(', ')}${models.length > 4 ? ', …' : ''}`));
    }
  }

  if (!live.length) { console.log(r('\nNothing callable — check the API key.\n')); process.exit(1); }

  // Stage 2 — the real evaluation.
  console.log(`\nStage 2: evaluating ${live.length} model(s)\n`);
  const rows = await mapLimit(live, CONCURRENCY, async (model) => {
    const row = await evaluate(provider, model);
    console.log(
      `  ${String(row.correct + '/' + row.asked).padEnd(5)} ${String(row.mean + 'ms').padStart(7)}  ` +
      `json=${String(row.json).padEnd(7)} tools=${String(row.tools).padEnd(5)} ` +
      `${row.leak ? r('LEAK') : dim('    ')} ${row.errors ? r('err' + row.errors) : '    '}  ${model}`
    );
    return row;
  });

  // ── verdict ───────────────────────────────────────────────────────────────
  // Ranked by correctness, then speed. Anything that leaks, breaks the JSON
  // contract, or cannot use tools is unsuitable for Dax regardless of score:
  // task handlers depend on JSON parsing, and chat depends on tool calls.
  // A model whose failures were all throttling tells us nothing either way —
  // reporting it as rejected is how the first run libelled three models that
  // had simply been rate-limited.
  const inconclusive = rows.filter((x) => x.throttled > 0);
  const judged = rows.filter((x) => x.throttled === 0);
  const usable = judged.filter((x) => !x.leak && x.json === 'ok' && (x.tools === 'ok' || x.tools === 'n/a') && !x.errors);
  usable.sort((a, b) => b.correct - a.correct || a.mean - b.mean);

  if (aborted) {
    console.log(r(`\n\nABORTED after ${ABORT_AFTER} consecutive throttled requests.`));
    console.log(r('The account is rate-limited or out of quota; results below are not trustworthy.'));
    console.log(dim('Wait for the quota window to reset, or use a different key, then re-run.'));
  }

  console.log(`\n${'='.repeat(78)}`);
  console.log(`\nUsable for Dax (no leak, JSON ok, tools ok): ${usable.length}/${judged.length} judged (${rows.length} evaluated)\n`);
  usable.slice(0, 10).forEach((x, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. ${x.correct}/${x.asked}  ${String(x.mean + 'ms').padStart(7)}  ${x.model}`);
  });

  const rejected = judged.filter((x) => !usable.includes(x));
  if (rejected.length) {
    console.log(`\nRejected (${rejected.length}):`);
    rejected.forEach((x) => {
      const why = [x.leak && 'leaks CoT/plumbing', x.json !== 'ok' && `json=${x.json}`, x.tools === 'none' && 'no tool calls', x.tools === 'fail' && 'tools failed', x.errors && `${x.errors} errors`].filter(Boolean).join(', ');
      console.log(`  ${x.model} ${dim('— ' + why)}`);
    });
  }

  if (inconclusive.length) {
    console.log(`\nInconclusive (${inconclusive.length}) — hit rate limits, re-run to judge:`);
    inconclusive.forEach((x) => console.log(`  ${x.model} ${dim(`— ${x.throttled} throttled request(s)`)}`));
  }

  if (OUT && OUT !== true) {
    require('fs').writeFileSync(OUT, JSON.stringify({ provider: PROVIDER, at: new Date().toISOString(), rows }, null, 2));
    console.log(`\nwrote ${OUT}`);
  }
  console.log('');
}

main().catch((err) => { console.error(r(`\nBenchmark failed: ${err.stack}`)); process.exit(2); });
