import { Paperclip } from 'lucide-react';
import IconButton from '../common/IconButton';
import Tooltip from '../common/Tooltip';
import { CAPABILITY_CHIPS } from '../../constants';

export default function ComposerToolbar({
  onAttachClick, activeCapability, onToggleCapability,
  models = [], selectedModelId, onModelSelect, modelDisabled,
}) {
  return (
    <div className="dax-scrollbar flex items-center gap-1 overflow-x-auto pb-0.5">
      <IconButton icon={Paperclip} label="Attach files" onClick={onAttachClick} />
      <span className="mx-1 h-4 w-px shrink-0 bg-[var(--dax-border)]" />
      {CAPABILITY_CHIPS.map((cap) => (
        <Tooltip key={cap.id} label={activeCapability === cap.id ? cap.label : `${cap.label} — coming soon`}>
          <button
            type="button"
            onClick={() => onToggleCapability?.(cap.id)}
            className={`
              shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors
              ${activeCapability === cap.id
                ? 'border-[var(--dax-accent)] bg-[var(--dax-accent-soft)] text-[var(--dax-accent)]'
                : 'border-[var(--dax-border)] text-[var(--dax-text-muted)] hover:bg-[var(--dax-surface-hover)]'}
            `}
          >
            {cap.label}
          </button>
        </Tooltip>
      ))}
      <span className="ml-auto" />
    </div>
  );
}
