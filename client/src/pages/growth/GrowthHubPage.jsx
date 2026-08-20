import { Link } from 'react-router-dom';
import { Map, ArrowRightLeft, Star } from 'lucide-react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { Page } from '../../components/common/motion';

export default function GrowthHubPage() {
  useDocumentTitle('Growth');

  return (
    <Page overview={{
      pageKey: 'growth-hub',
      title: 'The longer game',
      blurb: 'Roadmap, Pivot and STAR Stories — the planning side of your career, separate from the day-to-day job hunt.',
      takeaway: 'Set a target role in Roadmap first; the other two build on it.',
    }}>
      <div className="mb-8">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Growth</h1>
        <p className="text-sm text-gray-500 mt-0.5">Plan the path, not just the next application</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <QuickLink
          to="/growth/roadmap"
          icon={Map}
          label="Roadmap"
          description="Skill gaps and a generated plan to close them"
        />
        <QuickLink
          to="/growth/pivot"
          icon={ArrowRightLeft}
          label="Pivot"
          description="Track a move from one domain to another"
        />
        <QuickLink
          to="/growth/stories"
          icon={Star}
          label="STAR Stories"
          description="Behavioral interview story bank"
        />
      </div>
    </Page>
  );
}

function QuickLink({ to, icon: Icon, label, description }) {
  return (
    <Link
      to={to}
      className="group rounded-2xl border border-gray-100 p-5 hover:border-primary-200 hover:shadow-sm transition-all dark:border-gray-800 dark:hover:border-primary-800/50"
    >
      <Icon className="h-5 w-5 text-gray-400 group-hover:text-primary-500 dark:text-gray-500" />
      <p className="mt-3 text-sm font-semibold text-gray-800 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400">
        {label}
      </p>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{description}</p>
    </Link>
  );
}