import { motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';

// The 01–04 rail above the form.
//
// It exists to reframe what is happening: the same seven screens read as "a
// long signup form" when they are numbered 1..7, and as "setting up my
// intelligence profile" when they are grouped into Account → Profile →
// Intelligence Setup → Dashboard. Same work, and the student can see that the
// account itself is one quarter of it, not the whole climb.
//
// The fourth phase is the dashboard — a phase nobody completes *during* signup.
// Showing it greyed is the point: the rail ends somewhere that isn't more form.
//
// `progress` is fractional (0..1) inside the active phase, so the connector
// fills continuously across the multi-screen phases instead of jumping only
// when a phase boundary is crossed.
export default function PhaseRail({ phases, activePhase, progress = 0, className = '' }) {
  const reduce = useReducedMotion();
  const pct = ((activePhase + progress) / (phases.length - 1)) * 100;

  return (
    <nav aria-label="Registration progress" className={className}>
      <ol className="relative flex items-start justify-between">
        {/* Track. Inset by half a marker on each side so it runs between the
            first and last centres rather than out past them. */}
        <div
          className="absolute left-0 right-0 top-[13px] h-px bg-gray-200 dark:bg-gray-800"
          style={{ marginLeft: '13px', marginRight: '13px' }}
          aria-hidden="true"
        />
        <div
          className="absolute top-[13px] h-px overflow-hidden"
          style={{ left: '13px', right: '13px' }}
          aria-hidden="true"
        >
          <motion.div
            className="h-full bg-primary-500 dark:bg-primary-400"
            initial={false}
            animate={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
            transition={reduce ? { duration: 0 } : { duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>

        {phases.map((phase, i) => {
          const done = i < activePhase;
          const active = i === activePhase;
          return (
            <li
              key={phase.label}
              className="relative z-10 flex min-w-0 flex-col items-center gap-1.5"
              style={{ flex: '1 1 0' }}
              aria-current={active ? 'step' : undefined}
            >
              <span
                className={`flex h-[26px] w-[26px] items-center justify-center rounded-full border text-[10px] font-semibold tabular-nums transition-colors duration-300 ${
                  done
                    ? 'border-primary-500 bg-primary-500 text-white dark:border-primary-400 dark:bg-primary-400 dark:text-gray-950'
                    : active
                      ? 'border-primary-500 bg-white text-primary-600 ring-4 ring-primary-500/15 dark:border-primary-400 dark:bg-gray-950 dark:text-primary-300'
                      : 'border-gray-200 bg-white text-gray-400 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-600'
                }`}
              >
                {done ? <Check className="h-3 w-3" aria-hidden="true" /> : phase.number}
              </span>
              <span
                className={`text-center text-[10.5px] font-medium leading-tight transition-colors duration-300 ${
                  active
                    ? 'text-gray-900 dark:text-gray-100'
                    : done
                      ? 'text-gray-500 dark:text-gray-400'
                      : 'text-gray-400 dark:text-gray-600'
                }`}
              >
                {phase.label}
                {/* Screen readers get the state that colour alone carries. */}
                {done && <span className="sr-only"> (completed)</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
