import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lightbulb, ArrowRight, Shuffle } from 'lucide-react';
import { rotateOrder } from '../../utils/rotation';
import { HUB_TIPS } from '../../utils/prompts';

// One rotating tip for a workspace hub. `workspace` keys into HUB_TIPS and also
// seeds the rotation, so the four hubs advance independently rather than all
// sitting at the same index on a given day.
//
// The daily rotation decides which tip opens; the stepper walks forward through
// the same deck so a reader who wants another does not have to wait until
// tomorrow. Unlike the Wellbeing pages this strip has the opposite problem —
// one tip is not overwhelming, it is a dead end with twenty unseen tips behind
// it — so the control adds reach rather than hiding anything.
//
// Stepping rather than re-rolling at random, for the same reason as elsewhere:
// random repeats tips you just read and can leave some permanently unseen.
//
// Renders nothing for an unknown workspace — a hub is better with no tip strip
// than with an empty bordered box.
export default function DailyTip({ workspace, className = '' }) {
  const deck = useMemo(
    () => rotateOrder(HUB_TIPS[workspace] || [], `hub-tip-${workspace}`),
    [workspace],
  );
  const [i, setI] = useState(0);
  const tip = deck[i];
  if (!tip) return null;

  return (
    <div className={`flex items-start gap-3 rounded-2xl border border-gray-200/80 bg-gray-50/60 px-4 py-3 dark:border-gray-800/80 dark:bg-gray-900/60 ${className}`}>
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <div className="min-w-0 flex-1">
        {/* Keyed on the step so a swap re-runs the fade instead of snapping. */}
        <p key={i} className="animate-in text-sm leading-relaxed text-gray-700 dark:text-gray-300">{tip.text}</p>
        {tip.link && (
          <Link
            to={tip.link.to}
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
          >
            {tip.link.label} <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      {deck.length > 1 && (
        <button
          type="button"
          onClick={() => setI((n) => (n + 1) % deck.length)}
          aria-label="Show another tip"
          title="Show another tip"
          className="-mr-1 mt-0.5 shrink-0 rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-200/70 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
        >
          <Shuffle className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
