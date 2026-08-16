import { Home, BookOpen, Briefcase, Users, Sun, Wallet, HeartHandshake, Sparkles } from 'lucide-react';

// Pitch mode: college-fest stall build shows only the 6 modules from the
// pitch proposal (Planner, Resume/Career, Daily Briefing, Finance, Campus
// Hub, Dax + Wellbeing) and hides the rest so the demo isn't overwhelming.
// Toggle with VITE_PITCH_MODE=true in client/.env — no code change needed
// to flip it back after the event.
export const PITCH_MODE = import.meta.env.VITE_PITCH_MODE === 'true';

const WORKSPACES_FULL = [
  { key: 'dashboard', label: 'Home', to: '/', icon: Home, end: true },
  { key: 'dax', label: 'Dax', to: '/dax?home', icon: Sparkles },
  { key: 'study', label: 'Study', to: '/study', icon: BookOpen },
  { key: 'career', label: 'Career', to: '/career', icon: Briefcase },
  { key: 'community', label: 'Community', to: '/community', icon: Users },
  { key: 'me', label: 'Life', to: '/me', icon: Sun },
  { key: 'finance', label: 'Finance', to: '/finance', icon: Wallet },
  { key: 'wellbeing', label: 'Wellbeing', to: '/wellbeing', icon: HeartHandshake },
];

// Study isn't one of the 6 pitch-proposal modules (Planner, Resume/Career,
// Daily Briefing, Finance, Campus Hub, Dax + Wellbeing) — dropped from the top
// nav in pitch mode so a stall visitor never lands on it in the first place.
export const WORKSPACES = PITCH_MODE
  ? WORKSPACES_FULL.filter((w) => w.key !== 'study')
  : WORKSPACES_FULL;

const WORKSPACE_TABS_FULL = {
  study: [
    { to: '/study', label: 'Overview', end: true },
    { to: '/study/notes', label: 'Notes' },
    { to: '/study/work', label: 'Work' },
    { to: '/study/resources', label: 'Resources', soon: true },
    { to: '/study/focus', label: 'Focus', soon: true },
  ],
  career: [
    { to: '/career', label: 'Overview', end: true },
    { to: '/career/roadmap', label: 'Roadmap', soon: true },
    { to: '/career/companies', label: 'Companies' },
    { to: '/career/opportunities', label: 'Opportunities', soon: true },
    { to: '/career/resume', label: 'Resume' },
    { to: '/career/pivot', label: 'Pivot', soon: true },
    { to: '/career/stories', label: 'STAR Stories', soon: true },
    { to: '/briefing', label: 'Briefing' },
  ],
  community: [
    { to: '/community', label: 'Overview', end: true },
    { to: '/community/feed', label: 'Feed' },
    { to: '/community/announcements', label: 'Announcements' },
    { to: '/community/events', label: 'Events', soon: true },
    { to: '/community/directory', label: 'People', soon: true },
    { to: '/community/memories', label: 'BatchVault', soon: true },
    { to: '/community/marketplace', label: 'Marketplace', soon: true },
    { to: '/community/skills', label: 'Skills', soon: true },
  ],
  me: [
    { to: '/me', label: 'Overview', end: true },
    { to: '/me/journal', label: 'Journal', soon: true },
    { to: '/me/planner', label: 'Planner' },
    { to: '/me/calendar', label: 'Calendar', soon: true },
  ],
  finance: [
    { to: '/finance', label: 'Overview', end: true },
    { to: '/finance/tracker', label: 'Tracker' },
    { to: '/finance/calculator', label: 'Calculator' },
    { to: '/finance/stocks', label: 'Stocks' },
    { to: '/finance/learn', label: 'Learn' },
    { to: '/finance/roi', label: 'ROI', soon: true },
  ],
  wellbeing: [
    { to: '/wellbeing', label: 'Breathing', end: true },
    { to: '/wellbeing/study', label: 'Study Tips' },
    { to: '/wellbeing/memory', label: 'Memory', soon: true },
    { to: '/wellbeing/routines', label: 'Routines', soon: true },
    { to: '/wellbeing/support', label: 'Support' },
  ],
};

// In pitch mode, tabs marked `soon` are dropped entirely rather than shown
// disabled — the goal is fewer things on screen, not more explaining.
export const WORKSPACE_TABS = PITCH_MODE
  ? Object.fromEntries(
      Object.entries(WORKSPACE_TABS_FULL).map(([key, tabs]) => [
        key,
        tabs.filter((t) => !t.soon),
      ])
    )
  : WORKSPACE_TABS_FULL;

export const LEGACY_REDIRECTS = {
  '/notes': '/study/notes',
  '/planner': '/me/planner',
  '/finance': '/finance',
  '/me/finance': '/finance',
  '/settings': '/me/settings',
  '/journal': '/me/journal',
  '/reflection': '/me/reflection',
  '/resume': '/career/resume',
  '/companies': '/career/companies',
  '/albums': '/community/memories',
  '/entertainment': '/community/archive',
};