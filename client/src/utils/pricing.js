/**
 * Plan presentation. MIRRORS server/subscription/pricing.js and
 * server/ai/usageMeter.js — those are authoritative, this is display only.
 *
 * The previous version of this file disagreed with the server on every number
 * that mattered: it advertised 30/250/800 daily AI credits against real limits
 * of 500/500/2000, and quoted prices the payment route did not charge. Any
 * change here must be made server-side first.
 *
 * GST is not charged: DATAD is not GST-registered, so no tax line is shown or
 * collected. Prices below are the full amount payable.
 */

export const PRICES = {
  free:      { monthly: 0, yearly: 0 },
  trial:     { monthly: 0, yearly: 0 },
  pro:       { monthly: 149, yearly: 1199 },
  placement: { oneTime: 1299, durationMonths: 3 },
};

export function yearlySavings(planId) {
  const p = PRICES[planId];
  if (!p || !p.monthly) return 0;
  return Math.round((p.monthly * 12 - p.yearly) * 100) / 100;
}

export function yearlySavingsPercent(planId) {
  const p = PRICES[planId];
  if (!p || !p.monthly) return 0;
  return Math.round(((p.monthly * 12 - p.yearly) / (p.monthly * 12)) * 100);
}

export function monthlyEquivalent(yearlyPrice) {
  return Math.round((yearlyPrice / 12) * 100) / 100;
}

export function dailyEquivalent(price, days = 30) {
  return Math.round((price / days) * 100) / 100;
}

export function formatPrice(amount) {
  if (amount === 0) return '₹0';
  return '₹' + amount.toLocaleString('en-IN');
}

