import Avatar from '../common/Avatar';
import MessageContent from './MessageContent';
import MessageToolbar from './MessageToolbar';
import Citation from './Citation';
import ProposalCard from './ProposalCard';

export default function AssistantMessage({
  message, branchIndex, branchCount,
  onCopy, onRegenerate, onContinue, onShare, onExport, onBranchPrev, onBranchNext,
}) {
  const isStreaming = message.status === 'streaming';
  const isError = message.status === 'error';

  return (
    <div className="group flex gap-3 px-1 py-3">
      <Avatar speaker="assistant" />
      <div className="min-w-0 flex-1">
        {isError ? (
          <p className="rounded-xl border border-[var(--dax-danger)]/30 bg-[var(--dax-danger-soft)] px-3 py-2 text-sm text-[var(--dax-danger)]">
            {message.error || 'Something went wrong. Please try again.'}
          </p>
        ) : (
          <MessageContent content={message.content} isStreaming={isStreaming} />
        )}
        {message.proposals?.length > 0 && (
          <div className="mt-1">
            {message.proposals.map((p) => (
              <ProposalCard key={p._id} proposal={p} />
            ))}
          </div>
        )}
        {message.citations?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.citations.map((c, i) => (
              <Citation key={c.id} citation={c} index={i + 1} />
            ))}
          </div>
        )}
        {!isStreaming && (
          <div className="mt-1.5 opacity-0 transition-opacity group-hover:opacity-100">
            <MessageToolbar
              onCopy={!isError ? () => onCopy?.(message.content) : undefined}
              onRegenerate={onRegenerate}
              onContinue={!isError ? onContinue : undefined}
              onShare={!isError ? onShare : undefined}
              onExport={!isError ? onExport : undefined}
              onBranchPrev={onBranchPrev}
              onBranchNext={onBranchNext}
              branchIndex={branchIndex}
              branchCount={branchCount}
            />
          </div>
        )}
      </div>
    </div>
  );
}
