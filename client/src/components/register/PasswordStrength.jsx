import { Check, Minus } from 'lucide-react';

// Password strength meter, split into two tiers on purpose.
//
// REQUIREMENTS are the server's actual rule (authController.passwordProblem:
// 8+ characters, at least one letter and one digit). Nothing else can block
// submission — a meter that demands a symbol the API happily accepts is a
// meter that invents policy, and the two drift the moment either side changes.
//
// BOOSTERS are advice. They move the bar and never gate the button, so
// "Strong" is something to reach for rather than a toll gate. This is also why
// the score tops out at 4 with only three boosters: length counts twice,
// because length is the property that actually resists cracking.

export const REQUIREMENTS = [
  { id: 'len', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'alnum', label: 'A letter and a number', test: (p) => /[a-zA-Z]/.test(p) && /[0-9]/.test(p) },
];

const BOOSTERS = [
  { id: 'long', label: '12 characters or more', test: (p) => p.length >= 12 },
  { id: 'case', label: 'Upper and lower case', test: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
  { id: 'symbol', label: 'A symbol', test: (p) => /[^a-zA-Z0-9]/.test(p) },
];

const LEVELS = [
  { label: 'Too short', bar: 'bg-gray-200 dark:bg-gray-700', text: 'text-gray-400' },
  { label: 'Weak', bar: 'bg-danger-500', text: 'text-danger-600 dark:text-danger-400' },
  { label: 'Fair', bar: 'bg-warn-500', text: 'text-warn-700 dark:text-warn-500' },
  { label: 'Good', bar: 'bg-primary-500', text: 'text-primary-600 dark:text-primary-400' },
  { label: 'Strong', bar: 'bg-success-500', text: 'text-success-700 dark:text-success-500' },
];

/** Meets the server's rule — the only thing that should gate submission. */
export const meetsPolicy = (password = '') => REQUIREMENTS.every((r) => r.test(password));

/** 0–4. 0 means the password cannot be submitted yet. */
export function scorePassword(password = '') {
  if (!meetsPolicy(password)) return 0;
  const boosts = BOOSTERS.filter((b) => b.test(password)).length;
  const lengthBonus = password.length >= 16 ? 1 : 0;
  return Math.min(4, 1 + boosts + lengthBonus);
}

// No Framer here either: the meter is content, and content on this screen does
// not get to depend on an animation frame (see index.css). The bars are a CSS
// transform transition, which the compositor runs without JS.
export default function PasswordStrength({ password = '', className = '' }) {
  const score = scorePassword(password);
  const level = LEVELS[score];

  // Nothing typed yet: no meter, no checklist, no red. Scolding an empty field
  // before anyone has touched it is how a form starts a relationship badly.
  if (!password) return null;

  const checks = [...REQUIREMENTS, ...BOOSTERS].map((c) => ({
    ...c,
    passed: c.test(password),
    required: REQUIREMENTS.some((r) => r.id === c.id),
  }));

  return (
    <div className={`field-msg space-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1" aria-hidden="true">
          {[1, 2, 3, 4].map((seg) => (
            <div key={seg} className="h-1 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
              <div
                className={`h-full origin-left rounded-full transition-transform duration-300 ease-out ${seg <= score ? level.bar : ''}`}
                style={{ transform: `scaleX(${seg <= score ? 1 : 0})` }}
              />
            </div>
          ))}
        </div>
        {/* Polite, not assertive: this updates on every keystroke, and an
            assertive region would interrupt the typist with it each time. */}
        <p className={`w-16 text-right text-[11px] font-semibold ${level.text}`} aria-live="polite">
          {level.label}
        </p>
      </div>

      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
          {checks.map((c) => (
            <li key={c.id} className="flex items-center gap-1.5">
              {c.passed ? (
                <Check className="h-3 w-3 shrink-0 text-success-500" aria-hidden="true" />
              ) : (
                <Minus className="h-3 w-3 shrink-0 text-gray-300 dark:text-gray-700" aria-hidden="true" />
              )}
              <span
                className={`text-[11px] leading-tight ${
                  c.passed
                    ? 'text-gray-500 line-through decoration-gray-300 dark:text-gray-500'
                    : c.required
                      ? 'font-medium text-gray-700 dark:text-gray-300'
                      : 'text-gray-400 dark:text-gray-600'
                }`}
              >
                {c.label}
                {!c.required && !c.passed && <span className="sr-only"> (optional, strengthens your password)</span>}
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}
