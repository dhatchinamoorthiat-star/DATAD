import { useRef } from 'react';
import { useAutosizeTextarea } from '../../hooks/useAutosizeTextarea';
import ComposerToolbar from './ComposerToolbar';
import AttachmentChip from './AttachmentChip';
import AttachmentDropzone from './AttachmentDropzone';
import VoiceInputButton from './VoiceInputButton';
import SendStopButton from './SendStopButton';
import { MAX_MESSAGE_LENGTH } from '../../constants';

export default function Composer({
  value,
  onChange,
  onSend,
  onStop,
  isBusy,
  attachments = [],
  onAttachFiles,
  onRemoveAttachment,
  placeholder = 'Message Dax…',
  models = [],
  selectedModelId,
  onModelSelect,
  modelDisabled,
}) {
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  useAutosizeTextarea(textareaRef, value);

  const trimmed = value.trim();
  const canSend = !isBusy && (trimmed.length > 0 || attachments.length > 0) && trimmed.length <= MAX_MESSAGE_LENGTH;

  function handleSend() {
    if (!canSend) return;
    onSend?.();
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <AttachmentDropzone onFiles={onAttachFiles}>
      <div
        className="
          flex flex-col gap-2 rounded-3xl border border-[var(--dax-border)]
          bg-[var(--dax-bg)] p-3 shadow-[var(--dax-shadow-lift)]
          transition-shadow focus-within:shadow-[0_0_0_2px_var(--dax-accent-soft)]
        "
      >
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-1">
            {attachments.map((a) => (
              <AttachmentChip key={a.id} attachment={a} onRemove={onRemoveAttachment} />
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={MAX_MESSAGE_LENGTH}
          className="
            max-h-60 min-h-[24px] w-full resize-none bg-transparent px-1 py-1
            text-[15px] leading-relaxed text-[var(--dax-text)] placeholder:text-[var(--dax-text-faint)]
            focus:outline-none
          "
        />

        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <ComposerToolbar
              onAttachClick={() => fileInputRef.current?.click()}
              models={models}
              selectedModelId={selectedModelId}
              onModelSelect={onModelSelect}
              modelDisabled={modelDisabled}
            />
          </div>
          <VoiceInputButton />
          <SendStopButton isBusy={isBusy} canSend={canSend} onSend={handleSend} onStop={onStop} />
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (files.length) onAttachFiles?.(files);
            e.target.value = '';
          }}
        />
      </div>
    </AttachmentDropzone>
  );
}
