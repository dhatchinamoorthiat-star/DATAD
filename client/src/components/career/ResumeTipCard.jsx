import { useEffect, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { getResumeTipToday } from '../../api/resume';
import AIBadge from '../common/AIBadge';

/**
 * Today's resume tip, written overnight by the resume-tip scheduler.
 *
 * Renders nothing at all when there is no tip — on a day the scheduler has not
 * run the endpoint answers 404, and an empty bordered box saying "no tip today"
 * is worse than the strip simply not being there. The same applies to a failed
 * request: this is a garnish on the resume builder, and it must never put an
 * error in front of someone who came here to edit their resume.
 */
export default function ResumeTipCard({ className = '' }) {
  const [tip, setTip] = useState(null);

  useEffect(() => {
    let active = true;
    getResumeTipToday()
      .then(({ data }) => { if (active) setTip(data); })
      .catch(() => { /* no tip today, or the request failed — show nothing */ });
    return () => { active = false; };
  }, []);

  if (!tip) return null;

  return (
    <div className={`rounded-2xl border border-amber-200/80 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-950/20 ${className}`}>
      <div className="flex items-start gap-3">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{tip.title}</h2>
            {tip.category && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                {tip.category}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-gray-700 dark:text-gray-300">{tip.tip}</p>
          {tip.example && (
            <p className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-xs italic leading-relaxed text-gray-600 dark:bg-gray-900/50 dark:text-gray-400">
              {tip.example}
            </p>
          )}
          <AIBadge provider={tip.model} className="mt-2" />
        </div>
      </div>
    </div>
  );
}