export function formatPriceDecimal(amount) {
  return '₹' + amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export const PLANS = [
  {
    id: 'free',
    label: 'Free',
    tagline: 'Everything your batch shares.',
    description: 'Notes, planner, journal, community, directory and finance tools. 20 Dax messages a day.',
    monthlyPrice: 0,
    yearlyPrice: 0,
    cta: 'Start Free',
    color: 'gray',
    icon: 'Sparkles',
  },
  {
    id: 'trial',
    label: 'Trial',
    tagline: 'Try the AI study tools for 14 days.',
    description: '150 AI credits/day, resume review, summaries, flashcards and quizzes. No card required.',
    monthlyPrice: 0,
    yearlyPrice: 0,
    cta: 'Start Free Trial',
    color: 'indigo',
    icon: 'Zap',
    badge: '14 Days Free',
  },
  {
    id: 'pro',
    label: 'Pro',
    tagline: 'Your everyday study assistant.',
    description: '500 AI credits/day, semantic search across your notes, dashboard insights and finance assist.',
    monthlyPrice: 149,
    yearlyPrice: 1199,
    cta: 'Upgrade to Pro',
    color: 'amber',
    icon: 'Crown',
    popular: true,
    popularBadge: 'Most Popular',
  },
  {
    id: 'placement',
    label: 'Placement Pass',
    tagline: 'For the season that decides the offer.',
    description: 'Everything in Pro, plus ATS scoring, interview simulator, company research and readiness tracking. One payment, three months.',
    // One-time purchase — the same price whichever billing toggle is showing.
    oneTime: true,
    durationMonths: 3,
    monthlyPrice: 1299,
    yearlyPrice: 1299,
    cta: 'Get the Pass',
    color: 'purple',
    icon: 'Crown',
    badge: '3 Months',
  },
];

export const FEATURE_ROWS = [
  // These two rows must match CREDIT_LIMITS and CHAT_QUOTAS on the server.
  { label: 'AI Credits per day', free: '0', trial: '150', pro: '500', placement: '1,500' },
  { label: 'Dax messages per day', free: '20', trial: '50', pro: '200', placement: '500' },

  { label: 'Notes & Planner', free: true, trial: true, pro: true, placement: true },
  { label: 'Personal Journal', free: true, trial: true, pro: true, placement: true },
  { label: 'Community & Feed', free: true, trial: true, pro: true, placement: true },
  { label: 'Directory & Finance', free: true, trial: true, pro: true, placement: true },

  { label: 'AI Summarise', free: false, trial: true, pro: true, placement: true },
  { label: 'Resume Review', free: false, trial: true, pro: true, placement: true },
  { label: 'Planner Suggestions', free: false, trial: true, pro: true, placement: true },
  { label: 'Flashcards & Quizzes', free: false, trial: true, pro: true, placement: true },
  { label: 'Daily Briefing & Case', free: false, trial: true, pro: true, placement: true },

  { label: 'Semantic Search', free: false, trial: false, pro: true, placement: true },
  { label: 'Dashboard Insights', free: false, trial: false, pro: true, placement: true },
  { label: 'Finance Assist', free: false, trial: false, pro: true, placement: true },

  { label: 'Resume ATS Score', free: false, trial: false, pro: false, placement: true },
  { label: 'Interview Simulator', free: false, trial: false, pro: false, placement: true },
  { label: 'Interview Questions', free: false, trial: false, pro: false, placement: true },
  { label: 'Company Research', free: false, trial: false, pro: false, placement: true },
  { label: 'Compare Companies', free: false, trial: false, pro: false, placement: true },
  { label: 'Career Readiness Score', free: false, trial: false, pro: false, placement: true },
  { label: 'Career Advice', free: false, trial: false, pro: false, placement: true },
  { label: 'Market Intelligence', free: false, trial: false, pro: false, placement: true },
  { label: 'Knowledge Graph', free: false, trial: false, pro: false, placement: true },
  { label: 'Advanced AI Memory', free: false, trial: false, pro: false, placement: true },
];

export const FAQ_ITEMS = [
  { q: 'What is the Placement Pass?', a: 'A one-time purchase that unlocks the placement toolkit — ATS scoring, interview simulator, company research, compare companies and readiness tracking — for three months. It includes everything in Pro. It is not a subscription and does not renew.' },
  { q: 'Why is the Placement Pass one-time instead of monthly?', a: 'Because that is how placement season works. You need these tools intensely for a few weeks, not evenly all year. One payment for the season is simpler than remembering to cancel.' },
  { q: 'How many AI credits do I get?', a: 'Trial: 150/day. Pro: 500/day. Placement Pass: 1,500/day. Dax chat is counted separately and never uses credits — Free gets 20 messages a day, Trial 50, Pro 200, Placement Pass 500.' },
  { q: 'How are AI credits calculated?', a: 'A credit reflects the compute a request uses. A short question costs 1–2 credits; a heavier task like a resume review or company research costs more. Chatting with Dax costs no credits at all.' },
  { q: 'Will unused AI credits roll over?', a: 'No. Credits reset daily at midnight so every day starts fresh. They do not accumulate.' },
  { q: 'What happens after my trial?', a: 'Your account returns to Free after 14 days. Nothing is deleted — your notes, planner and journal stay exactly as they were, and you can upgrade whenever you want.' },
  { q: 'Can I cancel anytime?', a: 'Yes. Pro can be cancelled at any point and stays active until the end of the period you have paid for. The Placement Pass is a one-time purchase, so there is nothing to cancel.' },
  { q: 'Can I buy the Placement Pass while on Pro?', a: 'Yes. The Pass includes everything in Pro, so it simply takes over for its three months.' },
  { q: 'Do yearly Pro subscribers save money?', a: 'Yes — ₹1,199 a year against ₹149 a month works out to roughly two months free.' },
  { q: 'How do I pay?', a: 'By UPI. You will see a QR code and a UPI ID at checkout; pay from any UPI app and submit the reference number. Your plan is activated once the payment is verified, usually within 24 hours.' },
];

export const TIER_TO_PLAN = {
  free: 'free',
  trial: 'trial',
  pro: 'pro',
  placement: 'placement',
};
