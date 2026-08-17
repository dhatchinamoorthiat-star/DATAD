import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, title, children }) {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => closeRef.current?.focus(), 50);
    return () => { document.removeEventListener('keydown', onKey); clearTimeout(t); };
  }, [open, onClose]);

  if (!open) return null;
  return (
    // The scrim is decoration: it carries role="presentation", and the dialog
    // role belongs on the panel it frames. Dismiss-on-backdrop compares target
    // to currentTarget rather than stopping propagation on the panel, so the
    // panel needs no click handler of its own. Escape is bound above, which is
    // the keyboard equivalent this click has to have.
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-in w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl shadow-black/10 dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button ref={closeRef} onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
