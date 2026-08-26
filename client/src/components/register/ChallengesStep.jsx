import { useFormContext } from 'react-hook-form';
import { motion } from 'framer-motion';
import {
  Building2, Briefcase, Zap, FileText, Mic, Handshake, GraduationCap, Rocket,
  Award, Microscope, Wallet, Wrench, Check,
} from 'lucide-react';

const GOALS = [
  { label: 'Internship',         icon: Building2 },
  { label: 'Placement',          icon: Briefcase },
  { label: 'Skill Building',     icon: Zap },
  { label: 'Resume Polish',      icon: FileText },
  { label: 'Mock Interviews',    icon: Mic },
  { label: 'Networking',         icon: Handshake },
  { label: 'Higher Studies',     icon: GraduationCap },
  { label: 'Entrepreneurship',   icon: Rocket },
  { label: 'Certifications',     icon: Award },
  { label: 'Research',           icon: Microscope },
  { label: 'Financial Literacy', icon: Wallet },
  { label: 'Projects',           icon: Wrench },
];

export default function ChallengesStep() {
  const { watch, setValue } = useFormContext();
  const selected = watch('goals', []);

  const toggle = (label) => {
    const current = selected || [];
    if (current.includes(label)) {
      setValue('goals', current.filter((g) => g !== label));
    } else if (current.length < 5) {
      setValue('goals', [...current, label]);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">What do you want?</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          What do you want DATAD to help you achieve? Pick up to 5.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {GOALS.map(({ label, icon: Icon }) => {
          const on = (selected || []).includes(label);
          return (
            <button
              key={label}
              type="button"
              onClick={() => toggle(label)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-all ${
                on
                  ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-primary-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="text-xs leading-tight">{label}</span>
              {on && (
                <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-primary-600 dark:text-primary-400" />
              )}
            </button>
          );
        })}
      </div>

      {(selected || []).length > 0 && (
        <p className="text-xs text-primary-600 dark:text-primary-400">
          {selected.length} selected — {selected.length < 5 ? `${5 - selected.length} more allowed` : 'limit reached'}
        </p>
      )}
    </motion.div>
  );
}
