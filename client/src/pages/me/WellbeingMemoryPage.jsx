import { Brain } from 'lucide-react';
import { Page } from '../../components/common/motion';
import { MEMORY_TECHNIQUES } from '../../utils/wellbeingContent';
import RotatingTechniques from '../../components/common/RotatingTechniques';

const ACCENT = {
  card: 'border-violet-200 bg-violet-50/60 dark:border-violet-900/50 dark:bg-violet-950/20',
  label: 'text-violet-600 dark:text-violet-400',
};

export default function WellbeingMemoryPage() {
  return (
    <Page overview={{
      pageKey: 'wellbeing-memory',
      title: 'Making things stick',
      blurb: 'Memory techniques — chunking, mnemonics, memory palaces — aimed at material you have to recall under exam pressure.',
      takeaway: 'Pick one technique and apply it to your hardest subject rather than sampling all of them.',
    }}>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Brain className="h-5 w-5 text-violet-500" /> Memory techniques
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Practical ways to make information stick for exams, cases, and presentations.
        </p>
      </div>

      {/* The page's own takeaway says to pick one technique rather than sample
          all of them — showing 20 at once argued against that advice. */}
      <RotatingTechniques
        items={MEMORY_TECHNIQUES}
        seedKey="wellbeing-memory"
        todayLabel="Today's technique"
        accent={ACCENT}
      />
    </Page>
  );
}
