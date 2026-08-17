import { X } from 'lucide-react';
import { CAPABILITY_CHIPS } from '../../constants';
import ModelSelector from './ModelSelector';

// Placeholder — inert content for now. Dark mode is inherited automatically
// via the host's document.documentElement.classList toggle, so no theme
// switch lives in here.
export default function SettingsPanel({ open, onClose, brandName }) {
  if (!open) return null;
  return (
    <div
      className="dax-root fixed inset-0 z-[100] flex justify-end bg-black/30"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${brandName} settings`}
        className="dax-scrollbar h-full w-full max-w-sm overflow-y-auto border-l border-[var(--dax-border)] bg-[var(--dax-bg)] p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--dax-text)]">{brandName} settings</h2>
          <button type="button" onClick={onClose} className="text-[var(--dax-text-muted)]">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <ModelSelector />

          <section>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--dax-text-faint)]">Memory</p>
            <p className="text-sm text-[var(--dax-text-muted)]">
              {brandName}&rsquo;s memory is currently shared across all of your chats — conversation history in this
              interface is organized locally, but the underlying memory isn&rsquo;t split per chat yet.
            </p>
          </section>

          <section>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--dax-text-faint)]">Coming soon</p>
            <div className="flex flex-wrap gap-1.5">
              {CAPABILITY_CHIPS.map((c) => (
                <span key={c.id} className="rounded-full border border-[var(--dax-border)] px-2 py-0.5 text-[11px] text-[var(--dax-text-muted)]">
                  {c.label}
                </span>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
