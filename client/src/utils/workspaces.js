import { Home, BookOpen, Briefcase, Users, Sun, Sparkles } from 'lucide-react';

// Primary navigation. This list renders as both the desktop rail and the mobile
// bottom tab bar. Finance and Wellbeing used to sit here; they are sub-sections
// of Life (the Life hub already linked to both), so they are tabs now.
//
// Six is the ceiling. Each mobile target is `flex-1`, so six clears the 44pt
// minimum even on a 320px screen (53px each) — a seventh would not, and the
// labels would start wrapping before that. Add a seventh item and the bottom
// bar needs rethinking rather than one more entry.
export const WORKSPACES = [
  // "/" redirects logged-in users to /dashboard, so an `end`-matched link to
  // "/" could never be active. Point at the URL the user actually lands on.
  { key: 'dashboard', label: 'Home', to: '/dashboard', icon: Home },
  // `?home` opens Dax's home mode rather than the workspace view (DaxPage reads
  // it via searchParams). /dax renders outside the app shell, so tapping this
  // leaves the bar behind — DaxApp's exitHref sends you back to /dashboard.
  { key: 'dax', label: 'Dax', to: '/dax?home', icon: Sparkles },
  { key: 'study', label: 'Study', to: '/study', icon: BookOpen },
  { key: 'career', label: 'Career', to: '/career', icon: Briefcase },
  { key: 'community', label: 'Community', to: '/community', icon: Users },
  // Life owns /me, and now /finance and /wellbeing too — see WORKSPACE_ALIASES.
  { key: 'me', label: 'Life', to: '/me', icon: Sun },
];

// Extra path prefixes that should light up a primary nav item. Finance and
// Wellbeing keep their own top-level URLs (bookmarks and legacy redirects point
// at them), but they belong to Life as far as the nav is concerned.
const WORKSPACE_ALIASES = {
  me: ['/finance', '/wellbeing'],
};

// Shared by the desktop rail and the mobile tab bar so the two can never
// disagree about which section the user is in.
//
// `to` may carry a query string (Dax uses `?home` to pick its opening mode).
// That part is a destination detail, not part of the section's identity, so it
// is stripped before matching — otherwise /dax would never light up its own tab.
export function isWorkspaceActive(pathname, workspace) {
  const prefixes = [workspace.to, ...(WORKSPACE_ALIASES[workspace.key] || [])]
    .map((p) => p.split(/[?#]/)[0]);
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// The Life tab row, reused by the Finance and Wellbeing workspaces so a student
// who taps into either still sees where they are in the hierarchy.
const LIFE_TABS = [
  { to: '/me', label: 'Overview', end: true },
  { to: '/me/journal', label: 'Journal' },
  { to: '/me/planner', label: 'Planner' },
  { to: '/me/calendar', label: 'Calendar' },
  { to: '/finance', label: 'Finance', end: true },
  { to: '/wellbeing', label: 'Wellbeing', end: true },
];

export const WORKSPACE_TABS = {
  study: [
    { to: '/study', label: 'Overview', end: true },
    { to: '/study/notes', label: 'Notes' },
    { to: '/study/work', label: 'Work' },
    { to: '/study/resources', label: 'Resources' },
    { to: '/study/focus', label: 'Focus' },
  ],
  career: [
    { to: '/career', label: 'Overview', end: true },
    { to: '/career/roadmap', label: 'Roadmap' },
    { to: '/career/companies', label: 'Companies' },
    { to: '/career/opportunities', label: 'Opportunities' },
    { to: '/career/resume', label: 'Resume' },
    { to: '/career/linkedin', label: 'LinkedIn' },
    // Reachable from the hub's Quick Links but previously unreachable by tab.
    { to: '/career/questions', label: 'Interview Qs' },
    { to: '/career/pivot', label: 'Pivot' },
    { to: '/career/stories', label: 'STAR Stories' },
    { to: '/briefing', label: 'Briefing' },
  ],
  community: [
    { to: '/community', label: 'Overview', end: true },
    { to: '/community/feed', label: 'Feed' },
    { to: '/community/announcements', label: 'Announcements' },
    { to: '/community/events', label: 'Events' },
    { to: '/community/directory', label: 'People' },
    { to: '/community/memories', label: 'BatchVault' },
    { to: '/community/marketplace', label: 'Marketplace' },
    { to: '/community/skills', label: 'Skills' },
  ],
  me: LIFE_TABS,
  finance: [
    ...LIFE_TABS,
    { to: '/finance/tracker', label: 'Tracker' },
    { to: '/finance/calculator', label: 'Calculator' },
    { to: '/finance/stocks', label: 'Stocks' },
    { to: '/finance/learn', label: 'Learn' },
    { to: '/finance/roi', label: 'ROI' },
  ],
  wellbeing: [
    ...LIFE_TABS,
    { to: '/wellbeing/study', label: 'Study Tips' },
    { to: '/wellbeing/memory', label: 'Memory' },
    { to: '/wellbeing/routines', label: 'Routines' },
    { to: '/wellbeing/support', label: 'Support' },
  ],
};

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
