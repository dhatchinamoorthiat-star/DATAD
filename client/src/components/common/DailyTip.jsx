import { Link } from 'react-router-dom';
import { Lightbulb, ArrowRight } from 'lucide-react';
import { pickDaily } from '../../utils/rotation';
import { HUB_TIPS } from '../../utils/prompts';

// One rotating tip for a workspace hub. `workspace` keys into HUB_TIPS and also
// seeds the rotation, so the four hubs advance independently rather than all
// sitting at the same index on a given day.
//
// Renders nothing for an unknown workspace — a hub is better with no tip strip
// than with an empty bordered box.
export default function DailyTip({ workspace, className = '' }) {
  const tip = pickDaily(HUB_TIPS[workspace], `hub-tip-${workspace}`);
  if (!tip) return null;

  return (
    <div className={`flex items-start gap-3 rounded-2xl border border-gray-200/80 bg-gray-50/60 px-4 py-3 dark:border-gray-800/80 dark:bg-gray-900/60 ${className}`}>
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <div className="min-w-0">
        <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">{tip.text}</p>
        {tip.link && (
          <Link
            to={tip.link.to}
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
          >
            {tip.link.label} <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}
