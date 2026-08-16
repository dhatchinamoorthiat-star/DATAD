// Ranked, lowest to highest: each tier includes everything below it.
// 'placement' replaced 'max' — see PRICING.md. It is the top rank because the
// Placement Pass is a superset of Pro, sold as a one-time 3-month pass rather
// than a recurring plan. Keeping it in the same linear rank means every
// existing isAtLeast() check keeps working unchanged.
const TIERS = ['free', 'trial', 'pro', 'placement'];

const TIER_RANK = Object.fromEntries(TIERS.map((t, i) => [t, i]));

function getRank(tier) {
  return TIER_RANK[tier] ?? 0;
}

function isAtLeast(userTier, minimumTier) {
  return getRank(userTier) >= getRank(minimumTier);
}

function getMinimumTierForRank(rank) {
  return TIERS[rank] || 'free';
}

module.exports = { TIERS, TIER_RANK, getRank, isAtLeast, getMinimumTierForRank };
