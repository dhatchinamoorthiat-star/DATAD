import { Home, BookOpen, Briefcase, Users, Sun, Wallet, HeartHandshake, Sparkles } from 'lucide-react';

export const WORKSPACES = [
  { key: 'dashboard', label: 'Home', to: '/', icon: Home, end: true },
  { key: 'dax', label: 'Dax', to: '/dax?home', icon: Sparkles },
  { key: 'study', label: 'Study', to: '/study', icon: BookOpen },
  { key: 'career', label: 'Career', to: '/career', icon: Briefcase },
  { key: 'community', label: 'Community', to: '/community', icon: Users },
  { key: 'me', label: 'Life', to: '/me', icon: Sun },
  { key: 'finance', label: 'Finance', to: '/finance', icon: Wallet },
  { key: 'wellbeing', label: 'Wellbeing', to: '/wellbeing', icon: HeartHandshake },
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
  me: [
    { to: '/me', label: 'Overview', end: true },
    { to: '/me/journal', label: 'Journal' },
    { to: '/me/planner', label: 'Planner' },
    { to: '/me/calendar', label: 'Calendar' },
  ],
  finance: [
    { to: '/finance', label: 'Overview', end: true },
    { to: '/finance/tracker', label: 'Tracker' },
    { to: '/finance/calculator', label: 'Calculator' },
    { to: '/finance/stocks', label: 'Stocks' },
    { to: '/finance/learn', label: 'Learn' },
    { to: '/finance/roi', label: 'ROI' },
  ],
  wellbeing: [
    { to: '/wellbeing', label: 'Breathing', end: true },
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