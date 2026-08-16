import { NavLink, Outlet } from 'react-router-dom';
import { WORKSPACE_TABS } from '../../utils/workspaces';
import { CONTAINER } from '../common/motion';

// Rounded pill segmented control: the active page reads through a soft
// filled pill, matching the product's "rounded navigation" language.
const tabClass = ({ isActive }) =>
  `whitespace-nowrap rounded-full px-4 py-1.5 text-sm transition-all duration-150 ${
    isActive
      ? 'bg-primary-50 font-semibold text-primary-700 dark:bg-primary-900/30 dark:text-primary-300'
      : 'font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/60 dark:hover:text-gray-100'
  }`;

// Shared shell for a workspace: a secondary tab row, then the page. The row
// shares CONTAINER with <Page>, so a tab sits directly above the content it
// labels instead of floating on a wider measure.
export default function WorkspaceLayout({ workspace, title, extraTabs = [] }) {
  const tabs = [...(WORKSPACE_TABS[workspace] || []), ...extraTabs];
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
