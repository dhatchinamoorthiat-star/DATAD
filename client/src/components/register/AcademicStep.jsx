import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { motion } from 'framer-motion';

const PROGRAM_OPTIONS = [
  { value: 'MBA',     label: 'MBA',     emoji: '🏛️' },
  { value: 'B.Tech',  label: 'B.Tech',  emoji: '⚙️' },
  { value: 'B.Sc',    label: 'B.Sc',    emoji: '🔬' },
  { value: 'B.Com',   label: 'B.Com',   emoji: '📊' },
  { value: 'BBA',     label: 'BBA',     emoji: '💼' },
  { value: 'BA',      label: 'BA',      emoji: '📖' },
  { value: 'M.Sc',    label: 'M.Sc',    emoji: '🧪' },
  { value: 'Law',     label: 'Law',     emoji: '⚖️' },
  { value: 'Medical', label: 'Medical', emoji: '🏥' },
];

const SPEC_MAP = {
  MBA:     ['Finance', 'Marketing', 'HR', 'Operations', 'Analytics', 'Strategy', 'General'],
  'B.Tech':['CSE', 'IT', 'ECE', 'EEE', 'Mechanical', 'Civil', 'Chemical'],
  'B.Sc':  ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'Computer Science'],
  'B.Com': ['Accounting', 'Finance', 'Marketing', 'HR'],
  BBA:     ['Finance', 'Marketing', 'HR', 'Operations'],
  BA:      ['English', 'History', 'Political Science', 'Economics', 'Psychology'],
  'M.Sc':  ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'CS'],
  Law:     ['Corporate', 'Criminal', 'Intellectual Property', 'Family Law'],
  Medical: ['MBBS', 'BDS', 'Nursing', 'Pharmacy'],
  Other:   [],
};

const YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

const inp = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';
const inputErr = 'border-red-400 focus:border-red-500 focus:ring-red-500/20 dark:border-red-600';

