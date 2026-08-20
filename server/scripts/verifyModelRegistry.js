#!/usr/bin/env node
/**
 * Model registry reconciliation.
 *
 * runtime-v2/modelRegistry.js hand-maintains ~48 model entries. Provider
 * catalogues move underneath it: models get retired, and slugs drift
 * ("meta/codellama-70b-instruct" became "meta/codellama-70b"). Nothing
 * validated the registry against reality, so routeRequest() could — and did —
 * select a model the account cannot call, surfacing as a provider error at
 * request time rather than a startup warning.
 *
 * This compares registry entries against each provider's live /v1/models
 * catalogue and reports three buckets: OK, DRIFTED (a close live slug exists —
 * likely a rename), and GONE (no plausible successor).
 *
 * Originally NVIDIA-only, which is precisely how the 2026-08-18 breakage went
 * unnoticed: Groq had removed EVERY Llama model from the account, so the
 * free-tier chat model and Groq's configured default both 404'd, and this
 * script — the one tool meant to catch exactly that — never looked at Groq.
 * It now walks every keyed provider that exposes an OpenAI-compatible catalogue.
 *
 * Read-only. Never edits the registry — a human decides what to repoint,
 * because assigning capability scores to a replacement model is a judgement
 * call, not a mechanical substitution.
 *
 *   node server/scripts/verifyModelRegistry.js
 *
 * Exits non-zero when anything is unreachable, so CI can gate on it.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const cfg = require('../config/automation');

/**
 * Providers whose catalogue we can enumerate.
 *
 * Ollama is excluded: it is a local daemon whose "catalogue" is whatever the
 * machine happens to have pulled, so a miss there says nothing about the
 * registry. Anything without a key configured is skipped rather than failed.
 */
function catalogueProviders() {
  return Object.keys(cfg.providers)
    .filter((n) => n !== 'primary' && n !== 'fallback' && n !== 'ollama')
    .filter((n) => cfg.providers[n]?.apiKey && cfg.providers[n]?.baseURL !== null);
}

async function fetchLiveCatalogue(providerName) {
  const c = cfg.providers[providerName];
  const baseURL = c.baseURL || 'https://api.openai.com/v1';
  const res = await fetch(`${baseURL.replace(/\/$/, '')}/models`, {
    headers: { Authorization: `Bearer ${c.apiKey}` },
  });
  if (!res.ok) {
    throw new Error(`${providerName} /models returned ${res.status} ${res.statusText}`);
  }
  const body = await res.json();
  // OpenAI-compatible shape is { data: [{ id }] }; Gemini's OpenAI bridge and
  // Cloudflare both follow it, but tolerate a bare array just in case.
  const list = Array.isArray(body) ? body : body.data || [];

  // Gemini's OpenAI bridge namespaces every id ("models/gemini-flash-lite-latest")
  // while the API accepts the bare slug — so a naive comparison reported a
  // model that had just been probed live as GONE, which would have argued for
  // deleting a working entry. Index both forms.
  const ids = new Set();
  for (const m of list) {
    if (!m.id) continue;
    ids.add(m.id);
    if (m.id.startsWith('models/')) ids.add(m.id.slice('models/'.length));
  }
  return ids;
}

/**
 * Cheap similarity: share the vendor prefix and enough of the model stem that
 * a human would recognise it as the same family. Deliberately loose — this
 * only suggests candidates for a human to confirm, so false positives are
 * cheaper than misses.
 */
function findSuccessors(registryKey, live) {
  const [vendor] = registryKey.split('/');
  const stem = registryKey
    .split('/')
    .slice(1)
    .join('/')
    .replace(/[-_.]/g, ' ')
    .split(' ')
    .filter((t) => t.length > 2);

  const scored = [];
  for (const id of live) {
    const sameVendor = id.startsWith(`${vendor}/`);
    const idNorm = id.replace(/[-_.]/g, ' ');
    const overlap = stem.filter((t) => idNorm.includes(t)).length;
    if (overlap === 0) continue;
    scored.push({ id, score: overlap + (sameVendor ? 1.5 : 0) });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, 3).map((s) => s.id);
}

async function main() {
  const registry = require('../ai/runtime-v2/modelRegistry');
  const providers = catalogueProviders();

  if (!providers.length) {
    console.error('No providers with a configured key — cannot verify the registry.');
    process.exit(2);
  }

  const ok = [];
  const drifted = [];
  const gone = [];
  const unchecked = [];
  let liveTotal = 0;
  let entryTotal = 0;

  for (const providerName of providers) {
    const entries = registry.findModelsByProvider(providerName);
    if (!entries.length) continue;
    entryTotal += entries.length;

    let live;
    try {
      live = await fetchLiveCatalogue(providerName);
    } catch (err) {
      // A provider we cannot enumerate is reported, not silently treated as
      // healthy — an unreachable catalogue is exactly when drift hides.
      unchecked.push({ provider: providerName, reason: err.message, entries: entries.length });
      continue;
    }
    liveTotal += live.size;
    console.log(`  ${providerName.padEnd(12)} ${String(entries.length).padStart(2)} registry / ${String(live.size).padStart(3)} live`);

    for (const entry of entries) {
      const id = entry.model;
      if (live.has(id)) {
        ok.push(id);
        continue;
      }
      const successors = findSuccessors(id, live);
      if (successors.length) drifted.push({ id, provider: providerName, successors });
      else gone.push({ id, provider: providerName });
    }
  }

  console.log(`\nRegistry entries checked: ${entryTotal}`);
  console.log(`Live catalogue entries:   ${liveTotal}\n`);
  console.log(`  reachable : ${ok.length}`);
  console.log(`  drifted   : ${drifted.length}`);
  console.log(`  gone      : ${gone.length}\n`);

  if (drifted.length) {
    console.log('DRIFTED — a live model of the same family exists; likely a rename:');
    for (const d of drifted) {
      console.log(`  [${d.provider}] ${d.id}`);
      for (const s of d.successors) console.log(`      -> ${s}`);
    }
    console.log('');
  }

  if (unchecked.length) {
    console.log('UNCHECKED — catalogue could not be read, so drift here is invisible:');
    for (const u of unchecked) console.log(`  [${u.provider}] ${u.entries} entr(ies): ${u.reason}`);
    console.log('');
  }

  if (gone.length) {
    console.log('GONE — no plausible successor in the live catalogue:');
    for (const g of gone) console.log(`  [${g.provider}] ${g.id}`);
    console.log('');
  }

  const unreachable = drifted.length + gone.length;
  if (unreachable > 0) {
    console.log(
      `${unreachable} of ${entryTotal} registry entries cannot be called with the ` +
      `configured key. routeRequest() can still select them.\n`
    );
    process.exit(1);
  }

  console.log('Every registry entry is reachable.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
