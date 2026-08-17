import { useState, useEffect } from 'react';
import { Sparkles, BookOpen, Target, Lightbulb, Brain, Heart, Quote, RefreshCw } from 'lucide-react';
import { getTodayReflection } from '../api/reflection';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { Page } from '../components/common/motion';
import { Skeleton } from '../components/common/Skeleton';

function Section({ icon: Icon, title, children, accent = 'indigo' }) {
  const colors = {
    indigo: 'border-indigo-100 bg-indigo-50/50 dark:border-indigo-900/30 dark:bg-indigo-950/20',
    emerald: 'border-emerald-100 bg-emerald-50/50 dark:border-emerald-900/30 dark:bg-emerald-950/20',
    amber: 'border-amber-100 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-950/20',
    rose: 'border-rose-100 bg-rose-50/50 dark:border-rose-900/30 dark:bg-rose-950/20',
    purple: 'border-purple-100 bg-purple-50/50 dark:border-purple-900/30 dark:bg-purple-950/20',
  };
  return (
    <div className={`rounded-2xl border p-5 ${colors[accent] || colors.indigo}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-gray-500" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">{title}</h3>
      </div>
      {typeof children === 'string' ? (
        <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-200">{children}</p>
      ) : children}
    </div>
  );
}

export default function ReflectionPage() {
  useDocumentTitle('Daily Reflection');
  const [reflection, setReflection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    getTodayReflection()
      .then((res) => {
        if (res.data === null || res.data === undefined) {
          setError('not-ready');
        } else {
          setReflection(res.data);
        }
      })
      .catch(() => setError('error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // Scheduled, not called inline: the loader flips loading state
    // synchronously, which cascades an extra render from the effect body.
    queueMicrotask(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  if (loading) {
    return (
      <Page>
        <div className="py-8 space-y-6">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
      </Page>
    );
  }

  if (error === 'not-ready') {
    return (
      <Page>
        <div className="py-16 text-center">
          <Sparkles className="h-10 w-10 mx-auto mb-4 text-indigo-300" />
          <p className="text-lg font-semibold text-gray-600 dark:text-gray-300">Today&rsquo;s reflection isn&rsquo;t ready yet</p>
          <p className="text-sm text-gray-400 mt-2 max-w-sm mx-auto">
            A new reflection is generated each morning. Check back a little later or visit your journal in the meantime.
          </p>
          <button
            onClick={load}
            className="mt-6 inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:border-indigo-200 hover:text-indigo-600 dark:border-gray-700 dark:hover:border-indigo-800/60"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </Page>
    );
  }

  if (error === 'error' || !reflection) {
    return (
      <Page>
        <div className="py-16 text-center">
          <p className="text-gray-500">Could not load today&rsquo;s reflection.</p>
          <button onClick={load} className="mt-4 text-sm text-indigo-600 hover:underline">Try again</button>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      {/* Header */}
      <div className="py-4 border-b border-gray-100 dark:border-gray-800">
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400">Daily Reflection</p>
        <p className="text-sm text-gray-500 mt-0.5">{today}</p>
      </div>

      {/* Quote */}
      {reflection.quote && (
        <div className="py-8 text-center">
          <Quote className="h-6 w-6 mx-auto mb-3 text-indigo-300 dark:text-indigo-600" />
          <blockquote className="text-lg italic leading-relaxed text-gray-700 dark:text-gray-200 max-w-lg mx-auto">
            &ldquo;{reflection.quote.text}&rdquo;
          </blockquote>
          {reflection.quote.author && (
            <p className="mt-2 text-sm text-gray-400">&mdash; {reflection.quote.author}</p>
          )}
        </div>
      )}

      {/* Content sections */}
      <div className="space-y-4 pb-8">
        {reflection.reflection && (
          <Section icon={BookOpen} title="Reflection" accent="indigo">
            {reflection.reflection}
          </Section>
        )}

        {reflection.challenge && (
          <Section icon={Target} title="Today's Challenge" accent="amber">
            {reflection.challenge}
          </Section>
        )}

        {reflection.productivityTip && (
          <Section icon={Lightbulb} title="Productivity Tip" accent="emerald">
            {reflection.productivityTip}
          </Section>
        )}

        {reflection.dailyConcept?.concept && (
          <Section icon={Brain} title="Concept of the Day" accent="purple">
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">{reflection.dailyConcept.concept}</p>
            {reflection.dailyConcept.whyToday && (
              <p className="text-sm text-gray-500 dark:text-gray-400">{reflection.dailyConcept.whyToday}</p>
            )}
          </Section>
        )}

        {reflection.gratitude && (
          <Section icon={Heart} title="Gratitude" accent="rose">
            {reflection.gratitude}
          </Section>
        )}
      </div>
    </Page>
  );
}
