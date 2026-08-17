import { Sparkles } from 'lucide-react';

// Prop is `speaker`, not `role`: `role` is a reserved DOM attribute name and
// reads as an (invalid) ARIA role to both linters and anyone skimming the JSX.
export default function Avatar({ speaker, name }) {
  if (speaker === 'assistant') {
    return (
      <span
        className="
          flex h-7 w-7 shrink-0 items-center justify-center rounded-full
          bg-[var(--dax-accent-soft)] text-[var(--dax-accent)]
        "
      >
        <Sparkles size={14} strokeWidth={2} />
      </span>
    );
  }
  const initial = (name || 'U').trim().charAt(0).toUpperCase();
  return (
    <span
      className="
        flex h-7 w-7 shrink-0 items-center justify-center rounded-full
        bg-[var(--dax-surface)] text-[var(--dax-text-muted)] text-xs font-semibold
        border border-[var(--dax-border)]
      "
    >
      {initial}
    </span>
  );
}
