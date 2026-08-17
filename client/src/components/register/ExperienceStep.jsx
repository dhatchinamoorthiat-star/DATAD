import { useFormContext } from 'react-hook-form';
import { motion } from 'framer-motion';
import { GraduationCap, Briefcase } from 'lucide-react';
import SmartSelect from '../common/SmartSelect';

const DOMAINS = [
  'IT / Software', 'Banking / Finance', 'Consulting', 'Manufacturing / Ops',
  'Healthcare', 'FMCG / Retail', 'Govt / PSU', 'Media / Content', 'Startup',
];

const STYLES = [
  { value: 'Videos',     emoji: '🎥', label: 'Videos' },
  { value: 'Reading',    emoji: '📖', label: 'Reading' },
  { value: 'Practice',   emoji: '🧪', label: 'Practice' },
  { value: 'Discussion', emoji: '👥', label: 'Discussion' },
  { value: 'AI',         emoji: '🤖', label: 'AI-guided' },
  { value: 'Mixed',      emoji: '🎯', label: 'Mixed' },
];

const TIME_OPTIONS = [
  { value: '<1hr',     label: '< 1 hr / day' },
  { value: '1-2hr',   label: '1–2 hrs' },
  { value: '2-4hr',   label: '2–4 hrs' },
  { value: 'flexible', label: 'Flexible' },
];

const inp = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';

export default function ExperienceStep() {
  const { watch, setValue, register } = useFormContext();
  const studentType = watch('studentType', 'fresher');
  const learningStyle = watch('learningStyle', '');
  const timeAvailable = watch('timeAvailable', '');
  const priorDomain = watch('priorDomain', '');

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Background & learning</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Personalise your DATAD experience.</p>
      </div>

      {/* Fresher / Experienced */}
      <div>
        <p id="background-group-label" className="mb-2 block text-xs font-semibold text-gray-600 dark:text-gray-400">
          Your background
        </p>
        <div className="grid grid-cols-2 gap-3" role="group" aria-labelledby="background-group-label">
          {[
            { value: 'fresher',    Icon: GraduationCap, title: 'Fresher',         sub: 'Straight from undergrad' },
            { value: 'experienced', Icon: Briefcase,     title: 'Work experience', sub: '1+ years before this program' },
          ].map(({ value, Icon, title, sub }) => (
            <button
              key={value}
              type="button"
              onClick={() => setValue('studentType', value)}
              className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-colors ${
                studentType === value
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                  : 'border-gray-200 hover:border-indigo-300 dark:border-gray-700'
              }`}
            >
              <Icon className={`h-6 w-6 ${studentType === value ? 'text-indigo-600' : 'text-gray-400'}`} />
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">{sub}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Work experience details */}
      {studentType === 'experienced' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="experience-years" className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-400">Years</label>
              <input id="experience-years"
                type="number" min="0" max="20" step="0.5"
                {...register('workExYears')}
                placeholder="e.g. 2.5"
                className={inp}
              />
            </div>
            <div>
              <SmartSelect
                options={DOMAINS}
                value={priorDomain}
                onChange={(val) => setValue('priorDomain', val)}
                label="Domain"
                placeholder="Select…"
                allowOther={true}
                variant="dropdown"
                name="priorDomain"
              />
            </div>
          </div>
        </motion.div>
      )}

      {/* Learning style */}
      <div>
        <p id="learning-style-group-label" className="mb-2 block text-xs font-semibold text-gray-600 dark:text-gray-400">
          How do you learn best?
        </p>
        <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby="learning-style-group-label">
          {STYLES.map(({ value, emoji, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setValue('learningStyle', value)}
              className={`flex flex-col items-center gap-1 rounded-xl border py-3 text-center transition-colors ${
                learningStyle === value
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                  : 'border-gray-200 bg-white hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-900'
              }`}
            >
              <span className="text-xl">{emoji}</span>
              <span className="text-[10px] font-semibold">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Time available */}
      <div>
        <p id="time-per-day-group-label" className="mb-2 block text-xs font-semibold text-gray-600 dark:text-gray-400">
          Time you can give per day
        </p>
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby="time-per-day-group-label">
          {TIME_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setValue('timeAvailable', value)}
              className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
                timeAvailable === value
                  ? 'border-indigo-500 bg-indigo-600 text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
