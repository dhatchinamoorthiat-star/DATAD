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
  placement: { oneTime: 999, durationMonths: 4 },
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
    description: 'Notes, planner, journal, community, directory, finance tools and company browsing. 20 Dax messages a day.',
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
    tagline: 'Your everyday study and career toolkit.',
    description: '500 AI credits/day, ATS resume scoring, the interview question bank, company research, the LinkedIn Enhancer, semantic search and dashboard insights.',
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
    description: 'Everything in Pro, plus the interview simulator, readiness tracking, company comparison, salary bands, market intelligence and the roadmap generator. One payment, four months.',
    // One-time purchase — the same price whichever billing toggle is showing.
    oneTime: true,
    durationMonths: 4,
    monthlyPrice: 999,
    yearlyPrice: 999,
    cta: 'Get the Pass',
    color: 'purple',
    icon: 'Crown',
    badge: '4 Months',
  },
];

// Column values MIRROR server/subscription/featureRegistry.js — a row may only
// say `pro: true` if that feature's minimum tier is pro or lower. Asserted by
// server/tests/pricing.test.js.
export const FEATURE_ROWS = [
  // These two rows must match CREDIT_LIMITS and CHAT_QUOTAS on the server.
  { label: 'AI Credits per day', free: '0', trial: '150', pro: '500', placement: '2,500' },
  { label: 'Dax messages per day', free: '20', trial: '50', pro: '200', placement: '750' },

  { label: 'Notes & Planner', free: true, trial: true, pro: true, placement: true },
  { label: 'Personal Journal', free: true, trial: true, pro: true, placement: true },
  { label: 'Community & Feed', free: true, trial: true, pro: true, placement: true },
  { label: 'Directory & Finance', free: true, trial: true, pro: true, placement: true },
  { label: 'Browse Companies', free: true, trial: true, pro: true, placement: true },

  { label: 'AI Summarise', free: false, trial: true, pro: true, placement: true },
  { label: 'Resume Review', free: false, trial: true, pro: true, placement: true },
  { label: 'Planner Suggestions', free: false, trial: true, pro: true, placement: true },
  { label: 'Flashcards & Quizzes', free: false, trial: true, pro: true, placement: true },
  { label: 'Daily Briefing & Case', free: false, trial: true, pro: true, placement: true },

  { label: 'Resume ATS Score', free: false, trial: false, pro: true, placement: true },
  { label: 'Interview Questions', free: false, trial: false, pro: true, placement: true },
  { label: 'Company Research', free: false, trial: false, pro: true, placement: true },
  { label: 'LinkedIn Enhancer', free: false, trial: false, pro: true, placement: true },
  { label: 'Semantic Search', free: false, trial: false, pro: true, placement: true },
  { label: 'Dashboard Insights', free: false, trial: false, pro: true, placement: true },
  { label: 'Finance Assist', free: false, trial: false, pro: true, placement: true },

  { label: 'Interview Simulator', free: false, trial: false, pro: false, placement: true },
  { label: 'Career Readiness Score', free: false, trial: false, pro: false, placement: true },
  { label: 'Compare Companies', free: false, trial: false, pro: false, placement: true },
  { label: 'Career Advice', free: false, trial: false, pro: false, placement: true },
  { label: 'Salary Bands & Hiring Rounds', free: false, trial: false, pro: false, placement: true },
  { label: 'Market Intelligence', free: false, trial: false, pro: false, placement: true },
  { label: 'Career Roadmap Generator', free: false, trial: false, pro: false, placement: true },
];

// Deliberately NOT sold here: multi_workspace, advanced_ai_memory,
// knowledge_graph, autonomous_ai and case_generator. They exist in the server
// registry as roadmap slots but have no enforcement point anywhere in the
// codebase, and two of them are not products at all — "workspaces" is just the
// app's own navigation, and AI memory is baseline Dax behaviour injected into
// every prompt for every user. Listing them was selling things a paying student
// could not receive. Add the row back when the feature has a real gate.

export const FAQ_ITEMS = [
  { q: 'What is the Placement Pass?', a: 'A one-time purchase that unlocks the placement-season toolkit — the interview simulator, readiness tracking, company comparison, career advice, salary bands and hiring rounds, market intelligence and the career roadmap generator — for four months. It includes everything in Pro. It is not a subscription and does not renew.' },
  { q: 'What is the difference between Pro and the Placement Pass?', a: 'Pro is what you use all year: ATS resume scoring, the interview question bank, company research, the LinkedIn Enhancer, semantic search across your notes and dashboard insights. The Pass adds the tools you only need in the weeks around your interviews — mock interview rounds, readiness tracking, company comparison, salary bands and hiring rounds, and the career roadmap generator. If you are not in placement season yet, Pro is the one you want.' },
  { q: 'Why is the Placement Pass one-time instead of monthly?', a: 'Because that is how placement season works. You need these tools intensely for a few weeks, not evenly all year. One payment for the season is simpler than remembering to cancel.' },
  { q: 'How many AI credits do I get?', a: 'Trial: 150/day. Pro: 500/day. Placement Pass: 2,500/day. Dax chat is counted separately and never uses credits — Free gets 20 messages a day, Trial 50, Pro 200, Placement Pass 750.' },
  { q: 'How are AI credits calculated?', a: 'A credit reflects the compute a request uses. A short question costs 1–2 credits; a heavier task like a resume review or company research costs more. Chatting with Dax costs no credits at all.' },
  { q: 'Will unused AI credits roll over?', a: 'No. Credits reset daily at midnight so every day starts fresh. They do not accumulate.' },
  { q: 'What does the trial include?', a: 'The AI study tools for 14 days: summaries, resume review, planner suggestions, flashcards, quizzes and the daily briefing and case. It is a subset of Pro, so upgrading adds the career toolkit rather than just a bigger allowance.' },
  { q: 'What happens after my trial?', a: 'Your account returns to Free after 14 days. Nothing is deleted — your notes, planner and journal stay exactly as they were, and you can upgrade whenever you want.' },
  { q: 'Can I cancel anytime?', a: 'Yes. Pro can be cancelled at any point and stays active until the end of the period you have paid for. The Placement Pass is a one-time purchase, so there is nothing to cancel.' },
  { q: 'Can I buy the Placement Pass while on Pro?', a: 'Yes. The Pass includes everything in Pro, so it simply takes over for its four months.' },
  { q: 'Do yearly Pro subscribers save money?', a: 'Yes — ₹1,199 a year against ₹149 a month works out to roughly two months free.' },
  { q: 'How do I pay?', a: 'By UPI. You will see a QR code and a UPI ID at checkout; pay from any UPI app and submit the reference number. Your plan is activated once the payment is verified, usually within 24 hours.' },
];

export const TIER_TO_PLAN = {
  free: 'free',
  trial: 'trial',
  pro: 'pro',
  placement: 'placement',
};
