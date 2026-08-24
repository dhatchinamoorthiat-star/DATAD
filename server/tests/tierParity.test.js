/**
 * P9 regression — the dashboard must not gate on a capability key the server
 * does not emit.
 *
 * The dashboard called `getReadiness()` and `dashboardInsights()` on every load
 * for every user. Readiness requires the Placement pass and dashboard insights
 * require Pro, so for a free account — the default, and most accounts — both
 * were a guaranteed 403 on every page view, swallowed by `.catch(() => {})`.
 *
 * The fix skips those calls when the plan cannot use them, asking the server's
 * own capability map (`GET /api/subscription/me` → `capabilities`) rather than
 * keeping a second copy of the tier table on the client. That removes the
 * drift this suite used to guard, and introduces a narrower one: the client
 * names two capability keys as strings, and a key the server never emits reads
 * as `false` forever — silently withholding a feature from the people who paid
 * for it, with no error anywhere, because the mechanism is *not making a
 * request*.
 *
 * So this test reads the keys out of the dashboard and asserts the server
 * actually publishes them, at the tier the product intends.
 */

const fs = require('fs');
const path = require('path');

const { FEATURE, getFeaturesForTier, getMinimumTier } = require('../subscription/featureRegistry');
const { TIERS, isAtLeast } = require('../subscription/tierHierarchy');

/**
 * Read the capability keys the dashboard gates on, without bundling it.
 *
 * The client is ESM with Vite-specific imports, so requiring it from a CommonJS
 * jest suite is not straightforward. Scanning for `hasFeature('…')` is a
 * narrow, honest hack: it reads exactly the thing that must not drift, and it
 * fails loudly if the file is restructured, which is the moment a human should
 * look at this anyway.
 */
function dashboardCapabilityKeys() {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'client', 'src', 'components', 'experience', 'LivingSurface.jsx'),
    'utf8'
  );

  const keys = [...source.matchAll(/hasFeature\(\s*'([^']+)'\s*\)/g)].map((m) => m[1]);
  if (!keys.length) {
    throw new Error('LivingSurface.jsx: no hasFeature() gates found — has the gating moved?');
  }
  return keys;
}

describe('the dashboard gates on capabilities the server publishes', () => {
  const keys = dashboardCapabilityKeys();

  it('names only keys present in the capability map', () => {
    // getFeaturesForTier is what `GET /subscription/me` returns to the client,
    // so its key set is exactly what `hasFeature` can ever find.
    const published = getFeaturesForTier('placement');
    for (const key of keys) {
      expect(Object.keys(published)).toContain(key);
    }
  });

  it('still gates the two dashboard calls it was written for', () => {
    expect(keys).toContain(FEATURE.READINESS_SCORE);
    expect(keys).toContain(FEATURE.DASHBOARD_INSIGHTS);
  });

  it('never suppresses a call the server would have allowed', () => {
    // The dangerous direction, stated directly. The client attempts the request
    // exactly when the capability map says true, so this holds by construction
    // — and this asserts the construction, because a regression here is silent.
    for (const key of keys) {
      for (const tier of TIERS) {
        const serverAllows = isAtLeast(tier, getMinimumTier(key));
        expect(getFeaturesForTier(tier)[key]).toBe(serverAllows);
      }
    }
  });
});

describe('free is the default and is genuinely gated', () => {
  it('confirms the two dashboard calls are not free-tier features', () => {
    // If either of these ever becomes free, the client gate should be removed
    // rather than left in place suppressing a call that would now succeed.
    expect(getMinimumTier(FEATURE.READINESS_SCORE)).not.toBe('free');
    expect(getMinimumTier(FEATURE.DASHBOARD_INSIGHTS)).not.toBe('free');
  });

  it('withholds both from a free account and grants both to placement', () => {
    const free = getFeaturesForTier('free');
    const placement = getFeaturesForTier('placement');
    expect(free[FEATURE.READINESS_SCORE]).toBe(false);
    expect(free[FEATURE.DASHBOARD_INSIGHTS]).toBe(false);
    expect(placement[FEATURE.READINESS_SCORE]).toBe(true);
    expect(placement[FEATURE.DASHBOARD_INSIGHTS]).toBe(true);
  });
});
