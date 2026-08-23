/**
 * Tier ranking, client side.
 *
 * A mirror of `server/subscription/tierHierarchy.js`. It is NOT authorisation —
 * the server enforces every feature gate through `requireFeature`, and nothing
 * here can grant access to anything. Its only job is to stop the client asking
 * for things it already knows it will be refused.
 *
 * The dashboard called `getReadiness()` and `dashboardInsights()` on every load
 * for every user. Readiness needs the Placement pass and dashboard insights
 * needs Pro, so for a free user — the default, and most users — both were a
 * guaranteed 403 on every single page view. The failures were swallowed by
 * `.catch(() => {})`, so nothing visibly broke, which is exactly why it
 * survived: two red rows in the network tab on every load, a rate-limit budget
 * spent on requests whose answer was known in advance, and real 403s made
 * invisible among the routine ones.
 *
 * Keeping a copy of the ranking on the client is a real duplication and worth
 * naming. The alternative — an endpoint listing the caller's features — is the
 * better design, but it is an extra request on the critical path to save two,
 * and this list has changed once in the project's history.
 */

/** Lowest to highest. Each tier includes everything below it. */
export const TIERS = ['free', 'trial', 'pro', 'placement'];

const RANK = Object.fromEntries(TIERS.map((t, i) => [t, i]));

/** Unknown tiers rank as `free`: the client fails towards asking for less. */
export const rankOf = (tier) => RANK[tier] ?? 0;

/** Does `userTier` meet `minimumTier`? */
export const isAtLeast = (userTier, minimumTier) => rankOf(userTier) >= rankOf(minimumTier);

/**
 * Minimum tier per gated feature the dashboard touches.
 *
 * Mirrors FEATURE_MIN_TIER in server/subscription/featureRegistry.js. Only the
 * entries the client actually gates on are listed — a partial copy that says so
 * is easier to keep honest than a full one that drifts silently.
 */
export const FEATURE_MIN_TIER = {
  readinessScore: 'placement',
  dashboardInsights: 'pro',
};

/**
 * Should the client attempt this feature's request?
 *
 * Deliberately permissive when the tier is unknown: if `user` has not loaded
 * yet, we allow the call rather than suppress it. A suppressed request for a
 * paying student is a broken feature; an extra 403 for a free one is noise.
 */
export function canUseFeature(userTier, feature) {
  const required = FEATURE_MIN_TIER[feature];
  if (!required) return true;
  if (!userTier) return true;
  return isAtLeast(userTier, required);
}
