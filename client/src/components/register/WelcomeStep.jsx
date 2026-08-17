import { motion } from 'framer-motion';

const FEATURES = [
  { emoji: '📚', label: 'Smart notes & study tools' },
  { emoji: '💼', label: 'Career & placement tracker' },
  { emoji: '🤝', label: 'Batch community & directory' },
  { emoji: '🧠', label: 'Daily case-study practice' },
  { emoji: '💰', label: 'Finance & budget tracker' },
  { emoji: '✨', label: 'Briefings from Dax' },
];

export default function WelcomeStep() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 text-center"
    >
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-3xl shadow-lg shadow-indigo-500/25">
        🎓
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Welcome to DATAD
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Let&rsquo;s build your personalised student workspace.
          <br />
          Takes about 2 minutes.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 text-left">
        {FEATURES.map(({ emoji, label }) => (
          <div
            key={label}
            className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2.5 dark:border-gray-800 dark:bg-gray-800/50"
          >
            <span className="text-lg">{emoji}</span>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
