import { useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { GraduationCap, BookOpen, Building2 } from 'lucide-react';

// Who is signing up.
//
// The field is `accountType`, NOT `role`. `role` is already taken on the User
// model as the authorisation role (`admin` | `member`), and the register
// endpoint sets it itself from the admin-email check. A form posting
// `role: 'institution'` would be ignored today and would look exactly like a
// privilege-escalation attempt the day anyone wires req.body.role through.
// Different concept, different name.
// `available` is the honesty flag, and it is the point of this edit.
//
// Faculty and Institution were selectable, and the server has never read
// `accountType` at all — grep it: there are zero references under server/. A
// lecturer picked "Faculty", read "Mentor students and track cohort progress",
// and received an ordinary student account with no mentoring, no cohort view,
// and no indication anything had been ignored. `User.role` is still
// `enum: ['admin', 'member']`; there is no faculty route, controller or
// permission anywhere. Opportunity.js reserves the string with the comment
// "Company/Faculty/Alumni models do not exist yet".
//
// Offering a choice and discarding it is worse than not offering it, because
// the user forms an expectation and nothing ever corrects them. So an
// unavailable type cannot be chosen. It is hidden by default; setting
// VITE_SHOW_PLANNED_ACCOUNT_TYPES=true shows it disabled and labelled, for a
// landing page that wants to signal the roadmap without lying about today.
//
// This is presentation only. The lasting guarantee is in RegisterPage, which
// coerces anything unavailable back to 'student' before the request is built,
// so the UI and the account that gets created cannot disagree.
export const ACCOUNT_TYPES = [
  {
    value: 'student',
    label: 'Student',
    icon: GraduationCap,
    blurb: 'Build your readiness score and placement plan.',
    available: true,
  },
  {
    value: 'faculty',
    label: 'Faculty',
    icon: BookOpen,
    blurb: 'Mentor students and track cohort progress.',
    available: false,
  },
  {
    value: 'institution',
    label: 'Institution',
    icon: Building2,
    blurb: 'Bring your department or campus onto DATAD.',
    available: false,
  },
];

/** The types a person can actually sign up as today. */
export const AVAILABLE_ACCOUNT_TYPES = ACCOUNT_TYPES.filter((t) => t.available);

/** Is this a type the backend can actually create? */
export const isAvailableAccountType = (value) =>
  ACCOUNT_TYPES.some((t) => t.value === value && t.available);

export default function RoleSelector({ value, onChange, label = 'I am joining as', className = '' }) {
  const reduce = useReducedMotion();
  const refs = useRef([]);

  // Planned-but-unbuilt types are hidden unless someone deliberately opts in.
  const showPlanned = import.meta.env.VITE_SHOW_PLANNED_ACCOUNT_TYPES === 'true';
  const options = showPlanned ? ACCOUNT_TYPES : AVAILABLE_ACCOUNT_TYPES;

  // With one real account type there is no choice to present, and a radiogroup
  // holding a single permanently-selected option is a control that does nothing.
  if (options.length < 2) return null;

  // Native radios in a row can't give each card its own hover/selected surface
  // without a pile of pseudo-element hacks, so this is a real ARIA radiogroup:
  // roving tabindex (one tab stop for the group), arrows to move between
  // options, and selection following focus — which is what a radiogroup is
  // specified to do and what a keyboard user will expect here.
  // Arrow keys skip past anything unavailable rather than landing on it and
  // selecting it — selection follows focus in a radiogroup, so stopping on a
  // disabled option would select something that cannot be created.
  const handleKeyDown = (e, index) => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    const delta = keys[e.key];
    if (!delta) return;
    e.preventDefault();

    let next = index;
    for (let step = 0; step < options.length; step++) {
      next = (next + delta + options.length) % options.length;
      if (options[next].available) break;
    }
    if (!options[next].available) return;

    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div className={className}>
      <p className="mb-2 text-[11.5px] font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <div
        role="radiogroup"
        aria-label={label}
        className={`grid gap-2 ${options.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}
      >
        {options.map((option, i) => {
          const selected = value === option.value;
          const Icon = option.icon;
          const unavailable = !option.available;
          return (
            <button
              key={option.value}
              ref={(el) => { refs.current[i] = el; }}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={unavailable ? `${option.label} — coming soon` : option.label}
              // The attribute, not just a class. A disabled control cannot be
              // clicked, cannot be submitted, and is announced as unavailable —
              // which is the whole requirement: nobody chooses Faculty and
              // quietly receives a student account.
              disabled={unavailable}
              aria-disabled={unavailable || undefined}
              // Roving tabindex: only the selected card is in the tab order, so
              // Tab moves past the whole group in one press.
              tabIndex={selected ? 0 : -1}
              onClick={() => option.available && onChange(option.value)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              className={`group relative flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-colors duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/20 ${
                unavailable
                  ? 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-60 dark:border-gray-800 dark:bg-gray-900/30'
                  : selected
                    ? 'border-primary-500 bg-primary-50/70 dark:border-primary-400/70 dark:bg-primary-500/10'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900/60 dark:hover:border-gray-700'
              }`}
            >
              {unavailable && (
                <span className="absolute right-1 top-1 rounded-full bg-gray-200 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  Soon
                </span>
              )}
              {selected && !reduce && (
                // Shared layout id: the highlight slides between cards instead
                // of blinking out here and in over there.
                <motion.span
                  layoutId="account-type-glow"
                  className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-primary-500/30"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <Icon
                className={`h-[18px] w-[18px] transition-colors duration-200 ${
                  selected
                    ? 'text-primary-600 dark:text-primary-300'
                    : 'text-gray-400 group-hover:text-gray-500 dark:text-gray-500'
                }`}
                aria-hidden="true"
              />
              <span
                className={`text-[12.5px] font-semibold leading-none ${
                  selected ? 'text-primary-700 dark:text-primary-200' : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {option.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* One shared description line rather than three cramped ones inside the
          cards — the cards stay scannable, and the detail appears for whichever
          is selected. */}
      <p className="mt-1 min-h-[15px] text-[11.5px] text-gray-400 dark:text-gray-500">
        {options.find((o) => o.value === value)?.blurb}
      </p>
    </div>
  );
}
