import { useEffect, useMemo, useReducer, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import DaxOrb from '../common/DaxOrb';

// Full-screen intro/outro curtain for the Dax page.
//
// mode: 'intro' — plays a staggered greeting, then calls onDone (reveal app).
// mode: 'outro' — plays a farewell, then calls onDone (navigate away).
// Click anywhere to skip. Honors prefers-reduced-motion with a quick fade.

const INTRO_HOLD_MS = 3000;
// Ignore skip-clicks right after mount — the click that navigated to the
// Dax page can otherwise land on the overlay and skip the intro instantly.
const SKIP_GRACE_MS = 500;
const OUTRO_HOLD_MS = 1900;
const REDUCED_HOLD_MS = 450;

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// Word-by-word staggered line.
function Line({ text, delay = 0, className = '' }) {
  const words = text.split(' ');
  return (
    <span className={`inline-flex flex-wrap justify-center gap-x-[0.3em] ${className}`}>
      {words.map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ delay: delay + i * 0.09, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          {w}
        </motion.span>
      ))}
    </span>
  );
}

export default function DaxTransition({ mode, userName, brandName = 'Dax', onDone }) {
  const reduceMotion = useReducedMotion();
  // Re-render key so re-entering intro after an outro restarts animations.
  const [, forceRender] = useReducer((n) => n + 1, 0);

  const firstName = userName?.split(' ')[0];

  const lines = useMemo(() => {
    if (mode === 'outro') {
      return {
        hi: firstName ? `Bye, ${firstName} 👋` : 'Bye 👋',
        main: 'See you soon',
        sub: `— ${brandName}`,
      };
    }
    return {
      hi: firstName ? `${timeGreeting()}, ${firstName} 👋` : 'Hi 👋',
      main: `Welcome to ${brandName}`,
      sub: 'Your assistant, ready when you are.',
    };
  }, [mode, firstName, brandName]);

  const shownAtRef = useRef(0);

  useEffect(() => {
    if (!mode) return undefined;
    forceRender();
    shownAtRef.current = Date.now();
    const hold = reduceMotion
      ? REDUCED_HOLD_MS
      : mode === 'outro' ? OUTRO_HOLD_MS : INTRO_HOLD_MS;
    const t = setTimeout(onDone, hold);
    return () => clearTimeout(t);
  }, [mode, onDone, reduceMotion]);

  function handleSkip() {
    if (Date.now() - shownAtRef.current < SKIP_GRACE_MS) return;
    onDone();
  }

  return (
    <AnimatePresence>
      {mode && (
        <motion.div
          key={mode}
          className="dax-root fixed inset-0 z-[80] flex cursor-pointer flex-col items-center justify-center gap-8 select-none"
          style={{ background: 'var(--dax-bg)' }}
          initial={{ opacity: mode === 'outro' ? 0 : 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, pointerEvents: 'none', transition: { duration: 0.45, ease: 'easeInOut' } }}
          transition={{ duration: 0.3 }}
          onClick={handleSkip}
          role="status"
          aria-live="polite"
          aria-label={`${lines.hi} ${lines.main} ${lines.sub}`}
        >
          {/* ambient background wash */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(ellipse 60% 45% at 50% 38%, rgb(var(--dax-accent-rgb) / 0.10) 0%, transparent 70%)' }}
          />

          {!reduceMotion && (
            <motion.div
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 180, damping: 18 }}
            >
              <DaxOrb waving={mode === 'outro'} layoutId="dax-orb" />
            </motion.div>
          )}

          <div className="flex flex-col items-center gap-2.5 px-6 text-center">
            <span style={{ color: 'var(--dax-text-muted)' }}>
              <Line text={lines.hi} delay={reduceMotion ? 0 : 0.15} className="text-lg font-medium" />
            </span>
            <Line
              text={lines.main}
              delay={reduceMotion ? 0 : 0.5}
              className="text-3xl font-semibold tracking-tight sm:text-4xl"
            />
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: reduceMotion ? 0 : 1.0, duration: 0.6 }}
              className="text-sm"
              style={{ color: 'var(--dax-text-muted)' }}
            >
              {lines.sub}
            </motion.span>
          </div>

          {mode === 'intro' && !reduceMotion && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              transition={{ delay: 1.8 }}
              className="absolute bottom-8 text-xs"
              style={{ color: 'var(--dax-text-faint)' }}
            >
              Click anywhere to skip
            </motion.span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
