import useViewSwitch from '../../hooks/useViewSwitch';
import AssignmentsPage from './AssignmentsPage';
import ProjectsPage from './ProjectsPage';
import { Page } from '../../components/common/motion';

// "Work" = everything a student owes: assignments and group projects.
export default function WorkPage() {
  const { active, switcher } = useViewSwitch(
    [
      { key: 'assignments', label: 'Assignments' },
      { key: 'projects', label: 'Projects' },
    ],
    'assignments'
  );

  return (
    <Page overview={{
      pageKey: 'study-work',
      title: 'Everything you owe',
      blurb: 'Assignments and group projects in one place, with due dates and status so nothing slips past a deadline.',
      takeaway: 'Sort by due date and clear the closest one first.',
    }}>
      {switcher}
      {active === 'projects' ? <ProjectsPage /> : <AssignmentsPage />}
    </Page>
  );
}
