import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, MessageSquare, X } from 'lucide-react';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';

export default function SearchPalette({ open, onClose, conversations, searchConversations, onSelect }) {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef(null);

  const results = useMemo(
    () => (searchConversations ? searchConversations(query) : conversations),
    [query, conversations, searchConversations]
  );

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
  }, [open]);

  // Adjusting state during render rather than in an effect — see CommandPalette.
  const [lastReset, setLastReset] = useState({ open, query });
  if (lastReset.open !== open || lastReset.query !== query) {
    setLastReset({ open, query });
    setSelectedIdx(0);
    if (lastReset.open !== open) setQuery('');
  }

  useKeyboardShortcuts(
    {
      escape: () => open && onClose?.(),
    },
    [open, onClose]
  );

  if (!open) return null;

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIdx]) {
      onSelect?.(results[selectedIdx].id);
    }
  }

  return (
    <div
      className="dax-root fixed inset-0 z-[100] flex items-start justify-center bg-black/30 pt-[15vh]"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search conversations"
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--dax-border)] bg-[var(--dax-bg)] shadow-[var(--dax-shadow-lift)]"
      >
        <div className="flex items-center gap-2 border-b border-[var(--dax-border)] px-3 py-2.5">
          <Search size={15} className="text-[var(--dax-text-muted)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search conversations…"
            className="flex-1 bg-transparent text-sm text-[var(--dax-text)] placeholder:text-[var(--dax-text-faint)] focus:outline-none"
          />
          <button type="button" onClick={onClose} className="text-[var(--dax-text-muted)]">
            <X size={15} />
          </button>
        </div>
        <div className="dax-scrollbar max-h-80 overflow-y-auto p-1.5">
          {results.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-[var(--dax-text-faint)]">No conversations found</p>
          )}
          {results.map((c, i) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect?.(c.id)}
              className={`
                flex w-full items-start gap-2 rounded-xl px-2.5 py-2 text-left text-sm
                ${i === selectedIdx ? 'bg-[var(--dax-accent-soft)] text-[var(--dax-accent)]' : 'text-[var(--dax-text)] hover:bg-[var(--dax-surface-hover)]'}
              `}
            >
              <MessageSquare size={14} className="mt-0.5 shrink-0 opacity-70" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{c.title || 'New chat'}</span>
                {c.preview && <span className="block truncate text-xs opacity-70">{c.preview}</span>}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
