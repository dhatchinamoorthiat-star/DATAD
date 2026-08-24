import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * "Has this document actually been put in front of them?"
 *
 * Returns a ref to attach to a scrollable element, an onScroll handler, and a
 * `read` flag that flips once the element has been scrolled to its end. Both
 * places that ask someone to accept the terms — signup and the re-consent gate
 * at login — use this, so the gate cannot drift into being stricter on one
 * screen than the other.
 *
 * It is honest about what it proves: that the text was presented and scrolled
 * through, not that it was read. That is the most any interface can establish,
 * and it is meaningfully more than a link nobody opens.
 */
export default function useReadGate() {
  const ref = useRef(null);
  const [read, setRead] = useState(false);

  // A few pixels of slack — sub-pixel layout and browser zoom mean scrollTop
  // rarely lands exactly on the bottom, and a gate that cannot be satisfied
  // locks people out of their own account.
  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el || read) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setRead(true);
  }, [read]);

  // On a tall viewport the panel may not overflow at all, so there is nothing
  // to scroll and nothing to wait for.
  useEffect(() => {
    const el = ref.current;
    if (el && el.scrollHeight <= el.clientHeight + 24) setRead(true);
  }, []);

  return { ref, onScroll, read };
}
