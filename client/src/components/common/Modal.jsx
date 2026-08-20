import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

// `blur` controls the backdrop treatment. It defaults to blurring the page
// behind the dialog, which suits modals that interrupt you — a confirm, a
// destructive action — where the point is that nothing else is readable.
//
// Pass blur={false} for a dialog you read *alongside* the page. Blurring a grid
// of stock cards while explaining one of them hides the very numbers the
// explanation refers to, and at full-page scale a 2px blur reads as the app
// having gone out of focus rather than as depth.
export default function Modal({ open, onClose, title, children, blur = true }) {
  const closeRef = useRef(null);

  // Callers almost always pass an inline `onClose`, so it is a fresh function
  // on every render. Depending on it directly re-ran this whole effect on each
  // keystroke inside the dialog: the autofocus timer fired again and yanked
  // focus to the X button mid-typing, and the re-run captured an already
  // 'hidden' body overflow as the value to "restore", leaving the page
  // scroll-locked after the dialog closed. Route it through a ref so the
  // effect depends only on `open`.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => closeRef.current?.focus(), 50);

    // Freeze the page behind the dialog. Without this a scroll gesture over the
    // backdrop scrolls the page instead of the dialog, so a tall modal drifts
    // off the top of the viewport with its content unreachable — you appear to
    // be scrolling the modal away rather than through it.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(t);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;
  return (
    // The scrim is decoration: it carries role="presentation", and the dialog
    // role belongs on the panel it frames. Dismiss-on-backdrop compares target
    // to currentTarget rather than stopping propagation on the panel, so the
    // panel needs no click handler of its own. Escape is bound above, which is
    // the keyboard equivalent this click has to have.
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${
        blur ? 'bg-black/40 backdrop-blur-[2px]' : 'bg-black/50'
      }`}
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Capped at the viewport with the body scrolling inside it, so content
          longer than the screen stays reachable and the header — the only way
          out besides Escape — never scrolls away. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-in flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl border border-gray-200 bg-white shadow-xl shadow-black/10 dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <h2 className="text-lg font-semibold" id="modal-title">{title}</h2>
          <button ref={closeRef} onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
