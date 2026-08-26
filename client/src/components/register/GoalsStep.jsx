import { useFormContext } from 'react-hook-form';
import { motion } from 'framer-motion';
import {
  TrendingUp, Megaphone, Search, Code2, Bot, Settings2, Handshake, Rocket,
  Microscope, Stethoscope, Landmark, Clapperboard, ShoppingCart, Building2, Scale,
} from 'lucide-react';

const INTERESTS = [
  { label: 'Finance',          icon: TrendingUp },
  { label: 'Marketing',        icon: Megaphone },
  { label: 'Consulting',       icon: Search },
  { label: 'Software / IT',    icon: Code2 },
  { label: 'AI & Data',        icon: Bot },
  { label: 'Operations',       icon: Settings2 },
  { label: 'HR & People',      icon: Handshake },
  { label: 'Entrepreneurship', icon: Rocket },
  { label: 'Research',         icon: Microscope },
  { label: 'Healthcare',       icon: Stethoscope },
  { label: 'Government',       icon: Landmark },
  { label: 'Media & Content',  icon: Clapperboard },
  { label: 'FMCG / Retail',    icon: ShoppingCart },
  { label: 'Banking',          icon: Building2 },
  { label: 'Law',              icon: Scale },
];

export default function GoalsStep() {
  const { watch, setValue } = useFormContext();
  const selected = watch('careerInterests', []);

  const toggle = (label) => {
    const current = selected || [];
    if (current.includes(label)) {
      setValue('careerInterests', current.filter((i) => i !== label));
    } else if (current.length < 5) {
      setValue('careerInterests', [...current, label]);
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
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Career interests</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Which fields excite you? Pick up to 5.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {INTERESTS.map(({ label, icon: Icon }) => {
          const on = (selected || []).includes(label);
          return (
            <button
              key={label}
              type="button"
              onClick={() => toggle(label)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                on
                  ? 'border-primary-500 bg-primary-600 text-white shadow-md shadow-primary-500/20'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-primary-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {selected?.length > 0 && (
        <p className="text-xs text-primary-600 dark:text-primary-400">
          {selected.length} selected — {selected.length < 5 ? `you can pick ${5 - selected.length} more` : 'limit reached'}
        </p>
      )}
    </motion.div>
  );
}
