import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Check } from 'lucide-react';


function StrengthBar({ password }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /[0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const colors = ['', 'bg-red-400', 'bg-amber-400', 'bg-indigo-400', 'bg-emerald-500'];
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];

  if (!password) return null;
  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= score ? colors[score] : 'bg-gray-200 dark:bg-gray-700'}`}
          />
        ))}
      </div>
      <p className={`text-[11px] font-medium ${score >= 4 ? 'text-emerald-500' : score >= 2 ? 'text-amber-500' : 'text-red-400'}`}>
        {labels[score]}
        {score === 4 && ' ✓'}
      </p>
    </div>
  );
}

export default function ProgramStep() {
  const { register, watch, formState: { errors } } = useFormContext();
  const [showPass, setShowPass] = useState(false);
  const password = watch('password', '');
  const name = watch('name', '');

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      <div className="mb-2">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Create your account</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Your workspace starts here.</p>
      </div>

      {/* Name */}
      <div>
        <label htmlFor="program-full-name" className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-400">
          Full name <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <input id="program-full-name"
            {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'At least 2 characters' } })}
            placeholder="e.g. Arjun Mehta"
            className="input"
          />
          {name.trim().length >= 2 && (
            <Check className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
          )}
        </div>
        {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
      </div>

      {/* Email */}
      <div>
        <label htmlFor="program-email" className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-400">
          Email <span className="text-red-400">*</span>
        </label>
        <input id="program-email"
          type="email"
          {...register('email', {
            required: 'Email is required',
            pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email' },
          })}
          placeholder="you@college.edu"
          className="input"
        />
        {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
      </div>

      {/* Password */}
      <div>
        <label htmlFor="program-password" className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-400">
          Password <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <input id="program-password"
            type={showPass ? 'text' : 'password'}
            {...register('password', {
              required: 'Password is required',
              minLength: { value: 8, message: 'At least 8 characters' },
              validate: (v) => (/[a-zA-Z]/.test(v) && /[0-9]/.test(v)) || 'Include at least one letter and one number',
            })}
            placeholder="Min 8 chars, letter + number"
            className="input pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPass((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            tabIndex={-1}
          >
            {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <StrengthBar password={password} />
        {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
      </div>

      {/* Roll number + Referral — collapsed row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="program-roll-number-opt" className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-400">
            Roll number <span className="text-gray-400 font-normal">(opt)</span>
          </label>
          <input id="program-roll-number-opt" {...register('rollNumber')} placeholder="e.g. 2024CS001" className="input" />
        </div>
        <div>
          <label htmlFor="program-referral-code-opt" className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-400">
            Referral code <span className="text-gray-400 font-normal">(opt)</span>
          </label>
          <input id="program-referral-code-opt" {...register('referralCode')} placeholder="DHAT-7K2M" className="input" />
        </div>
      </div>

      {/* Honeypot. Hidden from people and from screen readers, but present in
          the DOM for form-filling bots. Anything typed here fails the signup
          server-side. Not `display:none` — some bots skip those. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input
          id="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          {...register('website')}
        />
      </div>

      <p className="text-[11px] text-gray-400">
        A valid referral code from a batchmate skips the approval queue.
      </p>
    </motion.div>
  );
}
