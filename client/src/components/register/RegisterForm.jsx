import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronDown, Gift } from 'lucide-react';
import FloatingField from './FloatingField';
import PasswordStrength, { meetsPolicy } from './PasswordStrength';
import RoleSelector from './RoleSelector';

// Phase 01 — the account itself.
//
// Replaces the old WelcomeStep + ProgramStep pair. WelcomeStep was a
// full screen of feature tiles before a single field; the hero panel now
// carries that job, so signup opens on something you can actually fill in.
//
// Field-level microcopy is doing real work here, not decoration: each hint
// answers the question the field provokes ("why do you want this?"), which is
// where signup forms usually lose people.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterForm() {
  const { register, watch, setValue, formState: { errors } } = useFormContext();
  const reduce = useReducedMotion();
  const [showExtras, setShowExtras] = useState(false);

  const name = watch('name', '');
  const email = watch('email', '');
  const password = watch('password', '');
  const confirmPassword = watch('confirmPassword', '');
  const accountType = watch('accountType', 'student');

  return (
    // CSS entrance, not Framer: this wrapper holds every input on the screen,
    // and a JS-driven fade that starts at opacity 0 means no form at all if the
    // animation frame never runs. See index.css.
    <div className="identity-rise">
      <header className="mb-5">
        <h2 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-gray-900 dark:text-white">
          Create your DATAD identity
        </h2>
        <p className="mt-1.5 text-[13.5px] text-gray-500 dark:text-gray-400">
          Start your personalised career intelligence journey.
        </p>
      </header>

      <div className="space-y-1">
        <FloatingField
          id="reg-name"
          label="Full name"
          autoComplete="name"
          hint="Let's start with knowing you."
          error={errors.name?.message}
          valid={name.trim().length >= 2}
          registration={register('name', {
            required: 'We need a name to put on your profile.',
            minLength: { value: 2, message: 'That looks a little short — use your full name.' },
          })}
        />

        <FloatingField
          id="reg-email"
          label="Email address"
          type="email"
          inputMode="email"
          autoComplete="email"
          hint="Your verification link lands here — use an inbox you actually check."
          error={errors.email?.message}
          valid={EMAIL_RE.test(email)}
          registration={register('email', {
            required: 'An email address is required.',
            pattern: { value: EMAIL_RE, message: "That doesn't look like a complete email address." },
          })}
        />

        <div>
          <FloatingField
            id="reg-password"
            label="Password"
            type="password"
            autoComplete="new-password"
            hint="Create a secure identity for your intelligence profile."
            error={errors.password?.message}
            registration={register('password', {
              required: 'Choose a password.',
              validate: (v) =>
                meetsPolicy(v) || 'Needs 8+ characters, with at least one letter and one number.',
            })}
          />
          {password && <PasswordStrength password={password} className="mb-3 mt-0.5" />}
        </div>

        <FloatingField
          id="reg-confirm-password"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          hint="Once more — so a typo can't lock you out on day one."
          error={errors.confirmPassword?.message}
          valid={Boolean(confirmPassword) && confirmPassword === password}
          registration={register('confirmPassword', {
            required: 'Please re-enter your password.',
            validate: (v) => v === password || "These two don't match yet.",
          })}
        />
      </div>

      <RoleSelector
        className="mt-4"
        value={accountType}
        // shouldValidate isn't needed (nothing validates accountType — it always
        // has a value) but shouldDirty keeps RHF's dirty tracking honest.
        onChange={(v) => setValue('accountType', v, { shouldDirty: true })}
      />

      {/* Roll number and referral code are the two fields most people don't
          have, so they sit behind a disclosure rather than adding two more
          empty boxes to the visible form. The referral code is worth surfacing
          by name in the trigger, because it is the difference between
          instant access and waiting in the approval queue. */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setShowExtras((v) => !v)}
          aria-expanded={showExtras}
          aria-controls="reg-extras"
          className="flex w-full items-center gap-1.5 rounded-lg py-1 text-[12px] font-medium text-primary-600 transition-colors hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-primary-400"
        >
          <Gift className="h-3.5 w-3.5" aria-hidden="true" />
          Have a referral code or roll number?
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform duration-200 ${showExtras ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>

        <AnimatePresence initial={false}>
          {showExtras && (
            <motion.div
              id="reg-extras"
              className="overflow-hidden"
              initial={reduce ? false : { height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={reduce ? undefined : { height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="grid grid-cols-2 gap-3 pt-3">
                <FloatingField
                  id="reg-referral"
                  label="Referral code"
                  autoComplete="off"
                  spellCheck={false}
                  registration={register('referralCode')}
                />
                <FloatingField
                  id="reg-roll"
                  label="Roll number"
                  autoComplete="off"
                  registration={register('rollNumber')}
                />
              </div>
              <p className="-mt-1 text-[11.5px] text-gray-400 dark:text-gray-500">
                A valid code from a batchmate skips the approval queue entirely.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Honeypot. Hidden from people and from screen readers, but present in
          the DOM for form-filling bots. Anything typed here fails the signup
          server-side. Not `display:none` — some bots skip those. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
      </div>
    </div>
  );
}
