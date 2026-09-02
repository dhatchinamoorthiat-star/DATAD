import {
  Briefcase,
  Home,
  Building2,
  FileText,
  Link2,
  MessageSquareQuote,
  Newspaper,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

/**
 * Placement mode — the non-admin experience.
 *
 * The full product (Study, Community, Life, Finance, Wellbeing…) reads as
 * overwhelming to students in oral testing: too many entry points competing
 * for the same attention. So everyone except an admin gets a narrower app
 * built around one job — landing a placement. Admins still see the whole
 * surface, unchanged, because they are the ones operating it.
 *
 * This is a client-side presentation gate, not a security boundary. It hides
 * and redirects; it does not protect data. Anything that must not be readable
 * by a student still needs its own server-side check (see AdminRoute and the
 * `requireAdmin` middleware).
 */

// Where a placement-mode user lands, and where disallowed URLs bounce to.
// The dashboard is home for everyone, admin or not — it is the day's assembly
// (focus, readiness, opportunities, briefing) and reads the same whichever app
// you are in. Placement mode narrows what it links out to, not whether you
// get it; /placement is one stop on the rail rather than the front door.
export const PLACEMENT_HOME = '/dashboard';

// The quick-navigation rail for placement mode. Flat on purpose: these are
// the individual tools, not sections to drill into, so a student reads the
// whole of their app in one glance. `accent` feeds RailSidebar's ICON_ACCENT
// map and is deliberately shared across the career tools — the placement rail
// should read as one family rather than nine competing colours.
export const PLACEMENT_NAV = [
  { key: 'dashboard', accent: 'dashboard', label: 'Home', to: '/dashboard', icon: Home },
  { key: 'placement', accent: 'placement', label: 'Placement', to: '/placement', icon: Briefcase, end: true },
  { key: 'opportunities', accent: 'placement', label: 'Opportunities', to: '/placement/opportunities', icon: Building2 },
  { key: 'companies', accent: 'placement', label: 'Companies', to: '/placement/companies', icon: Building2 },
  { key: 'resume', accent: 'placement', label: 'Resume', to: '/placement/resume', icon: FileText },
  { key: 'linkedin', accent: 'placement', label: 'LinkedIn', to: '/placement/linkedin', icon: Link2 },
  { key: 'questions', accent: 'placement', label: 'Interview Qs', to: '/placement/questions', icon: MessageSquareQuote },
  { key: 'growth', accent: 'growth', label: 'Growth', to: '/growth', icon: TrendingUp },
  { key: 'briefing', accent: 'dashboard', label: 'Briefing', to: '/briefing', icon: Newspaper },
  { key: 'dax', accent: 'dax', label: 'Dax', to: '/dax?home', icon: Sparkles },
];

// Path prefixes a placement-mode user may open. Beyond the nav above this
// carries the plumbing every signed-in user needs a route to — settings,
// billing, search, the legal pages — otherwise the gate would strand them
// somewhere they can't sign out of or manage their own account from.
const ALLOWED_PREFIXES = [
  '/dashboard',
  '/placement',
  // Legacy URLs that resolve *into* placement. These paths render nothing but
  // a redirect, so they have to survive the gate — otherwise the gate fires
  // first and swallows the rest of the path, turning /career/resume into
  // /placement instead of /placement/resume.
  '/career',
  '/resume',
  '/companies',
  '/news',
  '/roadmap',
  '/growth',
  '/briefing',
  '/dax',
  '/me/settings',
  '/me/program',
  // The placement journey's last step ("Plan & Track") sends students here to
  // schedule their prep milestones, so the page has to be reachable even
  // though it gets no rail entry of its own.
  '/me/planner',
  '/search',
  '/subscribe',
  '/support',
  '/about',
  '/privacy',
  '/terms',
];

/**
 * Is `pathname` inside placement mode?
 *
 * Prefix match on path segments, so /placements (were one ever added) does not
 * slip through on /placement. Query strings never reach here — react-router
 * hands us the pathname alone.
 */
// Workspaces whose secondary tab row would only repeat the placement rail.
// The rail already lists every placement tool, so the row is pure duplication
// there; Growth keeps its tabs because the rail carries only its section link.
export const PLACEMENT_TAB_DUPES = ['placement'];

export function isPlacementPath(pathname) {
  return ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
