import { useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, BrainCircuit, CalendarDays, Briefcase, FileText,
  Gauge, Users, Wallet, HeartHandshake, Sparkles, ArrowRight, ShieldCheck, Sun, Moon,
} from 'lucide-react';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { Stagger } from '../components/common/motion';
import { DatadMark } from '../components/common/Logo';
import { useTheme } from '../context/ThemeContext';

// DATAD's own accents — used sparingly, on hover only. The page itself stays
// white/neutral; colour is a reward for interaction, not a backdrop.
//
// Blue and violet are the Terrace brand values (see components/common/Logo.jsx
// and components/register/identityTokens.js); teal and amber extend them and
// are picked to clear 3:1 on white, the WCAG floor for a graphical object,
// since these only ever paint a 24px icon and a hairline glow.
//
// This replaces a set that was Google's four brand hexes verbatim. That
// four-colour signature is Google's trade dress and had no business on a
// homepage that is meant to establish DATAD's own identity.
const ACCENTS = ['#4D7CFF', '#7C6CFF', '#0E9384', '#B45309']; // blue, violet, teal, amber

// Every box deep-links: login first, then land exactly on the feature clicked.
const FEATURES = [
  {
    icon: LayoutDashboard,
    title: 'A calm daily home',
    desc: 'One focus, one encouragement, one next step — never a wall of widgets.',
    to: '/dashboard',
  },
  {
    icon: BookOpen,
    title: 'Notes, in your words',
    desc: 'Your personal knowledge repository — paraphrase today’s class, keep it forever.',
    to: '/study/notes',
  },
  {
    icon: BrainCircuit,
    title: 'Daily case practice',
    desc: 'One case study every morning with frameworks — the habit that compounds.',
    to: '/dashboard',
  },
  {
    icon: Briefcase,
    title: 'Company prep cards',
    desc: 'What they do, what they ask, what they pay — one page per recruiter.',
    to: '/career/companies',
  },
  {
    icon: Gauge,
    title: 'Career readiness',
    desc: 'A live 0–100 score built from what you’ve actually done, with the next fix.',
    to: '/career',
  },
  {
    icon: FileText,
    title: 'Resume builder',
    desc: 'Build it once, keep it sharp — Dax reviews it when you want a second pair of eyes.',
    to: '/career/resume',
  },
  {
    icon: CalendarDays,
    title: 'Planner & deadlines',
    desc: 'Assignments, projects and prep tasks in one quiet list that feeds your day.',
    to: '/me/planner',
  },
  {
    icon: Users,
    title: 'Your campus, one place',
    desc: 'Feed, events, people and shared memories — you’re not doing this alone.',
    to: '/community',
  },
  {
    icon: Wallet,
    title: 'Money, explained simply',
    desc: 'SIPs, compounding, emergency funds — financial confidence before your first salary.',
        to: '/finance',
  },
  {
    icon: HeartHandshake,
    title: 'Wellbeing',
    desc: 'Breathing exercises, study techniques and a human to talk to when it’s heavy.',
    to: '/wellbeing',
  },
  {
    icon: Sparkles,
    title: 'Dax, where it helps',
    desc: 'Summaries, plans and guidance appear inside your work — never as homework.',
    to: '/study/notes',
  },
  {
    icon: Sun,
    title: 'A better you, daily',
    desc: 'Journal, streaks and small wins — six months from now, you’ll feel the difference.',
    to: '/me/journal',
  },
];

// Cursor-tracking radial glow: a per-card CSS custom property pair (--x, --y)
// updated on pointer move, consumed by a radial-gradient layer that's only
// opaque on hover. Cheaper than a JS-driven animation loop — the browser
// repaints the gradient, nothing re-renders.
function FeatureCard({ feature, color, onOpen, dark }) {
  const ref = useRef(null);

  const handleMove = useCallback((e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--x', `${e.clientX - rect.left}px`);
    el.style.setProperty('--y', `${e.clientY - rect.top}px`);
  }, []);

  return (
    <button
      ref={ref}
      onMouseMove={handleMove}
      onClick={() => onOpen(feature.to)}
      className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] dark:border-gray-800 dark:bg-gray-900 dark:shadow-none dark:hover:shadow-black/40"
      style={{ '--accent': color }}
    >
      {/* Gradient border glow, tracks the cursor, only visible on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(220px circle at var(--x, 50%) var(--y, 50%), var(--accent), transparent 70%)`,
          padding: '1.5px',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
        }}
      />
      {/* On dark the same cursor gradient also washes the card face — an
          accent glow reads as light in the dark, where a hairline alone is lost. */}
      {dark && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background: `radial-gradient(220px circle at var(--x, 50%) var(--y, 50%), var(--accent), transparent 70%)`,
            mixBlendMode: 'soft-light',
          }}
        />
      )}
      <feature.icon className="mb-3 h-6 w-6 text-gray-400 opacity-100 transition-opacity duration-200 group-hover:opacity-0 dark:text-gray-500" />
      <span
        aria-hidden
        className="absolute left-5 top-5 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      >
        <feature.icon className="h-6 w-6" style={{ color }} />
      </span>
      <p className="mb-1 font-semibold text-gray-900 dark:text-gray-100">{feature.title}</p>
      <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">{feature.desc}</p>
      <span
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-gray-400 transition-colors group-hover:text-gray-900 dark:text-gray-500 dark:group-hover:text-gray-100"
      >
        Open after login <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}

