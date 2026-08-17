import { Link } from 'react-router-dom';
import { HeartHandshake, PenSquare, ArrowRight, Phone } from 'lucide-react';
import { Page } from '../../components/common/motion';

export default function WellbeingSupportPage() {
  return (
    <Page>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <HeartHandshake className="h-5 w-5 text-indigo-500" /> Support
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Student life is a marathon run at sprint pace. It&rsquo;s okay to need a moment.
        </p>
      </div>

      <div className="space-y-4">
        {/* Reflection nudge */}
        <Link to="/me/journal"
          className="flex items-center gap-3 rounded-2xl border border-gray-200/80 bg-white p-4 transition-colors hover:border-indigo-300 dark:border-gray-800/80 dark:bg-gray-900 dark:hover:border-indigo-700">
          <PenSquare className="h-4 w-4 shrink-0 text-indigo-500" />
          <p className="flex-1 text-sm">
            <span className="font-medium">Feeling foggy?</span>{' '}
            <span className="text-gray-500 dark:text-gray-400">Writing three honest sentences in your journal untangles more than an hour of worrying.</span>
          </p>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-gray-300" />
        </Link>

        {/* Reach out */}
        <section className="rounded-2xl border border-indigo-200/70 bg-indigo-50/50 p-6 dark:border-indigo-800/50 dark:bg-indigo-950/20">
          <h2 className="mb-2 flex items-center gap-2 font-semibold">
            <HeartHandshake className="h-4 w-4 text-indigo-500" /> If you&rsquo;d like to talk
          </h2>
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            DATAD is built by one of your own batchmates — with a psychology background and counselling
            training. If things feel heavy and you want someone to listen, without judgement and in
            confidence, reach out. Sometimes saying it out loud is the whole fix.
          </p>
          <a href="mailto:digitaldoncodes@gmail.com?subject=Can%20we%20talk%3F"
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Say hello <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </section>

        {/* Helplines */}
        <section className="rounded-2xl border border-gray-200/80 bg-gray-50 p-5 text-sm dark:border-gray-800/80 dark:bg-gray-900/60">
          <p className="text-gray-600 dark:text-gray-300">
            <span className="font-semibold">Please know:</span> DATAD is a study companion, not a
            replacement for professional mental-health care. If you&rsquo;re struggling in a way that
            doesn&rsquo;t pass, talking to a professional is a sign of strength — not weakness.
          </p>
          <ul className="mt-3 space-y-1.5 text-gray-600 dark:text-gray-300">
            <li className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <span><span className="font-medium">Tele-MANAS</span> (Govt. of India, 24×7, free): <a href="tel:14416" className="text-indigo-600 hover:underline dark:text-indigo-400">14416</a></span>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <span><span className="font-medium">KIRAN helpline</span> (24×7): <a href="tel:18005990019" className="text-indigo-600 hover:underline dark:text-indigo-400">1800-599-0019</a></span>
            </li>
          </ul>
        </section>
      </div>
    </Page>
  );
}
