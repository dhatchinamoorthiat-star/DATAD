import { useEffect, useRef, useState } from 'react';

/**
 * Dax-scoped replacement for window.prompt() — single-field text input,
 * styled with the same --dax-* tokens as the rest of the sidebar rather than
 * the main app's Modal, so it doesn't look like a foreign dialog dropped in.
 */
export default function PromptModal({ open, title, label, initialValue = '', confirmLabel = 'Save', onCancel, onSubmit }) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(initialValue);
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const submit = () => {
    const trimmed = value.trim();
    if (trimmed) onSubmit(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/30 p-4"
      role="presentation"
      // Rendered inside callers like ConversationListItem's clickable row —
      // stop propagation unconditionally so a click anywhere in the dialog
      // (including the backdrop) never also fires the row's own onClick.
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-sm rounded-2xl border border-[var(--dax-border)] bg-[var(--dax-bg)] p-4 shadow-[var(--dax-shadow-lift)]"
      >
        <p className="mb-2.5 text-sm font-semibold text-[var(--dax-text)]">{title}</p>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          aria-label={label}
          className="w-full rounded-lg border border-[var(--dax-border)] bg-[var(--dax-surface)] px-3 py-2 text-sm text-[var(--dax-text)] focus:border-[var(--dax-accent)] focus:outline-none"
        />
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--dax-text-muted)] hover:bg-[var(--dax-surface-hover)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            className="rounded-lg bg-[var(--dax-accent)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
