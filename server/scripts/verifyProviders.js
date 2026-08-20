#!/usr/bin/env node
/**
 * Provider preflight — what the failover chain will actually do.
 *
 * Two modes:
 *   --offline   config only. No network. Resolves the real chain order, checks
 *               which providers are keyed, and flags config that contradicts
 *               itself. Safe to run with no connectivity.
 *   (default)   the above, plus one tiny live completion per provider, to
 *               separate "has a key" from "actually answers". isAvailable() is
 *               a static key check, so a keyed-but-unreachable provider looks
 *               healthy until a real user hits it.
 *
 * Exits non-zero if any *keyed* provider fails a live check, so this can gate
 * a deploy. Offline mode exits non-zero only on contradictory config.
 *
 * Companion to verifyModelRegistry.js, which reconciles model slugs; this
 * reconciles providers.
 */

// Resolve .env from the server directory, not the caller's cwd — running this
// from the repo root silently loaded no env at all and reported every provider
// as unkeyed, which looks exactly like a real outage.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const cfg = require('../config/automation');
const { getProviderChain, buildProvider } = require('../ai/providers');
const circuitBreaker = require('../ai/runtime-v2/circuitBreaker');
const providerGuard = require('../ai/providerGuard');

const OFFLINE = process.argv.includes('--offline');
// --models probes the model slugs the APP actually asks for, which are not the
// providers' configured defaults. selectTierModel() sends Groq slugs for chat,
// and modelEquivalence sends per-provider slugs on failover; a provider whose
// default answers can still 404 on every model the product requests.
const MODELS = process.argv.includes('--models');
const PROBE = 'Reply with the single word: ok';

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

function keyedProviderNames() {
  return Object.keys(cfg.providers).filter((n) => n !== 'primary' && n !== 'fallback');
}

async function probe(provider) {
  const startedAt = Date.now();
  try {
    const raw = await provider.complete({
      messages: [{ role: 'user', content: PROBE }],
      maxTokens: 16,
    });
    return { ok: true, latencyMs: Date.now() - startedAt, model: raw.model, text: (raw.text || '').trim().slice(0, 40) };
  } catch (err) {
    // Same classifier the live chain uses, so this reports failures in the
    // same vocabulary the breaker will act on.
    return { ok: false, latencyMs: Date.now() - startedAt, kind: providerGuard.classifyError(err), message: err.message };
  }
}

/** The model slugs the product will actually request, by provider. */
function appModels() {
  const modelEquivalence = require('../ai/modelEquivalence');
  const wanted = {};

  // Chat tier defaults (daxService.selectTierModel).
  for (const m of ['openai/gpt-oss-20b', 'meta/llama-3.1-8b-instruct']) {
    const meta = require('../ai/runtime-v2/modelRegistry').getModel(m);
    if (meta) (wanted[meta.provider] ||= new Set()).add(m);
  }
  // Everything failover can reroute onto.
  for (const byProvider of Object.values(modelEquivalence.PREFERRED)) {
    for (const [provider, model] of Object.entries(byProvider)) {
      (wanted[provider] ||= new Set()).add(model);
    }
  }
  return wanted;
}

async function probeModels(keyed) {
  console.log('\nModel probes (slugs the product actually requests):');
  const wanted = appModels();
  let failures = 0;

  for (const { name, provider } of keyed) {
    const models = wanted[name];
    if (!models) { console.log(`  ${name.padEnd(12)} ${dim('no mapped models')}`); continue; }

    for (const model of models) {
      process.stdout.write(`  ${name.padEnd(12)} ${model.padEnd(42)} ... `);
      const startedAt = Date.now();
      try {
        await provider.complete({ messages: [{ role: 'user', content: PROBE }], maxTokens: 16, model });
        console.log(`${green('ok')} ${dim(`${Date.now() - startedAt}ms`)}`);
      } catch (err) {
        failures++;
        console.log(`${red(providerGuard.classifyError(err))} ${dim(err.message.slice(0, 70))}`);
      }
    }
  }
  return failures;
}

