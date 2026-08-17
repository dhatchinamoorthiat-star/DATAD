import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { ChevronDown, Sparkles, Check } from 'lucide-react';

const GROUP_ORDER = ['NVIDIA NIM', 'Groq', 'OpenAI', 'Anthropic', 'Gemini', 'OpenRouter', 'Ollama (Local)'];

function groupModels(models) {
  const grouped = {};
  for (const m of models) {
    const g = m.group || 'Other';
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(m);
  }
  const sorted = {};
  for (const g of GROUP_ORDER) {
    if (grouped[g]) sorted[g] = grouped[g];
  }
  for (const g of Object.keys(grouped).sort()) {
    if (!sorted[g]) sorted[g] = grouped[g];
  }
  return sorted;
}

const MENU_MAX_H = 320; // matches max-h-80

export default function ModelIndicator({ models = [], selectedId, onSelect, disabled }) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(true);
  const btnRef = useRef(null);

  // Only the *direction* needs measuring — horizontal alignment comes from
  // the `relative` wrapper, so it can never drift. Recomputed while open so
  // a resize/scroll can't leave the menu clipped off-screen.
  useLayoutEffect(() => {
    if (!open) return undefined;
    const decide = () => {
      const rect = btnRef.current?.getBoundingClientRect();
      if (!rect) return;
      // innerHeight can report 0 in some embedded/headless contexts, which
      // would make every measurement look like "no room below".
      const viewportH = window.innerHeight || document.documentElement.clientHeight || 0;
      if (!viewportH) return;
      const spaceBelow = viewportH - rect.bottom;
      const spaceAbove = rect.top;
      // Prefer opening downward; flip up only when below can't fit and
      // above genuinely has more room.
      setDropUp(spaceBelow < MENU_MAX_H && spaceAbove > spaceBelow);
    };
    decide();
    window.addEventListener('resize', decide);
    window.addEventListener('scroll', decide, true);
    return () => {
      window.removeEventListener('resize', decide);
      window.removeEventListener('scroll', decide, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (btnRef.current && !btnRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const selected = models.find((m) => m.id === selectedId);
  const grouped = groupModels(models);

  const handleSelect = useCallback((id) => {
    onSelect(id);
    setOpen(false);
  }, [onSelect]);

  const handleToggle = useCallback(() => {
    if (disabled) return;
    setOpen((o) => !o);
  }, [disabled]);

  return (
    <div className="relative inline-flex">
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={`
          inline-flex cursor-pointer items-center gap-1 rounded-full border
          border-[var(--dax-border)] bg-[var(--dax-surface)] px-2.5 py-1
          text-xs font-medium text-[var(--dax-text)] transition-colors
          ${disabled ? '' : 'hover:bg-[var(--dax-surface-hover)]'}
        `}
      >
        <Sparkles size={12} className="text-[var(--dax-accent)]" />
        {selected ? selected.label : 'Dax'}
        <ChevronDown size={12} className="opacity-50" />
      </button>

      {open && (
        <>
          {/* Click-away catcher for the menu — presentational, not a control. */}
          <div
            className="fixed inset-0 z-40"
            role="presentation"
            onClick={() => setOpen(false)}
          />
          {/* Anchored to the trigger via the `relative` wrapper rather than
              measured fixed coordinates — the composer reflows (AI panel,
              sidebar, resize, scroll) and stale measurements sent this menu
              off-screen. Direction flips based on available space. */}
          <div
            className={`absolute left-0 z-50 max-h-80 w-64 overflow-y-auto rounded-xl border border-[var(--dax-border)] bg-[var(--dax-bg)] p-1 shadow-xl ${dropUp ? 'bottom-full mb-2' : 'top-full mt-2'}`}
          >
            {Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--dax-text-muted)]">
                  {group}
                </div>
                {items.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSelect(m.id)}
                    className={`
                      flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs
                      transition-colors
                      ${m.id === selectedId
                        ? 'bg-[var(--dax-accent-soft)] text-[var(--dax-accent)]'
                        : 'text-[var(--dax-text)] hover:bg-[var(--dax-surface-hover)]'}
                    `}
                  >
                    <span className={`shrink-0 ${m.id === selectedId ? 'opacity-100' : 'opacity-0'}`}>
                      <Check size={12} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{m.label}</div>
                      {m.description && (
                        <div className="truncate text-[10px] text-[var(--dax-text-muted)]">{m.description}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ))}
            {models.length === 0 && (
              <div className="px-2 py-3 text-center text-xs text-[var(--dax-text-muted)]">
                No models available
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
