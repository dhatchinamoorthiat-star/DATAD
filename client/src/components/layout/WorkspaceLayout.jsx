import { NavLink, Outlet } from 'react-router-dom';
import { WORKSPACE_TABS } from '../../utils/workspaces';
import { useAuth } from '../../context/AuthContext';
import { PLACEMENT_TAB_DUPES, isPlacementPath } from '../../utils/placementNav';

// Rounded pill segmented control: the active page reads through a soft
// filled pill, matching the product's "rounded navigation" language.
const tabClass = ({ isActive }) =>
  `whitespace-nowrap rounded-full px-4 py-1.5 text-sm transition-all duration-150 ${
    isActive
      ? 'bg-primary-50 font-semibold text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
      : 'font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-100'
  }`;

// Shared shell for a workspace: a secondary tab row, then the page. The row is
// full-width and centre-aligned, so it stays visually centred over the page
// body whichever measure that page uses (CONTAINER or CONTAINER_WIDE).
export default function WorkspaceLayout({ workspace, title, extraTabs = [] }) {
  const placementOnly = useAuth()?.user?.role !== 'admin';
  const all = [...(WORKSPACE_TABS[workspace] || []), ...extraTabs];

  // Placement mode reaches a few pages that sit inside a wider workspace — the
  // planner, say, which the placement journey links to. Their sibling tabs all
  // lead somewhere the gate would bounce, so the row is filtered down to what
  // a student can actually open.
  const tabs = placementOnly ? all.filter((t) => isPlacementPath(t.to.split(/[?#]/)[0])) : all;

  // Two reasons to drop the bar entirely rather than render a thinned one: the
  // rail already lists every link in it (the placement workspace itself), or so
  // little survived the filter that a row of one reads worse than no row.
  if (placementOnly && (PLACEMENT_TAB_DUPES.includes(workspace) || tabs.length < 2)) {
    return <Outlet />;
  }

  return (
    <>
      <div className="sticky top-[53px] z-30 border-b border-gray-100 bg-white/90 backdrop-blur-md print:hidden dark:border-gray-800/70 dark:bg-gray-950/90">
        <div className="scroll-ios flex items-center justify-center gap-2 overflow-x-auto px-4 py-3">
          <span className="hidden shrink-0 text-sm font-semibold text-gray-900 dark:text-gray-100 sm:block">{title}</span>
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className={tabClass}>
              {t.label}
            </NavLink>
          ))}
        </div>
      </div>
      <Outlet />
    </>
  );
}
