import { motion } from 'framer-motion';
import { Check, X, Minus } from 'lucide-react';

function Cell({ value, color }) {
  return (
    <div className="flex items-center justify-center">
      {value === true && (
        <Check className={`h-4 w-4 ${color || 'text-success-500'}`} aria-label="Included" />
      )}
      {value === false && (
        <Minus className="h-4 w-4 text-gray-200 dark:text-gray-700" aria-label="Not included" />
      )}
      {value !== true && value !== false && (
        <span className={`text-xs font-medium ${color || 'text-gray-500 dark:text-gray-400'}`}>{value}</span>
      )}
    </div>
  );
}

const HEADER_COLORS = {
  free: 'text-gray-500',
  trial: 'text-indigo-500',
  pro: 'text-amber-500',
  max: 'text-purple-500',
};

const BG_COLORS = {
  free: '',
  trial: 'bg-indigo-50/30 dark:bg-indigo-950/10',
  pro: 'bg-amber-50/30 dark:bg-amber-950/10',
  placement: 'bg-purple-50/30 dark:bg-purple-950/10',
};

export default function FeatureTable({ features, billing, selectedPlan }) {
  const isYearly = billing === 'yearly';
  const columns = ['free', 'trial', 'pro', 'placement'];

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="grid grid-cols-6 border-b border-gray-100 bg-gray-50 px-5 py-3 dark:border-gray-800 dark:bg-gray-900/50">
        <span className="col-span-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
          Feature
        </span>
        {columns.map((id) => {
          const label = id.charAt(0).toUpperCase() + id.slice(1);
          const isSelected = selectedPlan === id;
          return (
            <span
              key={id}
              className={`text-center text-xs font-semibold uppercase tracking-widest transition-colors ${HEADER_COLORS[id]} ${isSelected ? 'opacity-100' : 'opacity-60'}`}
            >
              {label}
            </span>
          );
        })}
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {features.map((row, i) => (
          <motion.div
            key={row.label}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.02, duration: 0.2 }}
            className={`grid grid-cols-6 px-5 py-3 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/30 ${selectedPlan === 'pro' ? 'bg-amber-50/20 dark:bg-amber-950/5' : selectedPlan === 'placement' ? 'bg-purple-50/20 dark:bg-purple-950/5' : ''}`}
          >
            <span className="col-span-2 text-gray-700 dark:text-gray-300">
              {row.label}
            </span>
            <Cell value={row.free} />
            <Cell value={row.trial} color="text-indigo-500" />
            <Cell value={row.pro} color="text-amber-500" />
            <Cell value={row.max} color="text-purple-500" />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
