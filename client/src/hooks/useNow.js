import { useEffect, useState } from 'react';

/**
 * A snapshot of the current time, taken once when the component mounts.
 *
 * Calling Date.now() during render makes the render impure: two renders of the
 * same state produce different output, which React is free to discard or
 * double-invoke. Taking the reading once, as initial state, keeps render a pure
 * function of props and state.
 *
 * Behaviourally this matches the inline Date.now() calls it replaces — both
 * only advance when something else re-renders the component — except when
 * `intervalMs` is passed, which schedules its own updates. Use that only for
 * countdowns that have to visibly tick.
 */
export default function useNow(intervalMs = 0) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    if (!intervalMs) return undefined;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
