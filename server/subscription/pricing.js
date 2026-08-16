/**
 * Single source of truth for what a plan costs and how long it lasts.
 *
 * There were three disagreeing price tables before this file:
 *   routes/subscriptionRoutes.js  { pro: 299, max: 499 }   ← recorded as amountPaid
 *   routes/adminRoutes.js         pro 4799 / max 12499     ← used for MRR
 *   client/src/utils/pricing.js   pro 499 / max 1299       ← shown to the student
 *
 * So the amount stored against a payment matched neither the amount charged nor
 * the amount reported. client/src/utils/pricing.js now mirrors this file, and
 * that mirroring is asserted by tests/pricing.test.js.
 *
 * Pricing model (see the pricing discussion in PRICING.md):
 *   Pro         recurring, impulse-priced, for the AI study tools
 *   Placement   one-time 3-month pass for the placement-season tools, which is
 *               where an MBA student's willingness to pay actually spikes
 */

const PLAN_PRICING = {
  pro: {
    monthly: 149,
    yearly: 1199,
  },
  placement: {
    // One-time purchase, not a subscription: no renewal, no recurring mandate
    // to collect — which matters because payment is manual UPI today.
    onetime: 1299,
    durationMonths: 3,
  },
};

const BILLING_CYCLES = ['monthly', 'yearly', 'onetime'];

/** Which billing cycles a tier can be bought on. */
function cyclesFor(tier) {
  if (tier === 'pro') return ['monthly', 'yearly'];
  if (tier === 'placement') return ['onetime'];
  return [];
}

/** Price in rupees, or null if the tier/cycle combination isn't sold. */
function priceFor(tier, billing) {
  const plan = PLAN_PRICING[tier];
  if (!plan) return null;
  const amount = plan[billing];
  return typeof amount === 'number' ? amount : null;
}

/** How many months of access a purchase grants. */
function durationMonthsFor(tier, billing) {
  if (tier === 'placement') return PLAN_PRICING.placement.durationMonths;
  if (tier === 'pro') return billing === 'yearly' ? 12 : 1;
  return 1;
}

/**
 * Expiry date for a newly activated purchase.
 *
 * This previously used a flat oneMonthFromNow() for every approved request, so
 * a student who paid the yearly price received one month of access.
 */
function expiryFor(tier, billing, from = new Date()) {
  const d = new Date(from);
  d.setMonth(d.getMonth() + durationMonthsFor(tier, billing));
  return d;
}

/** Monthly-equivalent revenue for a tier, for MRR reporting. */
function monthlyEquivalent(tier, billing) {
  const price = priceFor(tier, billing);
  if (price === null) return 0;
  return price / durationMonthsFor(tier, billing);
}

module.exports = {
  PLAN_PRICING,
  BILLING_CYCLES,
  cyclesFor,
  priceFor,
  durationMonthsFor,
  expiryFor,
  monthlyEquivalent,
};
