/**
 * The system prompt and the tool list must agree about whether Dax can act.
 *
 * Regression test for a live failure on 2026-08-18: a free-tier student asked
 * Dax to create a task and it answered "Got it. I've added a task for you"
 * having created nothing. Write tools were correctly withheld by tier, but the
 * prompt still described Dax as able to propose changes, so the model narrated
 * the action instead. No database, no network.
 */
const { resolveWriteAccess, writeCapabilityRules } = require('../ai/daxService');

describe('resolveWriteAccess', () => {
  it('grants writes to paid tiers on a capable model', () => {
    for (const tier of ['pro', 'placement']) {
      const r = resolveWriteAccess(tier);
      expect(`${tier}: ${r.canWrite}`).toBe(`${tier}: true`);
    }
  });

  it('withholds writes from free and trial', () => {
    for (const tier of ['free', 'trial']) {
      const r = resolveWriteAccess(tier);
      expect(`${tier}: ${r.canWrite}`).toBe(`${tier}: false`);
    }
  });

  it('withholds writes when the student picks a weak model, even when paid', () => {
    // Entitlement is not enough; the model still has to be trustworthy.
    expect(resolveWriteAccess('pro', '@cf/meta/llama-3.2-3b-instruct').canWrite).toBe(false);
  });
});

describe('writeCapabilityRules', () => {
  it('forbids claiming completion when Dax cannot act', () => {
    const rules = writeCapabilityRules(false);
    expect(rules).toMatch(/CANNOT create, reschedule, or complete/);
    expect(rules).toMatch(/NEVER say you have added, created, scheduled/);
  });

  it('describes the confirmation card when Dax can act', () => {
    const rules = writeCapabilityRules(true);
    expect(rules).toMatch(/confirmation card/);
    expect(rules).toMatch(/never claim it is already done/);
  });

  it('never tells a read-only turn that it can propose changes', () => {
    // The precise defect: the "you may propose changes" text reaching a turn
    // that has no write tools.
    expect(writeCapabilityRules(false)).not.toMatch(/confirmation card/);
  });
});

describe('tier model assignment', () => {
  const mr = require('../ai/runtime-v2/modelRegistry');

  it('gives each paid tier its own model, both write-capable', () => {
    const pro = resolveWriteAccess('pro');
    const placement = resolveWriteAccess('placement');

    expect(pro.effectiveModel).toBe('openai/gpt-oss-20b');
    expect(placement.effectiveModel).toBe('openai/gpt-oss-120b');
    expect(pro.effectiveModel).not.toBe(placement.effectiveModel);
    expect(pro.canWrite).toBe(true);
    expect(placement.canWrite).toBe(true);
  });

  it('keeps every tier model in the registry', () => {
    // An unregistered model resolves to provider=undefined and silently loses
    // write tools — exactly what happened when gpt-oss-120b was assigned to
    // the placement tier before its registry entry existed.
    for (const tier of ['free', 'trial', 'pro', 'placement']) {
      const { effectiveModel } = resolveWriteAccess(tier);
      const meta = mr.getModel(effectiveModel);
      expect(`${tier}/${effectiveModel}: ${meta ? meta.provider : 'NOT IN REGISTRY'}`)
        .not.toMatch(/NOT IN REGISTRY/);
    }
  });

  it('has no duplicate model keys in the registry', () => {
    // 'openai/gpt-oss-20b' was declared twice (nvidia 72, groq 78). Duplicate
    // keys collapse silently to the last, and had the order been reversed the
    // 72 would have dropped below the write gate and disabled writes for every
    // paid tier with nothing to explain it.
    const src = require('fs').readFileSync(require.resolve('../ai/runtime-v2/modelRegistry.js'), 'utf8');
    const keys = [...src.matchAll(/^  '([^']+)':\s*\{$/gm)].map((m) => m[1]);
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    expect(dupes).toEqual([]);
  });
});
