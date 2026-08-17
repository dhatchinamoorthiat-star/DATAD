import { motion } from 'framer-motion';
import { Crown, Sparkles, Zap, Check } from 'lucide-react';
import { yearlySavings, monthlyEquivalent, dailyEquivalent, formatPrice } from '../../utils/pricing';

const CARD_COLORS = {
  gray: {
    border: 'border-gray-200 dark:border-gray-700',
    accent: 'text-gray-500',
    badge: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    btn: 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800',
    icon: 'text-gray-400',
  },
  indigo: {
    border: 'border-indigo-200 dark:border-indigo-800/60',
    accent: 'text-indigo-500',
    badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
    btn: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    icon: 'text-indigo-500',
  },
  amber: {
    border: 'border-amber-200 dark:border-amber-800/60',
    accent: 'text-amber-500',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    btn: 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-500/20',
    icon: 'text-amber-500',
  },
  purple: {
    border: 'border-purple-200 dark:border-purple-800/60',
    accent: 'text-purple-500',
    badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    btn: 'bg-purple-600 hover:bg-purple-700 text-white shadow-sm shadow-purple-600/20',
    icon: 'text-purple-500',
  },
};

const ICON_MAP = { Crown, Sparkles, Zap };

export default function PricingCard({ plan, billing, onSelect, currentTier, trialUsed, trialLoading }) {
  const colors = CARD_COLORS[plan.color];
  const Icon = ICON_MAP[plan.icon] || Sparkles;
  // A one-time plan ignores the monthly/yearly toggle entirely — the Placement
  // Pass costs the same whichever way the switch happens to be set.
  const isOneTime = Boolean(plan.oneTime);
  const isYearly = !isOneTime && billing === 'yearly';
  const price = isOneTime ? plan.monthlyPrice : (billing === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice);
  const isRecurringPaid = plan.id === 'pro';

  const isCurrent = currentTier === plan.id;
  const isTrialActive = plan.id === 'trial' && currentTier === 'trial';
  const isTrialDisabled = plan.id === 'trial' && !isTrialActive && (trialUsed || currentTier !== 'free');
  const disabled = isCurrent || isTrialDisabled || (plan.id === 'trial' && trialLoading);

  const handleClick = () => {
    if (disabled) return;
    onSelect(plan);
  };

  const savings = isRecurringPaid && isYearly ? yearlySavings(plan.id) : 0;
  const monthsFree = isRecurringPaid && isYearly ? Math.round((savings / plan.monthlyPrice) * 10) / 10 : 0;
  const meq = isRecurringPaid && isYearly ? monthlyEquivalent(price) : 0;
  const deq = isRecurringPaid
    ? dailyEquivalent(price, isYearly ? 365 : 30)
    : isOneTime
      ? dailyEquivalent(price, (plan.durationMonths || 3) * 30)
      : 0;

  const features = plan.id === 'free'
    ? ['Notes & Journal', 'Planner & Reminders', 'Community Access', 'Finance Tracker', 'No AI Access']
    : plan.id === 'trial'
    ? ['30 AI credits/day', 'Resume Reviews', 'Study Tools (Flashcards, Quizzes)', 'Daily Case Studies', 'Interview Questions', 'No card required', 'Expires after 14 days']
    : plan.id === 'pro'
    ? ['250 AI credits/day', 'Resume Review & ATS Score', 'Company Research', 'Interview Practice', 'Career Readiness', 'Finance Assist', 'Priority Support', 'Briefing & Insights']
    : ['800 AI credits/day', 'Interview Simulator', 'Compare Companies', 'Advanced Career Advice', 'Knowledge Graph', 'Advanced AI Memory', 'Market Intelligence', 'Case Generator', 'Premium Support'];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={`relative flex flex-col rounded-2xl border bg-white transition-all duration-300 dark:bg-gray-900 ${plan.popular ? 'border-2 shadow-lg shadow-amber-500/5' : 'border border-gray-200 shadow-sm dark:border-gray-800'} ${disabled ? 'opacity-60' : ''}`}
    >
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-white shadow-sm">
            <Crown className="h-3 w-3" />
            Most Popular
          </span>
        </div>
      )}
      {plan.badge && !plan.popular && (
        <div className="absolute -top-3 left-1/2 z-10 -translate-x-1/2">
          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${colors.badge}`}>
            {plan.badge}
          </span>
        </div>
      )}

      <div className="flex flex-1 flex-col p-6">
        <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl ${plan.color === 'gray' ? 'bg-gray-100 dark:bg-gray-800' : colors.badge}`}>
          <Icon className={`h-5 w-5 ${colors.icon}`} />
        </div>

        <h3 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
          {plan.label}
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{plan.tagline}</p>

        <div className="mt-4">
          {price === 0 ? (
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">₹0</span>
            </div>
          ) : (
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                  {formatPrice(price)}
                </span>
                <span className="text-sm font-medium text-gray-400 dark:text-gray-500">
                  {isOneTime ? 'one-time' : `/${isYearly ? 'year' : 'month'}`}
                </span>
              </div>
              {isOneTime && (
                <div className="mt-1 space-y-0.5">
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {plan.durationMonths || 3} months access · does not renew
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    ≈ {formatPrice(deq)}/day
                  </p>
                </div>
              )}
              {isRecurringPaid && isYearly && (
                <div className="mt-1 space-y-0.5">
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {formatPrice(meq)}/month
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    ≈ {formatPrice(deq)}/day
                  </p>
                </div>
              )}
              {isRecurringPaid && !isYearly && (
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  ≈ {formatPrice(deq)} per day
                </p>
              )}
              {isRecurringPaid && !isYearly && (
                <p className="text-xs text-gray-400 dark:text-gray-500">Billed monthly</p>
              )}
            </div>
          )}
        </div>

        {savings > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-3 rounded-xl bg-success-50 px-3 py-2 dark:bg-success-950/20"
          >
            <p className="text-xs font-semibold text-success-700 dark:text-success-400">
              Save {formatPrice(savings)} / year
            </p>
            <p className="text-[11px] text-success-600 dark:text-success-500">
              That&rsquo;s almost {monthsFree} months free
            </p>
          </motion.div>
        )}

        <ul className="mt-5 flex-1 space-y-2.5">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-gray-400">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success-500" />
              {f}
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={handleClick}
          disabled={disabled}
          aria-label={plan.id === 'trial' && trialLoading ? 'Activating trial...' : `${plan.label} plan: ${plan.cta}`}
          className={`mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${colors.btn}`}
        >
          {plan.id === 'trial' && trialLoading ? (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : isTrialActive ? (
            'Trial Active'
          ) : isCurrent ? (
            'Current Plan'
          ) : isTrialDisabled ? (
            'Trial Used'
          ) : (
            plan.cta
          )}
        </button>
      </div>
    </motion.div>
  );
}
