import { useEffect, useRef, useState } from 'react';

// Scroll-entrance primitive for the creator page.
//
// Deliberately not the `IntersectionReveal` this page used to carry, and not
// the near-identical copy on the About page. Both of those start the element at
// `opacity-0` and only ever un-hide it from an IntersectionObserver callback,
// which means the page has exactly one way to render its content and it depends
// on an API. No observer — an old browser, a polyfill that failed to load, a
// test renderer, a print stylesheet — and the entire page is blank forever.
//
// So the fallbacks come first here: no IntersectionObserver, or a reader who
// asked for reduced motion, and the content is simply visible on mount. The
// animation is the enhancement, never the gate.
//
// The transition itself lives in index.css (`.creator-reveal`) rather than in
// Framer, for the reason the register screen gives: a JS animation loop is
// throttled in a background tab, and anything that decides whether words are
// on screen must run on the document timeline instead.
export default function Reveal({
  as: Tag = 'div',
  delay = 0,
  className = '',
  style,
  children,
  ...rest
}) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;

    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShown(true);
      return;
    }

    const obs = new IntersectionObserver(
      ([entry]) => {
        // `isIntersecting` alone is not enough. A jump — a restored scroll
        // position, an in-page anchor, a fast flick on a trackpad — can move an
        // element from below the fold to above it between two observer frames,
        // and it then sits at opacity 0 forever in a place the reader will only
        // find by scrolling back up. Anything already past the top is revealed
        // on sight.
        const passed = entry.boundingClientRect.bottom <= 0;
        if (!entry.isIntersecting && !passed) return;
        setShown(true);
        obs.disconnect();
      },
      // A shallow threshold with a small bottom inset: the element starts
      // moving as it clears the fold, not once it is already half-read.
      { threshold: 0.1, rootMargin: '0px 0px -6% 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [shown]);

  return (
    <Tag
      ref={ref}
      data-revealed={shown ? 'true' : 'false'}
      className={`creator-reveal ${className}`}
      style={{ '--reveal-delay': `${delay}ms`, ...style }}
      {...rest}
    >
      {children}
    </Tag>
  );
}
