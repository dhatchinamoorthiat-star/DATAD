import { motion } from 'framer-motion';
import { Cpu, Sparkles, FileText, Search, BarChart3 } from 'lucide-react';

const ITEMS = [
  {
    icon: Sparkles,
    label: 'Simple questions',
    desc: 'Quick queries like definitions or summaries use very few credits.',
  },
  {
    icon: FileText,
    label: 'Resume Review',
    desc: 'Deep analysis of your resume with personalized feedback uses more credits.',
  },
  {
    icon: Search,
    label: 'Company Research',
    desc: 'Detailed company prep cards with process, questions, and insights.',
  },
  {
    icon: BarChart3,
    label: 'Complex analysis',
    desc: 'Multi-document analysis, comparisons, and advanced reasoning tasks.',
  },
];

export default function CreditExplainer() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="px-5 py-4">
        <div className="flex items-center gap-2">
          <Cpu className="h-5 w-5 text-primary-500" />
          <h3 className="text-base font-semibold tracking-tight text-gray-900 dark:text-white">
            How AI credits work
          </h3>
        </div>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          AI Credits represent Dax's AI compute usage. Simple questions use very few credits, while complex
          tasks like Resume Review or Company Research use more. You never pay extra for credits — they reset daily.
        </p>
      </div>
      <div className="grid gap-px bg-gray-100 dark:bg-gray-800 sm:grid-cols-2">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="bg-white px-5 py-4 dark:bg-gray-900">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-900/30">
                  <Icon className="h-4 w-4 text-primary-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.label}</p>
                  <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{item.desc}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
