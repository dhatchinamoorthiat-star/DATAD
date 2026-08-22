import { useFormContext } from 'react-hook-form';
import { motion } from 'framer-motion';
import { GraduationCap, Zap, Briefcase } from 'lucide-react';

function Row({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-900/30">
        <Icon className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
        <p className="text-sm text-gray-800 dark:text-gray-200">{value}</p>
      </div>
    </div>
  );
}

function Chips({ items }) {
  if (!items?.length) return <p className="text-sm text-gray-400">None selected</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item} className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
          {item}
        </span>
      ))}
    </div>
  );
}

export default function SummaryStep() {
  const { getValues } = useFormContext();
  const d = getValues();

  const academic = [d.course, d.specialization].filter(Boolean).join(' · ');
  const institution = [d.college, d.graduationYear ? `Graduating ${d.graduationYear}` : ''].filter(Boolean).join(' · ');
  const experience = d.studentType === 'experienced'
    ? `Work experience${d.workExYears ? ` · ${d.workExYears} yrs` : ''}${d.priorDomain ? ` · ${d.priorDomain}` : ''}`
    : 'Fresher';
  const learning = [d.learningStyle, d.timeAvailable].filter(Boolean).join(' · ');

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Your intelligence profile</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          This is what DATAD will build around. Everything here stays editable.
        </p>
      </div>

      <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-5 dark:border-indigo-900/40 dark:bg-indigo-950/30">
        {/* Name badge */}
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-600 text-lg font-bold text-white shadow-md shadow-indigo-500/25">
            {d.name?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <p className="font-bold text-gray-900 dark:text-white">{d.name || 'Your name'}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{d.email}</p>
          </div>
        </div>

        <div className="space-y-3">
          <Row icon={GraduationCap} label="Programme" value={academic || institution ? `${academic}${institution ? ` — ${institution}` : ''}` : undefined} />
          <Row icon={Briefcase} label="Background" value={experience} />
          <Row icon={Zap} label="Learning" value={learning} />
        </div>
      </div>

      {/* Career interests */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Career interests</p>
        <Chips items={d.careerInterests} />
      </div>

      {/* Skills */}
      {d.skills?.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Skills</p>
          <Chips items={d.skills} />
        </div>
      )}

      {/* Goals */}
      {d.goals?.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Goals</p>
          <Chips items={d.goals} />
        </div>
      )}

      <p className="text-xs text-gray-400">
        You can update any of this in your profile settings after joining.
      </p>
    </motion.div>
  );
}