export default function AcademicStep() {
  const { register, watch, setValue } = useFormContext();
  const course = watch('course', '');
  const graduationYear = watch('graduationYear', '');
  const specialization = watch('specialization', '');
  const [specCustom, setSpecCustom] = useState('');
  const [isSpecOther, setIsSpecOther] = useState(false);
  const [isCourseOther, setIsCourseOther] = useState(false);
  const [courseCustom, setCourseCustom] = useState('');

  const specs = SPEC_MAP[course] || [];

  function handleCourseSelect(val) {
    if (val === '__other__') {
      setIsCourseOther(true);
      setCourseCustom('');
      setValue('course', '');
      setValue('specialization', '');
      setIsSpecOther(false);
      setSpecCustom('');
    } else {
      setIsCourseOther(false);
      setCourseCustom('');
      setValue('course', val);
      setValue('specialization', '');
      setIsSpecOther(false);
      setSpecCustom('');
    }
  }

  function handleCourseCustom(e) {
    const val = e.target.value;
    setCourseCustom(val);
    setValue('course', val);
  }

  function handleSpecSelect(s) {
    setIsSpecOther(false);
    setSpecCustom('');
    setValue('specialization', s);
  }

  function handleSpecOther() {
    setIsSpecOther(true);
    setSpecCustom('');
    setValue('specialization', '');
  }

  function handleSpecCustom(e) {
    const val = e.target.value;
    setSpecCustom(val);
    setValue('specialization', val);
  }

  const courseErr = isCourseOther ? (() => {
    const trimmed = courseCustom.trim();
    if (!trimmed) return 'Please enter your programme';
    if (trimmed.length < 2) return 'Must be at least 2 characters';
    if (trimmed.length > 100) return 'Must be at most 100 characters';
    return '';
  })() : '';

  const specErr = isSpecOther ? (() => {
    const trimmed = specCustom.trim();
    if (!trimmed) return 'Please enter your specialisation';
    if (trimmed.length < 2) return 'Must be at least 2 characters';
    if (trimmed.length > 100) return 'Must be at most 100 characters';
    return '';
  })() : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Academic profile</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Tell us what you&rsquo;re studying.</p>
      </div>

      {/* Program selection */}
      <div>
        <p id="programme-group-label" className="mb-2 block text-xs font-semibold text-gray-600 dark:text-gray-400">Programme</p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5" role="group" aria-labelledby="programme-group-label">
          {PROGRAM_OPTIONS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => handleCourseSelect(p.value)}
              className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-center transition-colors ${
                course === p.value && !isCourseOther
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                  : 'border-gray-200 bg-white hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-900'
              }`}
            >
              <span className="text-base">{p.emoji}</span>
              <span className="text-[10px] font-semibold">{p.label}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleCourseSelect('__other__')}
            className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-center transition-colors ${
              isCourseOther
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                : 'border-gray-200 bg-white hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-900'
            }`}
          >
            <span className="text-base">🎓</span>
            <span className="text-[10px] font-semibold">Other…</span>
          </button>
        </div>
        {isCourseOther && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-2"
          >
            <label htmlFor="academic-please-specify-2" className="mb-1 block text-[11px] font-medium text-gray-500 dark:text-gray-400">
              Please specify
            </label>
            <input id="academic-please-specify-2"
              type="text"
              value={courseCustom}
              onChange={handleCourseCustom}
              placeholder="Enter your programme"
              className={`${inp} ${courseErr ? inputErr : ''}`}
              maxLength={100}
              // Revealed by picking "Other" — the user is mid-keystroke intent.
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              aria-invalid={courseErr ? 'true' : undefined}
            />
            {courseErr && (
              <p className="mt-1 text-xs text-red-500" role="alert">{courseErr}</p>
            )}
          </motion.div>
        )}
      </div>

      {/* Specialization — only if course selected */}
      {specs.length > 0 && (
        <div>
          <p id="specialisation-group-label" className="mb-2 block text-xs font-semibold text-gray-600 dark:text-gray-400">
            Specialisation
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="specialisation-group-label">
            {specs.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleSpecSelect(s)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  specialization === s && !isSpecOther
                    ? 'border-indigo-500 bg-indigo-600 text-white'
                    : 'border-gray-200 bg-white hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
                }`}
              >
                {s}
              </button>
            ))}
            <button
              type="button"
              onClick={handleSpecOther}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                isSpecOther
                  ? 'border-indigo-500 bg-indigo-600 text-white'
                  : 'border-gray-200 bg-white hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
              }`}
            >
              Other…
            </button>
          </div>

          {isSpecOther && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-2"
            >
              <label htmlFor="academic-please-specify" className="mb-1 block text-[11px] font-medium text-gray-500 dark:text-gray-400">
                Please specify
              </label>
              <input id="academic-please-specify"
                type="text"
                value={specCustom}
                onChange={handleSpecCustom}
                placeholder="Type your specialisation…"
                className={`${inp} ${specErr ? inputErr : ''}`}
                maxLength={100}
                // Revealed by picking "Other" — the user is mid-keystroke intent.
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                aria-invalid={specErr ? 'true' : undefined}
              />
              {specErr && (
                <p className="mt-1 text-xs text-red-500" role="alert">{specErr}</p>
              )}
            </motion.div>
          )}
        </div>
      )}

      {/* College */}
      <div>
        <label htmlFor="academic-institution" className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-400">
          Institution <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <input id="academic-institution"
          {...register('college')}
          placeholder="e.g. IIM Bangalore, Delhi University…"
          className={inp}
        />
      </div>

      {/* Graduation Year */}
      <div>
        <p id="graduation-year-group-label" className="mb-2 block text-xs font-semibold text-gray-600 dark:text-gray-400">
          Expected graduation year
        </p>
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby="graduation-year-group-label">
          {YEARS.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setValue('graduationYear', String(y))}
              className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
                graduationYear === String(y)
                  ? 'border-indigo-500 bg-indigo-600 text-white'
                  : 'border-gray-200 bg-white hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
