/**
 * Model equivalence — the capability contract must survive a failover.
 * No database, no network.
 */
const me = require('../ai/modelEquivalence');
const { MIN_WRITE_REASONING } = require('../ai/tools');
const modelRegistry = require('../ai/runtime-v2/modelRegistry');

describe('capability classes', () => {
  it('classifies by reasoning score', () => {
    expect(me.classOf('nvidia/nemotron-3-super-120b-a12b')).toBe('deep');
    expect(me.classOf('openai/gpt-oss-20b')).toBe('balanced');
    expect(me.classOf('meta/llama-3.1-8b-instruct')).toBe('fast');
  });

  it('admits when a model is unknown instead of guessing', () => {
    // openrouter's configured default has no registry entry; a guessed class
    // would be worse than none. (gemini-flash-lite-latest USED to be listed
    // here — it is now a verified registry entry, see below.)
    expect(me.classOf('google/gemma-4-31b-it:free')).toBeNull();
    expect(me.classOf('llama-3.1-8b-instant')).toBeNull();   // removed: 404s
    expect(me.classOf(undefined)).toBeNull();
  });

  it('draws the balanced boundary at the write-tool gate', () => {
    // If these drift apart, a model can be "balanced" but refused write tools.
    const balancedMin = me.CLASS_THRESHOLDS.find(([c]) => c === 'balanced')[1];
    expect(balancedMin).toBe(MIN_WRITE_REASONING);
  });

  it('only maps models that exist in the registry, under the right provider', () => {
    for (const [cls, byProvider] of Object.entries(me.PREFERRED)) {
      for (const [provider, model] of Object.entries(byProvider)) {
        const meta = modelRegistry.getModel(model);
        expect(`${cls}/${provider}/${model} -> ${meta ? 'found' : 'MISSING'}`)
          .toBe(`${cls}/${provider}/${model} -> found`);
        expect(meta.provider).toBe(provider);
      }
    }
  });
});

describe('resolve', () => {
  it('keeps the same class when the provider has one', () => {
    const r = me.resolve('nvidia', 'openai/gpt-oss-20b');   // balanced on groq
    expect(r.class).toBe('balanced');
    expect(r.model).toBe('meta/llama-3.1-70b-instruct');
    expect(r.downgraded).toBe(false);
  });

  it('preserves write-tool eligibility across a failover', () => {
    // The whole point: a student mid-conversation with write tools must not
    // silently lose them because their provider hit a quota.
    for (const provider of ['nvidia', 'cloudflare', 'gemini']) {
      const r = me.resolve(provider, 'openai/gpt-oss-20b', { toolsafe: true });
      expect(me.classSupportsWrites(r.class)).toBe(true);
      expect(modelRegistry.getModel(r.model).reasoningScore).toBeGreaterThanOrEqual(MIN_WRITE_REASONING);
    }
  });

  it('refuses a model with a known tool-protocol failure', () => {
    // llama-3.3-70b-versatile scores 80 but leaks <function=...> pseudo-syntax
    // into visible replies, so it must never be chosen for a tool request.
    const withTools = me.resolve('groq', 'nvidia/nemotron-3-super-120b-a12b', { toolsafe: true });
    expect(withTools.model).not.toBe('llama-3.3-70b-versatile');
    expect(me.TOOL_UNSAFE.has('llama-3.3-70b-versatile')).toBe(true);
  });

  it('degrades to a lower class rather than failing, and says so', () => {
    // Nothing on groq is 'deep'; it should step down, flagged.
    const r = me.resolve('groq', 'nvidia/nemotron-3-super-120b-a12b', { toolsafe: true });
    expect(r.requestedClass).toBe('deep');
    expect(r.class).toBe('balanced');
    expect(r.downgraded).toBe(true);
    expect(r.reason).toMatch(/no deep-class model/);
  });

  it('defers to the provider default when no truthful mapping exists', () => {
    // openrouter has no registry entries — null means "use your own default",
    // which is today's behavior, now stated instead of silent.
    const r = me.resolve('openrouter', 'openai/gpt-oss-20b');
    expect(r.model).toBeNull();
    expect(r.downgraded).toBe(true);
    expect(r.reason).toMatch(/configured default/);
  });

  it('never invents a model for an unknown request', () => {
    const r = me.resolve('nvidia', 'google/gemma-4-31b-it:free');
    expect(r.model).toBeNull();
    expect(r.requestedClass).toBeNull();
    expect(r.reason).toMatch(/not in the model registry/);
  });
});

describe('live-verified exclusions (probed 2026-08-18)', () => {
  it('maps Gemini to the slug that is actually served', () => {
    // gemini-2.0-flash was removed from the registry (404 on this account);
    // gemini-flash-lite-latest was probed live and replaces it.
    expect(me.PREFERRED.balanced.gemini).toBe('gemini-flash-lite-latest');
    expect(me.resolve('gemini', 'openai/gpt-oss-20b').model).toBe('gemini-flash-lite-latest');
  });

  it('has dropped every slug the account cannot serve', () => {
    const mr = require('../ai/runtime-v2/modelRegistry');
    for (const dead of ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemini-2.0-flash']) {
      expect(`${dead}: ${mr.getModel(dead) ? 'still present' : 'gone'}`).toBe(`${dead}: gone`);
    }
  });

  it('does not map Groq for fast-class — the account serves no small model', () => {
    // Groq removed every Llama model; gpt-oss-20b is its only chat model and
    // is balanced-class, so a fast-class request finds nothing here.
    expect(me.PREFERRED.fast.groq).toBeUndefined();
    expect(me.resolve('groq', 'meta/llama-3.1-8b-instruct').model).toBeNull();
  });

  it('still maps Groq for balanced-class, which is verified reachable', () => {
    expect(me.resolve('groq', 'meta/llama-3.1-70b-instruct').model).toBe('openai/gpt-oss-20b');
  });
});

describe('write-tool gating is two independent gates', () => {
  const { supportsWriteTools, tierAllowsWriteTools } = require('../ai/tools');
  const FREE = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
  const PAID = 'openai/gpt-oss-20b';

  it('lets the free tier run a strong model without granting writes', () => {
    // The point of the split: before this, the ONLY way to keep writes paid
    // was to keep free users on a weaker model.
    expect(supportsWriteTools(FREE)).toBe(true);      // capable
    expect(tierAllowsWriteTools('free')).toBe(false); // not entitled
    expect(supportsWriteTools(FREE) && tierAllowsWriteTools('free')).toBe(false);
  });

  it('grants writes only where both gates pass', () => {
    expect(supportsWriteTools(PAID) && tierAllowsWriteTools('pro')).toBe(true);
    expect(supportsWriteTools(PAID) && tierAllowsWriteTools('placement')).toBe(true);
    expect(supportsWriteTools(PAID) && tierAllowsWriteTools('trial')).toBe(false);
  });

  it('keeps READ tools available on the free-tier model', () => {
    // supportsToolCalling:false makes aiGateway skip the whole tool path, so a
    // stale flag here silently removes notes/tasks/resume lookup, not just writes.
    const meta = require('../ai/runtime-v2/modelRegistry').getModel(FREE);
    expect(meta.supportsToolCalling).not.toBe(false);
  });
});
