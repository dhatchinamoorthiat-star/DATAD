import { useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import toast from '../utils/toast';
import {
  Copy, Cpu, Server, Database, Lock, Globe, Wrench, Ban, ShieldCheck, Compass,
  CheckCircle2, Circle, CircleDot, ArrowRight, Zap, Sparkles,
} from 'lucide-react';

// Backing goes directly to this UPI ID — no gateway, no processing fees.
const UPI_ID = 'dhatchinamoorthikclas@okhdfcbank';
const PAYEE_NAME = 'DATAD';

const PRESETS = [
  { amount: 99, label: 'Early Supporter' },
  { amount: 199, label: 'Backer' },
  { amount: 499, label: 'Founding Circle' },
];

const PRINCIPLES = [
  {
    icon: Ban,
    title: 'No advertising',
    body: 'The moment a product runs ads, it starts working for advertisers — optimising for your attention instead of your outcomes. DATAD will never carry an ad.',
  },
  {
    icon: ShieldCheck,
    title: 'No data selling',
    body: 'Your notes, finances, and journal are the raw material of your life, not inventory. Nothing you put into DATAD is ever sold, shared, or mined for profit.',
  },
  {
    icon: Compass,
    title: 'No engagement traps',
    body: 'No infinite feeds, no streaks engineered to hook you. DATAD is built to compound your growth, not your screen time — success is you needing it less, not more.',
  },
];

const COST_LINES = [
  {
    icon: Cpu,
    title: 'AI infrastructure',
    body: 'GPU time and model API calls behind Dax — chat, resume review, and the daily briefing.',
  },
  {
    icon: Server,
    title: 'Servers & hosting',
    body: 'The compute that keeps every page fast and the platform online around the clock.',
  },
  {
    icon: Database,
    title: 'Storage & backups',
    body: 'Your notes, photos, and documents — stored reliably and backed up.',
  },
  {
    icon: Lock,
    title: 'Security',
    body: 'Authentication, encryption in transit, monitoring, and continuous patching.',
  },
  {
    icon: Globe,
    title: 'Domain & delivery',
    body: 'The custom domain, email delivery, and the network that serves the app worldwide.',
  },
  {
    icon: Wrench,
    title: 'Continuous development',
    body: 'New features ship every month. Revenue keeps that pace sustainable long-term.',
  },
];

const ROADMAP = [
  { label: 'Notes, Photos & Planner', status: 'done' },
  { label: 'Finance Tracker & Calculators', status: 'done' },
  { label: 'ATS Resume Builder', status: 'done' },
  { label: 'Career Hub, Companies & Readiness Score', status: 'done' },
  { label: 'Community Discussions & Announcements', status: 'done' },
  { label: 'Daily Case Study & Intelligence Briefing', status: 'done' },
  { label: 'Journal, Nostalgia Archive & Dax Chat', status: 'done' },
  { label: 'Custom domain & stable hosting', status: 'active' },
  { label: 'Dax study companion & case coach', status: 'next' },
  { label: 'Mobile app (PWA)', status: 'next' },
];

const FAQ = [
  {
    q: 'Why does DATAD exist?',
    a: 'Student software is usually fragmented, ad-riddled, or built by people far from the problem. DATAD exists to put study, career, finance, community, and reflection in one calm, engineered system — an operating system for student life, built from inside it.',
  },
  {
    q: 'Why back something that already works?',
    a: 'Because independence is the feature. DATAD has no investors and no advertisers, which means no one can force it to change direction. Its users are the only stakeholders — backing is how you keep it that way.',
  },
  {
    q: 'Where does the money actually go?',
    a: 'Five places: AI infrastructure (GPU time and model API calls), servers and hosting, storage and backups, security, and continuous development. Backing arrives by direct UPI transfer, so no payment gateway takes a cut.',
  },
  {
    q: 'How does backing improve the product?',
    a: 'It converts directly into speed and quality: more AI capacity per user, faster infrastructure, and more time spent building what the roadmap promises. Backing does not change what gets built — it changes how fast it arrives.',
  },
  {
    q: 'Why not just run ads?',
    a: 'Ads would cover the costs — and quietly change who the product answers to. An ad-run DATAD would be optimised to hold your attention, not improve your outcomes, and your data would become the product. That trade is permanently off the table.',
  },
  {
    q: 'What stays free forever?',
    a: 'The core toolkit: notes, planner, finance tracker, resume builder, and community. A student operating system only works if every student can use it, so the essentials are free — permanently, not as a promotion.',
  },
  {
    q: 'Then why is there a Pro tier?',
    a: 'AI is the one thing that costs real money every single time it runs. Pro covers those per-use GPU and API costs at a fair price — and the margin keeps the free tier free and the platform ad-free for everyone else. Pro is how DATAD stays independent without compromising anything.',
  },
];

const statusIcon = {
  done: <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />,
  active: <CircleDot className="h-4 w-4 shrink-0 text-indigo-500" />,
  next: <Circle className="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />,
};

const upiLink = (amount) =>
  `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(PAYEE_NAME)}&cu=INR` +
  (amount ? `&am=${amount}` : '');

function Overline({ children }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-500 dark:text-indigo-400">
      {children}
    </p>
  );
}

