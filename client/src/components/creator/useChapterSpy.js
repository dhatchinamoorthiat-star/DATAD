import { useEffect, useState } from 'react';

// Which chapter is the reader actually in.
//
// One observer for every section rather than one per section: the rail needs a
// single answer, not six independent booleans that can all be true at once on a
// tall screen. The root margin collapses the viewport to a band around the
// midline, so a chapter becomes "active" when it crosses the middle of the
// screen — the same place a reader's eye is — instead of the moment its top
// edge appears.
//
// Returns the index of the active chapter, or 0 before anything has crossed.
export default function useChapterSpy(ids) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;

    const nodes = ids
      .map((id, index) => ({ index, el: document.getElementById(id) }))
      .filter((entry) => entry.el);
    if (!nodes.length) return undefined;

    // Visibility ratios are kept outside the callback because the observer
    // only reports the entries that *changed*; picking a winner needs the
    // current state of all of them.
    const seen = new Map();

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const match = nodes.find((n) => n.el === entry.target);
          if (match) seen.set(match.index, entry.isIntersecting);
        });
        const visible = [...seen.entries()].filter(([, isIn]) => isIn).map(([i]) => i);
        if (visible.length) setActive(Math.min(...visible));
      },
      { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
    );

    nodes.forEach(({ el }) => obs.observe(el));
    return () => obs.disconnect();
  }, [ids]);

  return active;
}
