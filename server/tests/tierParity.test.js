/**
 * P9 regression — the client's copy of the tier rules must match the server's.
 *
 * The dashboard called `getReadiness()` and `dashboardInsights()` on every load
 * for every user. Readiness requires the Placement pass and dashboard insights
 * require Pro, so for a free account — the default, and most accounts — both
 * were a guaranteed 403 on every page view, swallowed by `.catch(() => {})`.
 *
 * The fix skips those calls when the plan cannot use them, which means the
 * client now holds a copy of two facts the server owns. A copy that drifts is
 * worse than no copy: if the client's number is too high a paying student
 * silently loses a feature they bought, and no error is raised anywhere,
 * because the fix's whole mechanism is *not making a request*.
 *
 * So this test reads both sides and asserts they agree. It fails the moment
 * someone changes a tier in the registry without changing client/src/utils/tier.js.
 */

const fs = require('fs');
const path = require('path');

// getMinimumTier() rather than the FEATURE_ACCESS map directly: the accessor
// is the module's stated contract, and it applies whatever default the
// registry uses for a feature with no explicit entry.
const { FEATURE, getMinimumTier } = require('../subscription/featureRegistry');
const { TIERS, isAtLeast } = require('../subscription/tierHierarchy');

/**
 * Read the client's table without bundling it.
 *
 * The client is ESM with Vite-specific imports, so requiring it from a CommonJS
 * jest suite is not straightforward. Parsing the two literals is a narrow,
 * honest hack: it reads exactly the two things that must not drift, and it
 * fails loudly if the file is restructured, which is the moment a human should
 * look at this anyway.
 */
function readClientTier() {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'client', 'src', 'utils', 'tier.js'),
    'utf8'
  );

  const tiersMatch = source.match(/export const TIERS = \[([^\]]+)\]/);
  if (!tiersMatch) throw new Error('client/src/utils/tier.js: could not find TIERS');
  const tiers = tiersMatch[1].split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean);

  const mapMatch = source.match(/export const FEATURE_MIN_TIER = \{([\s\S]*?)\};/);
  if (!mapMatch) throw new Error('client/src/utils/tier.js: could not find FEATURE_MIN_TIER');

  const minTier = {};
  for (const line of mapMatch[1].split('\n')) {
    const entry = line.match(/^\s*(\w+)\s*:\s*'([^']+)'/);
    if (entry) minTier[entry[1]] = entry[2];
  }
  return { tiers, minTier };
}

/** Client feature key → the server FEATURE the client is gating on. */
const FEATURE_ALIAS = {
  readinessScore: FEATURE.READINESS_SCORE,
  dashboardInsights: FEATURE.DASHBOARD_INSIGHTS,
};

describe('client and server tier tables agree', () => {
  const client = readClientTier();

  it('ranks the same tiers in the same order', () => {
    // Order is the whole meaning of the table: isAtLeast() is an index compare.
    expect(client.tiers).toEqual(TIERS);
  });

  it('gates every mirrored feature at exactly the tier the server requires', () => {
    for (const [clientKey, serverFeature] of Object.entries(FEATURE_ALIAS)) {
      expect(client.minTier[clientKey]).toBeDefined();
      expect(client.minTier[clientKey]).toBe(getMinimumTier(serverFeature));
    }
  });

  it('mirrors only features that exist on the server', () => {
    // A stale client entry gates a feature the server no longer restricts,
    // hiding something everyone is entitled to.
    for (const clientKey of Object.keys(client.minTier)) {
      expect(FEATURE_ALIAS[clientKey]).toBeDefined();
      expect(getMinimumTier(FEATURE_ALIAS[clientKey])).toBeDefined();
    }
  });

  it('never lets the client suppress a call the server would have allowed', () => {
    // The dangerous direction, stated directly. If the client demands a HIGHER
    // tier than the server, a paying student silently loses a feature and
    // nothing errors — because the mechanism is the absence of a request.
    for (const [clientKey, serverFeature] of Object.entries(FEATURE_ALIAS)) {
      for (const tier of TIERS) {
        const serverAllows = isAtLeast(tier, getMinimumTier(serverFeature));
        const clientAttempts = isAtLeast(tier, client.minTier[clientKey]);
        if (serverAllows) {
          expect(clientAttempts).toBe(true);
        }
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
});
