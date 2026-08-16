// Curated, static content for the PSW ("Pitch. Sell. Win.") masterpage.
//
// Deliberately not wired to live data or Dax: this page has one job — look
// finished and tell the story every time, on any network, in front of
// anyone — so it can't inherit the flakiness of the real backend (AI
// provider timeouts, empty states for a fresh account, etc).
//
// The 6 pillars below match the Aug 13, 2026 pitch-event framing, not the
// older DATAD_Pitch_Deck.md grouping — the live app has 9 distinct
// top-level sections (Study, Planner, Career, Dashboard/Briefing, Finance,
// Community, Journal, Wellbeing, Dax) and neither "6" cleanly maps onto
// that, so this is one deliberate compression, chosen for this event.

import {
  CalendarClock, Briefcase, Sun, Wallet, Users, Sparkles,
} from 'lucide-react';

// `route` is the real, live in-app workspace for that pillar — clicking a
// card sends you into the actual product, not a screenshot of it. Every
// route below is protected, so a signed-out visitor gets bounced to /login
// with a `next` redirect back here, then lands exactly where they clicked.
export const PSW_FEATURES = [
  {
    id: 'planner',
    route: '/me/planner',
    icon: CalendarClock,
    color: 'text-cyan-400',
    ring: 'border-cyan-500/30',
    glow: 'from-cyan-500/10 via-slate-900 to-slate-900',
    name: 'Planner & Deadlines',
    tagline: 'Every due date, one timeline',
    hook: 'Dax surfaces what’s due next and helps you plan around it.',
  },
  {
    id: 'career',
    route: '/career',
    icon: Briefcase,
    color: 'text-indigo-400',
    ring: 'border-indigo-500/30',
    glow: 'from-indigo-500/10 via-slate-900 to-slate-900',
    name: 'Resume Builder & Career Readiness',
    tagline: 'Resume builder, company prep, mock interviews',
    hook: 'AI resume review, interview coaching, company insights.',
  },
  {
    id: 'briefing',
    route: '/dashboard',
    icon: Sun,
    color: 'text-amber-300',
    ring: 'border-amber-400/30',
    glow: 'from-amber-400/10 via-slate-900 to-slate-900',
    name: 'Calm Daily Home & Briefing',
    tagline: 'One dashboard, one daily briefing',
    hook: 'Dax opens every day with what actually matters, nothing else.',
  },
  {
    id: 'finance',
    route: '/finance',
    icon: Wallet,
    color: 'text-emerald-400',
    ring: 'border-emerald-500/30',
    glow: 'from-emerald-500/10 via-slate-900 to-slate-900',
    name: 'Money, Explained Simply',
    tagline: 'Expense tracking, budgeting, goals',
    hook: 'Financial literacy coaching, personalized budget advice.',
  },
  {
    id: 'community',
    route: '/community',
    icon: Users,
    color: 'text-rose-400',
    ring: 'border-rose-500/30',
    glow: 'from-rose-500/10 via-slate-900 to-slate-900',
    name: 'Your Campus, One Place',
    tagline: 'Discussions, skill exchange, events',
    hook: 'Dax facilitates peer learning and mentor matching.',
  },
  {
    id: 'dax',
    route: '/dax',
    icon: Sparkles,
    color: 'text-purple-400',
    ring: 'border-purple-500/30',
    glow: 'from-purple-500/10 via-slate-900 to-slate-900',
    name: 'Dax Assistant & Student Wellbeing',
    tagline: 'The advisor woven through every dimension',
    hook: 'Context-aware memory, frontier-model reasoning, and wellbeing check-ins in one place.',
  },
];

export const PSW_TRACTION = [
  { stat: '100+', label: 'active students, B-school cohort' },
  { stat: '85%', label: 'weekly active usage, no prompting' },
  { stat: '60%', label: 'free → Pro conversion in placement season' },
  { stat: '2,000+', label: 'AI resume reviews generated' },
  { stat: '500+', label: 'mock interviews run' },
  { stat: '500+', label: 'community discussion messages' },
];

export const PSW_TIERS = [
  { name: 'Free', price: 'Forever free', model: 'Llama 8B', best: 'All students' },
  { name: 'Pro', price: '₹299/month', model: 'DeepSeek Flash', best: 'Placement seekers' },
  { name: 'Max', price: '₹499/month', model: 'DeepSeek Pro', best: 'High achievers' },
];
