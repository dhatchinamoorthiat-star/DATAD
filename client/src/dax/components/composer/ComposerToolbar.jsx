import { Paperclip } from 'lucide-react';
import IconButton from '../common/IconButton';
import ModelIndicator from './ModelIndicator';

/**
 * The row under the composer input: attach, and pick the model.
 *
 * Two things used to be wrong here. Composer passed `models`/`selectedModelId`/
 * `onModelSelect`/`modelDisabled` and this component declared none of them, so
 * they were silently dropped and ModelIndicator — already written, styled and
 * keyboard-complete — was rendered by nothing. That is fixed by accepting them.
 *
 * The other was a row of twelve capability chips (Deep Research, Vision, Web
 * Search…). They toggled local state that nothing read and nothing sent, so
 * selecting one changed how the composer looked and nothing else. A chip that
 * highlights when clicked reads as enabled no matter what its tooltip says, so
 * they are gone from here. SettingsPanel still lists the same set under
 * "Coming soon", which states the roadmap without dressing it up as a control.
 */
export default function ComposerToolbar({
  onAttachClick, models = [], selectedModelId, onModelSelect, modelDisabled,
}) {
  return (
    <div className="dax-scrollbar flex items-center gap-1 overflow-x-auto pb-0.5">
      <IconButton icon={Paperclip} label="Attach files" onClick={onAttachClick} />
      <span className="mx-1 h-4 w-px shrink-0 bg-[var(--dax-border)]" />
      <ModelIndicator
        models={models}
        selectedId={selectedModelId}
        onSelect={onModelSelect}
        disabled={modelDisabled || !onModelSelect}
      />
      <span className="ml-auto" />
    </div>
  );
}
