import { useState, useRef } from 'react';
import { MessageSquare, Pin, MoreHorizontal, Pencil, Trash2, PinOff } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { useClickOutside } from '../../hooks/useClickOutside';
import PromptModal from '../common/PromptModal';

export default function ConversationListItem({ conversation, active, onSelect, onPin, onDelete, onRename }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const menuRef = useRef(null);
  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen);

  return (
    <div
      className={`
        group relative flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm cursor-pointer
        ${active ? 'bg-[var(--dax-accent-soft)] text-[var(--dax-accent)]' : 'text-[var(--dax-text)] hover:bg-[var(--dax-surface-hover)]'}
      `}
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(conversation.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect?.(conversation.id);
        }
      }}
    >
      <MessageSquare size={14} className="shrink-0 opacity-70 mt-0.5 self-start" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{conversation.title || 'New chat'}</p>
        {conversation.preview && (
          <p className="truncate text-[11px] text-[var(--dax-text-muted)] leading-tight mt-0.5">{conversation.preview}</p>
        )}
      </div>
      {conversation.pinned && <Pin size={11} className="shrink-0 opacity-60" />}
      <span className="shrink-0 text-[10px] text-[var(--dax-text-muted)] group-hover:hidden">
        {formatDistanceToNowStrict(conversation.updatedAt, { addSuffix: false })}
      </span>
      <div ref={menuRef} className="relative hidden shrink-0 group-hover:block">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
          aria-label="Conversation options"
          className="flex h-6 w-6 items-center justify-center rounded-md hover:bg-[var(--dax-surface)]"
        >
          <MoreHorizontal size={14} />
        </button>
        {menuOpen && (
          <div
            className="
              absolute right-0 top-7 z-20 w-36 overflow-hidden rounded-xl border
              border-[var(--dax-border)] bg-[var(--dax-bg)] py-1 text-xs shadow-[var(--dax-shadow-lift)]
            "
            role="presentation"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--dax-surface-hover)]"
              onClick={() => { onPin?.(conversation.id); setMenuOpen(false); }}
            >
              {conversation.pinned ? <PinOff size={12} /> : <Pin size={12} />}
              {conversation.pinned ? 'Unpin' : 'Pin'}
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-[var(--dax-surface-hover)]"
              onClick={() => { setRenaming(true); setMenuOpen(false); }}
            >
              <Pencil size={12} /> Rename
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[var(--dax-danger)] hover:bg-[var(--dax-danger-soft)]"
              onClick={() => { onDelete?.(conversation.id); setMenuOpen(false); }}
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>
        )}
      </div>

      <PromptModal
        open={renaming}
        title="Rename chat"
        label="Chat title"
        initialValue={conversation.title || 'New chat'}
        confirmLabel="Save"
        onCancel={() => setRenaming(false)}
        onSubmit={(next) => { onRename?.(conversation.id, next); setRenaming(false); }}
      />
    </div>
  );
}
