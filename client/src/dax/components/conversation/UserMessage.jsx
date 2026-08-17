import { useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import Avatar from '../common/Avatar';
import AttachmentChip from '../composer/AttachmentChip';
import { Check, X } from 'lucide-react';

export default function UserMessage({ message, userName, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

  function submitEdit() {
    if (draft.trim() && draft.trim() !== message.content) onEdit?.(draft.trim());
    setEditing(false);
  }

  return (
    <div className="group flex justify-end gap-3 px-1 py-2">
      <div className="flex max-w-[75%] flex-col items-end gap-1.5">
        {message.attachments?.length > 0 && (
          <div className="flex flex-wrap justify-end gap-1.5">
            {message.attachments.map((a) => (
              <AttachmentChip key={a.id} attachment={a} />
            ))}
          </div>
        )}
        {editing ? (
          <div className="w-full min-w-[16rem] rounded-2xl border border-[var(--dax-accent)] bg-[var(--dax-bg)] p-2">
            <textarea
              // The textarea exists only because the user clicked Edit; focusing
              // what they just asked to edit is the expected behaviour.
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              className="w-full resize-none bg-transparent text-sm text-[var(--dax-text)] focus:outline-none"
            />
            <div className="mt-1 flex justify-end gap-1">
              <button type="button" onClick={() => setEditing(false)} className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-[var(--dax-surface-hover)]">
                <X size={13} />
              </button>
              <button type="button" onClick={submitEdit} className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--dax-accent)] text-[var(--dax-accent-contrast)]">
                <Check size={13} />
              </button>
            </div>
          </div>
        ) : (
          <div
            className="
              rounded-2xl rounded-tr-sm bg-[var(--dax-surface)] px-4 py-2.5 text-[15px]
              leading-relaxed text-[var(--dax-text)] cursor-text
            "
            onDoubleClick={() => onEdit && setEditing(true)}
          >
            {message.content}
          </div>
        )}
        <span className="hidden text-[11px] text-[var(--dax-text-faint)] group-hover:block">
          {formatDistanceToNowStrict(message.createdAt, { addSuffix: true })}
          {onEdit && !editing && (
            <button type="button" className="ml-2 underline decoration-dotted" onClick={() => setEditing(true)}>
              edit
            </button>
          )}
        </span>
      </div>
      <Avatar speaker="user" name={userName} />
    </div>
  );
}
