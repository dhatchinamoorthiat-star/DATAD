import { useId, useState } from 'react';
import { Check, Eye, EyeOff, AlertCircle } from 'lucide-react';

// Floating-label text field for the register panel.
//
// Not `.input` from index.css: that one puts the label above the box, which
// stacks five labels, five boxes and five error slots into a very tall column.
// Folding the label into the box keeps the whole account step on one screen at
// 860px, which is what makes the form feel short.
//
// The label is a real <label for>, not a placeholder pretending to be one.
// Placeholder-as-label disappears the moment someone types, so anyone who gets
// interrupted mid-form comes back to five filled boxes and no idea which is
// which — and screen readers get nothing to announce.
//
// `hint` is the personality microcopy ("Let's start with knowing you"). It is
// wired through aria-describedby, so it is spoken with the field rather than
// being decoration only sighted users receive.
//
// No Framer in this file, on purpose. The message slot swaps on every
// keystroke; an AnimatePresence exit that never completes (rAF is throttled in
// a background tab) strands the previous error in the DOM under a role="alert"
// while the field reads as valid. CSS animations can't get stuck like that.
export default function FloatingField({
  label,
  hint,
  error,
  valid = false,
  type = 'text',
  registration,
  className = '',
  ...inputProps
}) {
  const reactId = useId();
  const id = inputProps.id || `ff-${reactId}`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const isPassword = type === 'password';
  const [revealed, setRevealed] = useState(false);
  const resolvedType = isPassword && revealed ? 'text' : type;

  // Trailing slot is a toggle for passwords and a validity tick otherwise, so
  // the two never collide in the same corner.
  const showTick = valid && !error && !isPassword;
  const hasTrailing = isPassword || showTick;

  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={className}>
      <div className="relative">
        <input
          {...registration}
          {...inputProps}
          id={id}
          type={resolvedType}
          // A space, not empty: :placeholder-shown is what drives the label,
          // and a field with no placeholder attribute never matches it.
          placeholder=" "
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          className={`peer w-full rounded-xl border bg-white px-3.5 pb-1.5 pt-[20px] text-sm text-gray-900 outline-none transition-colors duration-150 placeholder:text-transparent focus:ring-4 dark:bg-gray-900/60 dark:text-gray-100 ${
            hasTrailing ? 'pr-11' : ''
          } ${
            error
              ? 'border-danger-400 focus:border-danger-500 focus:ring-danger-500/12 dark:border-danger-500/70'
              : 'border-gray-200 focus:border-primary-500 focus:ring-primary-500/12 dark:border-gray-800 dark:focus:border-primary-400'
          }`}
        />

        <label
          htmlFor={id}
          className={`pointer-events-none absolute left-3.5 top-[14px] origin-left text-sm transition-all duration-200 ease-out peer-focus:top-[6px] peer-focus:text-[11px] peer-focus:font-medium peer-[:not(:placeholder-shown)]:top-[6px] peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:font-medium ${
            error
              ? 'text-danger-500 peer-focus:text-danger-500'
              : 'text-gray-400 peer-focus:text-primary-600 dark:peer-focus:text-primary-400'
          }`}
        >
          {label}
        </label>

        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            // Not tabIndex={-1}: a keyboard user who mistypes a password has no
            // other way to check it, and skipping the control is what forces
            // them to clear the field and start again.
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 transition-colors hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:hover:text-gray-300"
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
          >
            {revealed ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          </button>
        )}

        {showTick && (
          <span className="field-tick absolute right-3.5 top-1/2 text-success-500">
            <Check className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Looks good</span>
          </span>
        )}
      </div>

      {/* One reserved slot for hint-or-error. Swapping text inside a fixed
          slot keeps the fields below from jumping every time validation
          changes on a keystroke. */}
      <div className="mt-0.5 min-h-[15px] px-0.5">
        {error ? (
          <p
            id={errorId}
            role="alert"
            // Keyed so React replaces the node when the message changes,
            // re-running the entrance instead of silently swapping text.
            key={error}
            className="field-msg flex items-center gap-1 text-[11.5px] font-medium text-danger-600 dark:text-danger-400"
          >
            <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="text-[11.5px] text-gray-400 dark:text-gray-500">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