async function main() {
  console.log('\nDax provider preflight');
  console.log('='.repeat(60));

  // ── Chain order ───────────────────────────────────────────────────────────
  const chain = getProviderChain();
  console.log(`\nResolved failover chain (${chain.length} available):`);
  console.log('  ' + chain.map((p) => p.name).join(' -> '));

  let configProblems = 0;

  // The chain's own PROVIDER_ORDER states an intended primary, but
  // _candidateOrder() prepends cfg.providers.primary, which silently wins.
  // A mismatch means the documented ordering is not the one in effect.
  const intendedPrimary = 'groq';
  const configuredPrimary = cfg.providers.primary;
  const effectivePrimary = chain[0]?.name;

  if (configuredPrimary !== intendedPrimary) {
    configProblems++;
    console.log(yellow(`\n  ! configured primary is "${configuredPrimary}", but ai/providers/index.js documents "${intendedPrimary}".`));
    console.log(dim(`    _candidateOrder() prepends cfg.providers.primary, so it overrides PROVIDER_ORDER.`));
    console.log(dim(`    set AI_PRIMARY_PROVIDER=${intendedPrimary} to match the documented intent.`));
  }
  // Distinct problem: the configured primary isn't even reachable, so requests
  // are silently starting somewhere else entirely.
  if (effectivePrimary && effectivePrimary !== configuredPrimary) {
    configProblems++;
    console.log(yellow(`\n  ! configured primary "${configuredPrimary}" is not available — requests will start at "${effectivePrimary}".`));
  }

  // ── Key configuration ─────────────────────────────────────────────────────
  console.log('\nConfiguration:');
  const keyed = [];
  for (const name of keyedProviderNames()) {
    let provider = null;
    try { provider = buildProvider(name); } catch { /* unknown */ }

    const available = provider?.isAvailable?.() || false;
    if (available) keyed.push({ name, provider });

    const inChain = chain.some((p) => p.name === name);
    const note = available
      ? (inChain ? green('keyed') : yellow('keyed, not in chain'))
      : dim('no key');
    console.log(`  ${name.padEnd(12)} ${note}${provider?.model ? dim('  ' + provider.model) : ''}`);
  }

  // Cloudflare needs BOTH a token and an account id; a half-set pair silently
  // reports unavailable rather than erroring, which is easy to miss.
  const cfToken = !!process.env.CLOUDFLARE_AI_TOKEN;
  const cfAccount = !!process.env.CLOUDFLARE_ACCOUNT_ID;
  if (cfToken !== cfAccount) {
    configProblems++;
    console.log(red(`\n  ! Cloudflare is half-configured: ${cfToken ? 'token set, ACCOUNT_ID missing' : 'ACCOUNT_ID set, token missing'}`));
    console.log(dim('    Both are required — with only one, the provider silently reports unavailable.'));
  }

  // ── Breaker state ─────────────────────────────────────────────────────────
  // In-process and empty on a fresh run; meaningful only inside a live server.
  const benched = keyed.filter(({ name }) => !circuitBreaker.isAvailable(name));
  if (benched.length) {
    console.log(yellow(`\n  ! circuit-open: ${benched.map((b) => b.name).join(', ')}`));
  }

  if (OFFLINE) {
    console.log(`\n${dim('--offline: skipping live probes.')}`);
    console.log(`\n${configProblems ? yellow(`${configProblems} config problem(s)`) : green('config looks consistent')}\n`);
    process.exit(configProblems ? 1 : 0);
  }

  // ── Live probes ───────────────────────────────────────────────────────────
  console.log(`\nLive probes (${keyed.length} keyed provider(s)):`);
  let failures = 0;
  for (const { name, provider } of keyed) {
    process.stdout.write(`  ${name.padEnd(12)} ... `);
    const r = await probe(provider);
    if (r.ok) {
      console.log(`${green('ok')} ${dim(`${r.latencyMs}ms  ${r.model || ''}  "${r.text}"`)}`);
    } else {
      failures++;
      console.log(`${red(r.kind)} ${dim(`${r.latencyMs}ms  ${r.message}`)}`);
    }
  }

  if (MODELS) failures += await probeModels(keyed);

  console.log('\n' + '='.repeat(60));
  if (failures) {
    console.log(red(`${failures} probe(s) failed.`));
  } else {
    console.log(green(`All ${keyed.length} keyed provider(s) answered.`));
  }
  if (configProblems) console.log(yellow(`${configProblems} config problem(s) above.`));
  console.log('');

  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(red(`\nPreflight crashed: ${err.stack}`));
  process.exit(1);
});
