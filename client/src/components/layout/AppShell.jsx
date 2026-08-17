import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Search,
  Sun,
  Moon,
  LogOut,
  Sparkles,
  Crown,
  BookLock,
  Info,
  ChevronDown,
  Zap,
  HeartHandshake,
  Settings,
  Gem,
} from 'lucide-react';
import { DatadMark } from '../common/Logo';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { TIER_RING, TIER_BADGE_STYLE } from '../../utils/tiers';
import { useLocation } from 'react-router-dom';
import { WORKSPACES, isWorkspaceActive } from '../../utils/workspaces';
import CommandPalette from '../common/CommandPalette';
import DaxPanel from '../chat/DaxPanel';
import Footer from './Footer';

const AdminIcon = Crown;

// Minimal rounded rail: the selected page reads through a soft blue pill,
// hover is a whisper. No heavy sidebar chrome.
const railLink = ({ isActive }) =>
  `flex items-center gap-3 rounded-full px-3.5 py-2 text-sm transition-all duration-150 ${
    isActive
      ? 'bg-primary-50 font-semibold text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
      : 'font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/50 dark:hover:text-gray-100'
  }`;

function AvatarMenu() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const { tier } = useSubscription();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    const onMouse = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const initials = (user?.name || '')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const item =
    'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800';

  return (
    <div className="relative flex items-center gap-2" ref={ref}>
      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${TIER_BADGE_STYLE[tier] || TIER_BADGE_STYLE.free}`}>
        {tier}
      </span>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full p-0.5 hover:ring-2 hover:ring-primary-200 dark:hover:ring-primary-800"
        aria-label="Account menu"
      >
        <span className={`relative flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700 dark:bg-primary-900/50 dark:text-primary-300 ${TIER_RING[tier] || ''}`}>
          {initials}
        </span>
        <ChevronDown className={`hidden h-3.5 w-3.5 text-gray-400 transition-transform sm:block ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-lg dark:border-gray-800 dark:bg-gray-900">
          <p className="truncate px-2.5 pt-1 text-xs text-gray-400">{user?.name}</p>
          <div className="mb-1 px-2.5 pb-1">
            <NavLink
              to="/subscribe"
              onClick={() => setOpen(false)}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition-opacity hover:opacity-80 ${TIER_BADGE_STYLE[tier] || TIER_BADGE_STYLE.free}`}
            >
              {tier === 'max' ? <Crown className="h-3 w-3" /> : <Zap className="h-3 w-3" />}
              DATAD {tier}
            </NavLink>
          </div>
          {isAdmin && (
            <NavLink to="/admin" onClick={() => setOpen(false)} className={item}>
              <Crown className="h-4 w-4 text-warn-600" /> Admin hub
            </NavLink>
          )}
          <NavLink to="/me/journal" onClick={() => setOpen(false)} className={item}>
            <BookLock className="h-4 w-4 text-primary-500" /> Journal
          </NavLink>
          <NavLink to="/wellbeing" onClick={() => setOpen(false)} className={item}>
            <HeartHandshake className="h-4 w-4 text-primary-500" /> Feeling stressed? Reach out
          </NavLink>
          <NavLink to="/support" onClick={() => setOpen(false)} className={item}>
            <Sparkles className="h-4 w-4 text-primary-500" /> Back DATAD
          </NavLink>
          <NavLink to="/about" onClick={() => setOpen(false)} className={item}>
            <Info className="h-4 w-4 text-primary-500" /> About
          </NavLink>
          <button onClick={toggle} className={item}>
            {dark ? <Sun className="h-4 w-4 text-warn-500" /> : <Moon className="h-4 w-4 text-primary-500" />}
            {dark ? 'Light mode' : 'Dark mode'}
          </button>
          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            className={item}
          >
            <LogOut className="h-4 w-4 text-gray-400" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

// Map the current route to a Dax context string so the embedded panel
// knows which workspace the student is in.
function routeContext(pathname) {
  if (pathname.startsWith('/study/notes')) return 'notes';
  if (pathname.startsWith('/study')) return 'study';
  if (pathname.startsWith('/career/resume')) return 'resume';
  if (pathname.startsWith('/career')) return 'career';
  if (pathname.startsWith('/me/planner') || pathname.startsWith('/planner')) return 'planner';
  if (pathname.startsWith('/community')) return 'community';
  if (pathname.startsWith('/finance')) return 'finance';
  if (pathname.startsWith('/me')) return 'planner';
  return undefined;
}

export default function AppShell({ children }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const location = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Global ⌘K / Ctrl+K.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex min-h-screen">
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-gray-100 bg-white px-4 py-5 dark:border-gray-800/70 dark:bg-gray-950 lg:flex print:hidden">
        <div className="mb-7 px-2 font-semibold">
          <DatadMark />
        </div>
        <button
          onClick={() => setPaletteOpen(true)}
          className="mb-5 flex items-center gap-2 rounded-full border border-gray-200 px-3.5 py-2 text-sm text-gray-400 transition-colors hover:border-primary-300 hover:text-gray-600 dark:border-gray-800 dark:hover:border-primary-700"
        >
          <Search className="h-4 w-4" /> Search…
          <kbd className="ml-auto rounded border border-gray-200 px-1.5 py-0.5 text-[10px] dark:border-gray-700">⌘K</kbd>
        </button>
        <nav className="flex flex-col gap-1">
          {WORKSPACES.map((w) => (
            // Active state is computed, not left to NavLink: Life has to stay
            // lit on /finance and /wellbeing, which are not under /me.
            <NavLink key={w.key} to={w.to} className={railLink({ isActive: isWorkspaceActive(location.pathname, w) })}>
              <w.icon className="h-[18px] w-[18px]" /> {w.label}
            </NavLink>
          ))}
          {isAdmin && (
            <>
              <div className="mx-2 my-2 border-t border-gray-100 dark:border-gray-800/70" />
              <NavLink to="/admin" className={railLink}>
                <AdminIcon className="h-[18px] w-[18px] text-warn-600" />
                <span>Admin</span>
              </NavLink>
            </>
          )}
        </nav>
        <div className="mt-auto space-y-1">
          <NavLink
            to="/subscribe"
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800/50 dark:hover:text-gray-200'
              }`
            }
          >
            <Gem className="h-3.5 w-3.5 shrink-0 text-primary-500" /> Upgrade plan
          </NavLink>
          <NavLink
            to="/wellbeing"
            className="flex items-center gap-2 rounded-full px-3.5 py-2 text-xs text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800/50 dark:hover:text-gray-300"
          >
            <HeartHandshake className="h-3.5 w-3.5 shrink-0" /> Feeling stressed? Reach out
          </NavLink>
          <p className="px-3 pt-1 text-[11px] text-gray-400">Your student OS — every day, one place.</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur-md print:hidden dark:border-gray-800/70 dark:bg-gray-950/90">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
            {/* Logo — mobile only; on desktop the sidebar already shows it */}
            <div className="flex items-center lg:hidden">
              <DatadMark className="h-6 w-6" />
            </div>

            {/* Search lives in the sidebar (⌘K palette) — no duplicate here */}
            <div className="hidden flex-1 lg:block" />

            {/* Right side actions - visible on lg and up */}
            <div className="hidden items-center gap-2 lg:flex">
              <NavLink to="/me/settings" aria-label="Settings" className={({ isActive }) => `rounded-full p-2 transition-colors ${isActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'}`}>
                <Settings className="h-5 w-5" />
              </NavLink>
              <AvatarMenu />
            </div>

            {/* Mobile view - keep original search button that opens command palette */}
            <div className="lg:hidden">
              <button
                onClick={() => setPaletteOpen(true)}
                aria-label="Search"
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                <Search className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 pb-20 lg:pb-0">{children}</main>
        <Footer />
      </div>

      <DaxPanel context={routeContext(location.pathname)} />

      {/* Mobile bottom tab bar — sits above the iOS home indicator */}
      <nav className="glass fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-gray-100 pb-[max(env(safe-area-inset-bottom),8px)] dark:border-gray-800/70 lg:hidden print:hidden">
        {WORKSPACES.map((w) => {
          const active = isWorkspaceActive(location.pathname, w);
          return (
            <NavLink
              key={w.key}
              to={w.to}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                active ? 'text-primary-600 dark:text-primary-400' : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <span className={`rounded-full p-1.5 transition-colors ${active ? 'bg-primary-100 dark:bg-primary-900/50' : ''}`}>
                <w.icon className="h-5 w-5" />
              </span>
              {w.label}
            </NavLink>
          );
        })}
        {/* Admin is reachable from the avatar menu and the desktop rail. WORKSPACES
            is capped at five so each target here clears the 44pt minimum. */}
      </nav>
    </div>
  );
}
