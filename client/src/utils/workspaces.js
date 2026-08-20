import { Home, BookOpen, Briefcase, Users, Sun, Sparkles, TrendingUp, Wallet, HeartPulse } from 'lucide-react';

// Primary navigation. This list renders as both the desktop rail and the mobile
// bottom tab bar. Finance and Wellbeing sat here originally, spent a while as
// Life tabs, and are top-level again — each owns enough sub-categories to be a
// section in its own right rather than a tab inside someone else's row.
//
// There is no longer a hard ceiling here. The bottom bar used to divide the
// width by `flex-1`, which capped the list at seven before targets fell under
// the 44pt minimum; it now scrolls horizontally with fixed-width targets, so
// the count is a judgement call about how long a row a user will scan, not a
// layout constraint. Keep it short anyway — items past the fold are easy to
// miss on a phone.
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
  // Roadmap/Pivot/STAR Stories split out of Career into their own primary
  // section — the Career tab row was carrying too many sub-categories.
  { key: 'growth', label: 'Growth', to: '/growth', icon: TrendingUp },
  { key: 'community', label: 'Community', to: '/community', icon: Users },
  // Life is now the personal-organisation section only — journal, planner,
  // calendar. Money and health moved out to stand on their own.
  { key: 'me', label: 'Life', to: '/me', icon: Sun },
  { key: 'finance', label: 'Finance', to: '/finance', icon: Wallet },
  { key: 'wellbeing', label: 'Wellbeing', to: '/wellbeing', icon: HeartPulse },
];

// Extra path prefixes that should light up a primary nav item. Empty now that
// Finance and Wellbeing own their own entries — kept because the matcher below
// reads it and the next section to absorb a stray URL will want it.
const WORKSPACE_ALIASES = {};

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

// The Life tab row. Finance and Wellbeing used to be spread into the Finance
// and Wellbeing rows from here so a student who tapped into either still saw
// the parent hierarchy; both are their own sections now, so each owns a clean
// row of its own sub-categories and this list is Life's alone.
const LIFE_TABS = [
  { to: '/me', label: 'Overview', end: true },
  { to: '/me/journal', label: 'Journal' },
  { to: '/me/planner', label: 'Planner' },
  { to: '/me/calendar', label: 'Calendar' },
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
    { to: '/career/companies', label: 'Companies' },
    { to: '/career/opportunities', label: 'Opportunities' },
    { to: '/career/resume', label: 'Resume' },
    { to: '/career/linkedin', label: 'LinkedIn' },
    { to: '/career/questions', label: 'Interview Qs' },
    // Roadmap, Pivot and STAR Stories moved to their own primary section
    // (Growth) — this row was carrying too many sub-categories for the
    // job-search core to read clearly. Briefing dropped entirely: it's a
    // global news feature (also surfaced in Study), not career-specific, and
    // stays reachable from the dashboard/readiness cards instead of a tab here.
  ],
  growth: [
    { to: '/growth', label: 'Overview', end: true },
    { to: '/growth/roadmap', label: 'Roadmap' },
    { to: '/growth/pivot', label: 'Pivot' },
    { to: '/growth/stories', label: 'STAR Stories' },
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
    { to: '/finance', label: 'Overview', end: true },
    { to: '/finance/tracker', label: 'Tracker' },
    { to: '/finance/calculator', label: 'Calculator' },
    { to: '/finance/stocks', label: 'Stocks' },
    { to: '/finance/learn', label: 'Learn' },
    { to: '/finance/roi', label: 'ROI' },
  ],
  wellbeing: [
    { to: '/wellbeing', label: 'Overview', end: true },
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
