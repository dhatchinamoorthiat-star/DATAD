export const PRICES = {
  free:  { monthly: 0, yearly: 0 },
  trial: { monthly: 0, yearly: 0 },
  pro:   { monthly: 499, yearly: 4799 },
  max:   { monthly: 1299, yearly: 12499 },
};

const GST_RATE = 0.18;

export function gstOf(amount) {
  return Math.round(amount * GST_RATE * 100) / 100;
}

export function totalWithGst(amount) {
  return Math.round(amount * (1 + GST_RATE) * 100) / 100;
}

export function yearlySavings(planId) {
  const p = PRICES[planId];
  if (!p || p.monthly === 0) return 0;
  return Math.round((p.monthly * 12 - p.yearly) * 100) / 100;
}

export function yearlySavingsPercent(planId) {
  const p = PRICES[planId];
  if (!p || p.monthly === 0) return 0;
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
    tagline: 'Start your journey.',
    description: 'Basic tools: notes, planner, journal, and community. No AI access.',
    monthlyPrice: 0,
    yearlyPrice: 0,
    cta: 'Start Free',
    color: 'gray',
    icon: 'Sparkles',
  },
  {
    id: 'trial',
    label: 'Trial',
    tagline: 'Experience everything free for 14 days.',
    description: '30 AI credits/day, resume reviews, interview practice, and full AI access. No card required.',
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
    tagline: 'Perfect for serious students.',
    description: '250 AI credits/day, priority support, company research, interview prep, and more.',
    monthlyPrice: 499,
    yearlyPrice: 4799,
    cta: 'Upgrade to Pro',
    color: 'amber',
    icon: 'Crown',
    popular: true,
    popularBadge: 'Most Popular',
  },
  {
    id: 'max',
    label: 'Max',
    tagline: 'Built for professionals and power users.',
    description: '800 AI credits/day, advanced AI models, interview simulator, market intelligence, and everything in Pro.',
    monthlyPrice: 1299,
    yearlyPrice: 12499,
    cta: 'Go Max',
    color: 'purple',
    icon: 'Crown',
    badge: 'Ultimate',
  },
];

export const FEATURE_ROWS = [
  { label: 'AI Credits per day', free: '0', trial: '30', pro: '250', max: '800' },
  { label: 'Chat messages per day', free: '10', trial: '30', pro: '100', max: '1000' },

  { label: 'Notes & Planner', free: true, trial: true, pro: true, max: true },
  { label: 'Personal Journal', free: true, trial: true, pro: true, max: true },
  { label: 'Community Access', free: true, trial: true, pro: true, max: true },
  { label: 'Directory & Finance', free: true, trial: true, pro: true, max: true },

  { label: 'AI Summarise', free: false, trial: true, pro: true, max: true },
  { label: 'Resume Review', free: false, trial: true, pro: true, max: true },
  { label: 'Study Tools (Flashcards, Quizzes)', free: false, trial: true, pro: true, max: true },
  { label: 'Briefing & Daily Case', free: false, trial: true, pro: true, max: true },
  { label: 'Semantic Search', free: false, trial: true, pro: true, max: true },
  { label: 'Dashboard Insights', free: false, trial: true, pro: true, max: true },

  { label: 'Interview Questions', free: false, trial: false, pro: true, max: true },
  { label: 'Company Research & Info', free: false, trial: false, pro: true, max: true },
  { label: 'Finance Assist', free: false, trial: false, pro: true, max: true },
  { label: 'Resume ATS Score', free: false, trial: false, pro: true, max: true },
  { label: 'Career Readiness Score', free: false, trial: false, pro: true, max: true },
  { label: 'Priority Support', free: false, trial: false, pro: true, max: true },

  { label: 'Interview Simulator', free: false, trial: false, pro: false, max: true },
  { label: 'Compare Companies', free: false, trial: false, pro: false, max: true },
  { label: 'Career Advice', free: false, trial: false, pro: false, max: true },
  { label: 'Knowledge Graph', free: false, trial: false, pro: false, max: true },
  { label: 'Advanced AI Memory', free: false, trial: false, pro: false, max: true },
  { label: 'Multi-workspace', free: false, trial: false, pro: false, max: true },
  { label: 'Autonomous AI', free: false, trial: false, pro: false, max: true },
  { label: 'Market Intelligence', free: false, trial: false, pro: false, max: true },
  { label: 'Case Generator', free: false, trial: false, pro: false, max: true },
];

export const FAQ_ITEMS = [
  { q: 'Can I cancel anytime?', a: 'Yes. You can cancel your subscription at any time from your account settings. Your access continues until the end of your current billing period.' },
  { q: 'What happens after my trial?', a: 'After your 14-day trial, your account automatically converts to the Free plan. Your data and progress are saved — upgrade anytime to pick up where you left off.' },
  { q: 'Will unused AI credits roll over?', a: 'No. AI credits reset daily at midnight (IST). They are designed to give you consistent daily access. Unused credits do not accumulate.' },
  { q: 'How many credits do I get?', a: 'Trial: 30/day. Pro: 250/day. Max: 800/day. Chat quotas are separate: Trial 30 msgs/day, Pro 100 msgs/day, Max 1000 msgs/day.' },
  { q: 'Can I change plans later?', a: 'Absolutely. You can upgrade or downgrade at any time. Upgrades take effect immediately; downgrades apply at the next billing cycle.' },
  { q: 'Do you charge GST?', a: 'Yes. 18% GST is applicable on all Pro and Max plans for Indian customers. The final amount is shown during checkout.' },
  { q: 'How are AI credits calculated?', a: 'AI Credits represent Dax\'s AI compute usage. Simple questions use very few credits (2–5). Complex tasks like Resume Review or Company Research use 20–50. You never pay extra for credits.' },
  { q: 'Do yearly subscribers save money?', a: 'Yes. Yearly billing saves you approximately 20% compared to monthly billing — that\'s almost 2 months free.' },
];

export const TIER_TO_PLAN = {
  free: 'free',
  trial: 'trial',
  pro: 'pro',
  max: 'max',
};