export default function LandingPage() {
  useDocumentTitle('Your student OS');
  const navigate = useNavigate();
  const { dark, toggle } = useTheme();

  const enter = (to) => navigate(`/login?next=${encodeURIComponent(to)}`);

  return (
    <div className="relative min-h-screen overflow-hidden bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      {/* A quiet field behind the type — a faint dot grid, no motion. Colour
          is reserved for the brand mark and interaction (card hover), not
          ambience. */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-[0.05] dark:opacity-[0.12]"
          style={{
            backgroundImage: `radial-gradient(${dark ? '#6b7280' : '#9ca3af'} 1px, transparent 1px)`,
            backgroundSize: '28px 28px',
          }}
        />
      </div>

      {/* Nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/" aria-label="DATAD — home" className="flex items-center">
          <DatadMark size="sm" />
        </Link>
        {/* Tighter gap below `sm`: at 360dp the logo, theme toggle, "Log in" and
            the join button are competing for the row, and the loser was "Log
            in", which broke across two lines as "Log" / "in". */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={toggle}
            aria-pressed={dark}
            aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
            title={dark ? 'Light theme' : 'Dark theme'}
            className="rounded-xl border border-gray-200 p-2 text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-900 dark:border-gray-800 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-100"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Link to="/login" className="whitespace-nowrap rounded-xl px-2.5 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 sm:px-4 dark:text-gray-400 dark:hover:text-gray-100">
            Log in
          </Link>
          <Link
            to="/register"
            className="rounded-xl bg-gray-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 sm:px-4 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
          >
            Join your campus
          </Link>
        </div>
      </header>

      {/* Hero */}
      <Stagger className="relative z-10 mx-auto max-w-4xl px-6 pt-14 text-center sm:pt-20">
        <p className="mx-auto mb-4 inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
          <ShieldCheck className="h-3.5 w-3.5" /> Built by students, for students · No ads · No tracking
        </p>
        <h1 className="text-4xl font-black leading-tight tracking-tight text-gray-900 sm:text-6xl dark:text-white">
          Your entire student life,
          <br />
          <span
            style={{
              backgroundImage: `linear-gradient(90deg, ${ACCENTS[0]}, ${ACCENTS[1]})`,
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            one calm place.
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-gray-500 sm:text-lg dark:text-gray-400">
          Notes, career prep, planning, money and wellbeing — everything a student juggles,
          designed to make you a little better every single day, whatever you&rsquo;re studying.
          Not louder. Better.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/login"
            className="group inline-flex items-center gap-2 rounded-2xl bg-gray-900 px-7 py-3.5 text-base font-semibold text-white transition-colors duration-150 hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
          >
            Enter the portal
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            to="/register"
            className="rounded-2xl border border-gray-300 px-7 py-3.5 text-base font-medium text-gray-700 transition-colors hover:border-gray-500 hover:text-gray-900 dark:border-gray-700 dark:text-gray-300 dark:hover:border-gray-500 dark:hover:text-white"
          >
            Create an account
          </Link>
        </div>
      </Stagger>

      {/* Feature grid */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-10 pt-16 sm:pt-24">
        <p className="animate-in mb-6 text-center text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
          Tap anything — it&rsquo;s waiting for you inside
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} feature={f} color={ACCENTS[i % ACCENTS.length]} onOpen={enter} dark={dark} />
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 pb-20 text-center">
        <div
          className="animate-in rounded-3xl border border-gray-200 p-10 dark:border-gray-800"
          style={{
            background: dark
              ? 'linear-gradient(135deg, rgba(77,124,255,0.14), rgba(124,108,255,0.14))'
              : 'linear-gradient(135deg, rgba(77,124,255,0.06), rgba(124,108,255,0.06))',
          }}
        >
          <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl dark:text-white">
            Six months from now, you&rsquo;ll be glad you started today.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-gray-500 dark:text-gray-400">
            More organised, more career-ready, more financially aware — and a lot less stressed.
            That&rsquo;s the whole point of DATAD.
          </p>
          <Link
            to="/register"
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-gray-900 px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
          >
            Start free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <p className="mt-10 text-xs text-gray-400 dark:text-gray-500">
          A D² Labs product · Independent, community-backed software · Your data belongs to you
        </p>
        <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
          <Link to="/brand" className="transition-colors hover:text-gray-600 dark:hover:text-gray-300">
            The story behind our logo
          </Link>
        </p>
      </section>
    </div>
  );
}
