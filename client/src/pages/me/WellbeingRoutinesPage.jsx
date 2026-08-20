import { Sunrise } from 'lucide-react';
import { Page } from '../../components/common/motion';
import { ROUTINES } from '../../utils/wellbeingContent';
import RotatingTechniques from '../../components/common/RotatingTechniques';

const ACCENT = {
  card: 'border-orange-200 bg-orange-50/60 dark:border-orange-900/50 dark:bg-orange-950/20',
  label: 'text-orange-600 dark:text-orange-400',
};

export default function WellbeingRoutinesPage() {
  return (
    <Page overview={{
      pageKey: 'wellbeing-routines',
      title: 'Sleep, food, movement',
      blurb: 'The daily habits that decide how much your study hours are actually worth.',
      takeaway: 'Fix sleep first — it costs nothing and everything else gets easier.',
    }}>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Sunrise className="h-5 w-5 text-orange-500" /> Small routines, big difference
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Tiny daily habits that compound into a calmer, sharper you over two years.
        </p>
      </div>

      {/* Habits are the pool where volume hurts most: 22 things to change at
          once reads as an indictment rather than a suggestion. */}
      <RotatingTechniques
        items={ROUTINES}
        seedKey="wellbeing-routines"
        todayLabel="Today's habit"
        accent={ACCENT}
      />
    </Page>
  );
}