export default function SupportPage() {
  const [amount, setAmount] = useState(199);
  const [custom, setCustom] = useState('');

  const activeAmount = custom ? Number(custom) || null : amount;

  const copyId = () => {
    navigator.clipboard.writeText(UPI_ID);
    toast.success('UPI ID copied');
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {/* ── Hero ── */}
      <header className="mb-16 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
          <Sparkles className="h-3 w-3" /> Independent · Ad-free · Community-backed
        </span>
        <h1 className="mx-auto mt-5 max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
          Software this personal shouldn&rsquo;t answer to advertisers.
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          DATAD holds your notes, plans, finances, and ambitions. A product like that stays
          trustworthy only when the people funding it are the people using it. No investors,
          no ads, no data brokers — just the platform and the students it serves.
        </p>
      </header>

      {/* ── Mission ── */}
      <section className="mb-16">
        <Overline>The mission</Overline>
        <h2 className="mt-2 text-xl font-bold tracking-tight">
          One system for a student&rsquo;s entire life.
        </h2>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
          <p>
            Most student tools solve one slice of the problem and monetise the rest of your
            attention. DATAD takes the opposite bet: study, career, finance, community, and
            reflection in one deliberately calm system — engineered so the pieces compound
            instead of compete.
          </p>
          <p>
            The measure of success here isn&rsquo;t time-on-app. It&rsquo;s whether your notes turned into
            grades, your preparation turned into offers, and your habits turned into momentum.
            That&rsquo;s only possible for a product with nothing to gain from distracting you.
          </p>
        </div>
      </section>

      {/* ── Principles ── */}
      <section className="mb-16">
        <Overline>The lines we won&rsquo;t cross</Overline>
        <h2 className="mt-2 text-xl font-bold tracking-tight">Independence, by design.</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {PRINCIPLES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
            >
              <Icon className="h-5 w-5 text-indigo-500" />
              <p className="mt-3 text-sm font-semibold">{title}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                {body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Transparency ── */}
      <section className="mb-16">
        <Overline>Full transparency</Overline>
        <h2 className="mt-2 text-xl font-bold tracking-tight">Exactly where the money goes.</h2>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          Running a platform with real AI features has real costs. Every rupee of revenue —
          Pro subscriptions and one-time backing alike — goes to one of these six lines.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {COST_LINES.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" />
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                  {body}
                </p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
          What revenue never buys: ads, trackers, growth hacks, or access to your data.
        </p>
      </section>

      {/* ── Free forever / Why Pro ── */}
      <section className="mb-16">
        <Overline>The model</Overline>
        <h2 className="mt-2 text-xl font-bold tracking-tight">
          Free where it should be. Paid where it must be.
        </h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm font-semibold">Free, permanently</p>
            <p className="mt-1.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              Notes, planner, finance tracker, resume builder, and community. A student
              operating system only works if every student can use it — so the core is free
              forever, not free-for-now.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm font-semibold">Pro, honestly priced</p>
            <p className="mt-1.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              AI features cost money every single time they run. Pro covers that cost fairly —
              and in doing so keeps the free tier free and the whole platform ad-free.
              A subscription instead of your attention.
            </p>
            <Link
              to="/subscribe"
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              See what Pro includes <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Roadmap ── */}
      <section className="mb-16">
        <Overline>The roadmap</Overline>
        <h2 className="mt-2 text-xl font-bold tracking-tight">
          Backing changes how fast, not what.
        </h2>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          The direction is set and public. Early supporters accelerate the timeline — more AI
          capacity, faster infrastructure, and more of the roadmap shipped sooner.
        </p>
        <div className="mt-5 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <ul className="space-y-2">
            {ROADMAP.map((item) => (
              <li key={item.label} className="flex items-center gap-2 text-sm">
                {statusIcon[item.status]}
                <span
                  className={
                    item.status === 'done'
                      ? 'text-gray-400'
                      : item.status === 'active'
                        ? 'font-medium'
                        : 'text-gray-500 dark:text-gray-400'
                  }
                >
                  {item.label}
                </span>
                {item.status === 'done' && (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
                    shipped
                  </span>
                )}
                {item.status === 'active' && (
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                    in progress
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Backing CTA ── */}
      <section id="back" className="mb-16">
        <Overline>Back DATAD</Overline>
        <h2 className="mt-2 text-xl font-bold tracking-tight">Become an early supporter.</h2>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          A one-time amount, sent by direct UPI transfer. No payment gateway, no processing
          fees — 100% lands in infrastructure and development.
        </p>

        <div className="mt-5 rounded-xl border border-gray-200 bg-white p-6 text-center dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4 flex flex-wrap justify-center gap-2">
            {PRESETS.map(({ amount: amt, label }) => (
              <button
                key={amt}
                onClick={() => {
                  setAmount(amt);
                  setCustom('');
                }}
                className={`rounded-lg px-4 py-2.5 text-left ${
                  !custom && amount === amt
                    ? 'bg-indigo-600 text-white'
                    : 'border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
              >
                <span className="block text-sm font-semibold">₹{amt}</span>
                <span
                  className={`block text-[10px] font-medium uppercase tracking-wide ${
                    !custom && amount === amt ? 'text-indigo-200' : 'text-gray-400'
                  }`}
                >
                  {label}
                </span>
              </button>
            ))}
          </div>

          <div className="mx-auto mb-5 flex max-w-[220px] items-center gap-2">
            <span className="text-sm text-gray-400">₹</span>
            <input
              type="number"
              min="1"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Your own amount"
              aria-label="Custom amount"
              className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700"
            />
          </div>

          <p className="mb-3 text-sm font-medium">Scan with any UPI app</p>
          <div className="mx-auto mb-4 w-fit rounded-lg bg-white p-3 shadow-sm ring-1 ring-gray-200">
            <QRCodeSVG value={upiLink(activeAmount)} size={180} />
          </div>

          <a
            href={upiLink(activeAmount)}
            className="mb-3 inline-block w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 sm:hidden"
          >
            Open UPI app
          </a>

          <button
            onClick={copyId}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <Copy className="h-4 w-4" /> {UPI_ID}
          </button>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="mb-16">
        <Overline>Questions, answered</Overline>
        <h2 className="mt-2 text-xl font-bold tracking-tight">Everything worth knowing.</h2>
        <div className="mt-5 divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
                {q}
                <ArrowRight className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-open:rotate-90" />
              </summary>
              <p className="mt-2.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                {a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* ── Closing ── */}
      <footer className="text-center">
        <p className="mx-auto max-w-md text-sm leading-relaxed text-gray-600 dark:text-gray-300">
          If DATAD improves your semester, you&rsquo;re welcome to help shape what it becomes.
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <a
            href="#back"
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Zap className="h-4 w-4" /> Back DATAD
          </a>
          <Link
            to="/subscribe"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            Explore Pro
          </Link>
        </div>
        <p className="mt-5 text-xs text-gray-400">
          Independent · Ad-free · Community-backed
        </p>
      </footer>
    </div>
  );
}
