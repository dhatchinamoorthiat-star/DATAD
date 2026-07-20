import { motion } from 'framer-motion';

const SPARKLES = [
  { deg: 12, duration: 4 },
  { deg: 84, duration: 6 },
  { deg: 156, duration: 5 },
  { deg: 220, duration: 7 },
];

export default function BillingToggle({ mode, onChange }) {
  const isYearly = mode === 'yearly';

  return (
    <div className="flex items-center justify-center gap-3" role="radiogroup" aria-label="Billing period">
      <span
        className={`text-sm font-medium transition-colors duration-200 ${
          !isYearly ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'
        }`}
      >
        Monthly
      </span>

      <div className="toggle-cont">
        <input
          type="checkbox"
          id="billing-toggle"
          className="toggle-input"
          checked={isYearly}
          onChange={() => onChange(isYearly ? 'monthly' : 'yearly')}
          aria-label="Toggle yearly billing"
          aria-checked={isYearly}
          role="switch"
        />
        <label className="toggle-label" htmlFor="billing-toggle">
          <span className="cont-icon">
            {SPARKLES.map((s, i) => (
              <span
                key={i}
                className="sparkle"
                style={{ '--deg': s.deg, '--duration': s.duration }}
              />
            ))}
            <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13z" />
            </svg>
          </span>
        </label>
      </div>

      <span
        className={`text-sm font-medium transition-colors duration-200 ${
          isYearly ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'
        }`}
      >
        Yearly
      </span>

      <span className="inline-flex w-20 justify-start">
        <motion.span
          initial={false}
          animate={{ opacity: isYearly ? 1 : 0, scale: isYearly ? 1 : 0.9 }}
          className="inline-flex items-center gap-1 rounded-full bg-danger-500/10 px-2.5 py-0.5 text-xs font-semibold text-danger-600 dark:text-danger-400"
        >
          Save 20%
        </motion.span>
      </span>
    </div>
  );
}
