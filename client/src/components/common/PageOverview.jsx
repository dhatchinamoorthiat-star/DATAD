import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { DAX_CAPABILITY } from '../../utils/dax';

// Experimental: Dax explaining what this page is for, for new users.
// Rendered by <Page overview={...}> inside a sticky right-hand column, so it
// takes real layout space instead of floating over content. Styled after
// AIInsight.jsx (the existing "Dax speaking" card) with a dashed outline —
// dotted rather than a solid border, so it reads as a callout, not chrome.
// Closing it only hides it for this view — it's back on the next visit/reload,
// unlike AIInsight's dismissKey which remembers a close forever.
export default function PageOverview({ pageKey: _pageKey, title, blurb, takeaway }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const close = () => setDismissed(true);

  return (
    <div className="rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/70 p-4 dark:border-indigo-700/60 dark:bg-indigo-950/30">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/60">
            <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
          </span>
          <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">{DAX_CAPABILITY.pageGuide}</p>
        </div>
        <button onClick={close} className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-indigo-100 hover:text-gray-600 dark:hover:bg-indigo-900/40" aria-label="Dismiss">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mb-1 text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</p>
      <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-300">{blurb}</p>
      {takeaway && (
        <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
          <span className="font-semibold text-indigo-600 dark:text-indigo-400">Takeaway — </span>{takeaway}
        </p>
      )}
    </div>
  );
}
