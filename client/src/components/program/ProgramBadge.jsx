import { useProgramContext } from '../../context/ProgramContext';
import { Sparkles } from 'lucide-react';

export function ProgramBadge({ size = 'sm', showIcon = true }) {
  const program = useProgramContext();

  if (!program.ready) return null;

  const sizes = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 rounded-full font-semibold border border-blue-300 dark:border-blue-700 ${sizes[size]}`}>
      {showIcon && program.isCustom && <Sparkles className="w-3 h-3" />}
      {program.label}
    </span>
  );
}
