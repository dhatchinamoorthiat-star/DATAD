import { useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { IDENTITY, CREATOR } from './creatorTokens';

// An address you can either open or take with you.
//
// A `mailto:` link is the wrong default on a page most people read on a laptop
// with no mail client configured — clicking it opens nothing, or worse, opens
// something they have never used. So the address is a pair: the label opens the
// link for anyone who wants that, and the button beside it puts the string on
// the clipboard for everyone else.
//
// Three states, all of them real:
//   idle    the copy glyph
//   copied  a tick, for two seconds, plus an aria-live announcement
//   failed  clipboard denied (insecure context, permission, older Safari) —
//           the row selects its own text instead and says so, which is a
//           recovery the reader can finish by hand rather than a dead end.
export default function CopyChip({ label, value, href, icon: Icon }) {
  const [state, setState] = useState('idle');
  const valueRef = useRef(null);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const flash = (next) => {
    setState(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), next === 'failed' ? 4000 : 2000);
  };

  const copy = async () => {
    try {
      // `navigator.clipboard` is undefined outside a secure context, so the
      // optional call is load-bearing rather than defensive noise.
      await navigator.clipboard?.writeText(value);
      if (!navigator.clipboard) throw new Error('no clipboard');
      flash('copied');
    } catch {
      const node = valueRef.current;
      if (node && window.getSelection) {
        const range = document.createRange();
        range.selectNodeContents(node);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
      flash('failed');
    }
  };

  return (
    <div
      className="group flex items-center justify-between gap-3 border-b py-3 transition-colors duration-200"
      style={{ borderColor: IDENTITY.inkLine }}
    >
      <a
        href={href}
        target={href.startsWith('http') ? '_blank' : undefined}
        rel={href.startsWith('http') ? 'noreferrer' : undefined}
        className="creator-focus flex min-w-0 items-center gap-3"
      >
        <Icon
          className="h-4 w-4 shrink-0 transition-colors duration-200"
          style={{ color: IDENTITY.muted }}
          aria-hidden="true"
        />
        <span className="min-w-0">
          <span
            className="block text-[10.5px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: IDENTITY.muted }}
          >
            {label}
          </span>
          <span
            ref={valueRef}
            className="block truncate text-[13.5px] transition-colors duration-200 group-hover:underline"
            style={{ color: IDENTITY.paper, textUnderlineOffset: '3px' }}
          >
            {value}
          </span>
          {/* The failure hint sits in the row's own flow rather than floating
              over the next one. It is transient (4s) and one line tall, which
              is a smaller cost than a tooltip that can be scrolled away from
              the button that produced it. */}
          {state === 'failed' && (
            <span className="block pt-0.5 text-[11px]" style={{ color: CREATOR.ember }} aria-hidden="true">
              Selected — press ⌘C to copy
            </span>
          )}
        </span>
        <ExternalLink
          className="h-3 w-3 shrink-0 opacity-0 transition-opacity duration-200 group-hover:opacity-60"
          style={{ color: IDENTITY.blueSoft }}
          aria-hidden="true"
        />
      </a>

      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label.toLowerCase()}`}
        className="creator-focus flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors duration-200"
        style={{
          borderColor: state === 'copied' ? IDENTITY.blue : IDENTITY.inkLine,
          color: state === 'copied' ? IDENTITY.blueSoft : IDENTITY.muted,
          background: state === 'copied' ? 'rgba(77,124,255,0.12)' : 'transparent',
        }}
      >
        {state === 'copied'
          ? <Check className="h-3.5 w-3.5" aria-hidden="true" />
          : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
      </button>

      {/* One live region per row, so a screen reader hears the outcome of the
          button it just pressed rather than a page-level announcement that
          could belong to any of them. */}
      <span role="status" aria-live="polite" className="sr-only">
        {state === 'copied' && `${label} copied to clipboard`}
        {state === 'failed' && `Couldn't copy automatically. ${label} is selected — press Control or Command C.`}
      </span>
    </div>
  );
}
