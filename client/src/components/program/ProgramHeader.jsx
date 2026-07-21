import { useProgramContext } from '../../context/ProgramContext';

export function ProgramHeader() {
  const program = useProgramContext();

  if (!program.ready) return null;

  return (
    <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            Your Program
          </p>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {program.label}
            </h1>
          </div>
          {/* The label already carries the specialization for derived programs
              ("MBA (Finance)"), so only spell it out when it would add something. */}
          {program.specialization && !program.label?.includes(program.specialization) && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Specialization: <span className="font-semibold">{program.specialization}</span>
            </p>
          )}
          {program.institution && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {program.institution}
              {program.cohort && ` • Batch ${program.cohort}`}
            </p>
          )}
        </div>

        {program.isCustom && (
          <div className="px-4 py-2 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-700 rounded-lg">
            <p className="text-xs font-semibold text-purple-700 dark:text-purple-300">
              ✨ Custom Program
            </p>
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
              Fully personalized for you
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
