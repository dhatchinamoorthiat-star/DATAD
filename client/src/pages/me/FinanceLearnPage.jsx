import { GraduationCap } from 'lucide-react';
import { Page } from '../../components/common/motion';
import { LESSONS } from '../../utils/financeLessons';
import { rotateOrder } from '../../utils/rotation';

export default function FinanceLearnPage() {
  const [today, ...rest] = rotateOrder(LESSONS, 'finance-learn');
  const TodayIcon = today?.icon;

  return (
    <Page overview={{
      pageKey: 'finance-learn',
      title: 'Money basics, plainly put',
      blurb: 'Short explainers on tax, insurance, credit and investing written for someone earning their first salary.',
      takeaway: 'Read the tax and emergency-fund pieces before your first payslip lands.',
    }}>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <GraduationCap className="h-5 w-5 text-indigo-500" /> Money, explained simply
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Ideas that matter more than any stock tip. One is featured each day — read them once now, thank yourself at 40.
        </p>
      </div>

      {today && (
        <section className="mb-4 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5 dark:border-indigo-900/50 dark:bg-indigo-950/20">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
            Today&apos;s lesson
          </p>
          <h2 className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
            {TodayIcon && <TodayIcon className="h-4 w-4 text-indigo-500" />} {today.title}
          </h2>
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">{today.body}</p>
        </section>
      )}

      <div className="space-y-3">
        {rest.map((l) => (
          <section key={l.title} className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
            <h2 className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
              <l.icon className="h-4 w-4 text-indigo-500" /> {l.title}
            </h2>
            <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">{l.body}</p>
          </section>
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-gray-400">
        Education, not advice — for decisions involving real money, a SEBI-registered advisor beats any app.
      </p>
    </Page>
  );
}
