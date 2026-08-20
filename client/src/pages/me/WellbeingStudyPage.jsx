import { Lightbulb } from 'lucide-react';
import { Page } from '../../components/common/motion';
import { STUDY_TECHNIQUES } from '../../utils/wellbeingContent';
import RotatingTechniques from '../../components/common/RotatingTechniques';

// The pool is 22 dense paragraphs. Printing all of them made the page a wall
// nobody read past the third item, which defeats the point of writing them
// carefully. RotatingTechniques handles the disclosure — see that file for why
// it steps through the list rather than re-rolling at random.
const ACCENT = {
  card: 'border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20',
  label: 'text-amber-600 dark:text-amber-400',
};

export default function WellbeingStudyPage() {
  return (
    <Page overview={{
      pageKey: 'wellbeing-study',
      title: 'How to study, not what',
      blurb: 'Evidence-backed technique — spaced repetition, active recall, and why rereading notes feels productive but is not.',
      takeaway: 'Swap one rereading session this week for self-testing and compare how much sticks.',
    }}>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Lightbulb className="h-5 w-5 text-amber-500" /> Study techniques that actually work
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Evidence-based methods used by top learners — not cramming.
        </p>
      </div>

      <RotatingTechniques
        items={STUDY_TECHNIQUES}
        seedKey="wellbeing-study"
        todayLabel="Today's technique"
        accent={ACCENT}
      />
    </Page>
  );
}
