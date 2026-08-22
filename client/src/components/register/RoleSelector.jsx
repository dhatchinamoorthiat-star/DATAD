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
export const ACCOUNT_TYPES = [
  {
    value: 'student',
    label: 'Student',
    icon: GraduationCap,
    blurb: 'Build your readiness score and placement plan.',
  },
  {
    value: 'faculty',
    label: 'Faculty',
    icon: BookOpen,
    blurb: 'Mentor students and track cohort progress.',
  },
  {
    value: 'institution',
    label: 'Institution',
    icon: Building2,
    blurb: 'Bring your department or campus onto DATAD.',
  },
];

export default function RoleSelector({ value, onChange, label = 'I am joining as', className = '' }) {
  const reduce = useReducedMotion();
  const refs = useRef([]);

  // Native radios in a row can't give each card its own hover/selected surface
  // without a pile of pseudo-element hacks, so this is a real ARIA radiogroup:
  // roving tabindex (one tab stop for the group), arrows to move between
  // options, and selection following focus — which is what a radiogroup is
  // specified to do and what a keyboard user will expect here.
  const handleKeyDown = (e, index) => {
    const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    const delta = keys[e.key];
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + ACCOUNT_TYPES.length) % ACCOUNT_TYPES.length;
    onChange(ACCOUNT_TYPES[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div className={className}>
      <p className="mb-2 text-[11.5px] font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-2">
        {ACCOUNT_TYPES.map((option, i) => {
          const selected = value === option.value;
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              ref={(el) => { refs.current[i] = el; }}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={option.label}
              // Roving tabindex: only the selected card is in the tab order, so
              // Tab moves past the whole group in one press.
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(option.value)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              className={`group relative flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-colors duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/20 ${
                selected
                  ? 'border-primary-500 bg-primary-50/70 dark:border-primary-400/70 dark:bg-primary-500/10'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900/60 dark:hover:border-gray-700'
              }`}
            >
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
        {ACCOUNT_TYPES.find((o) => o.value === value)?.blurb}
      </p>
    </div>
  );
}
