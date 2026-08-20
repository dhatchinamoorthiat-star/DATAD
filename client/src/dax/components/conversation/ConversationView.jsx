import DaxHome from '../home/DaxHome';
import MessageList from './MessageList';

export default function ConversationView({
  messages, userName, phase, onPickSuggestion,
  // Still accepted so they never leak into ...messageHandlers below; DaxHome
  // reads them from config now.
  greeting: _greeting, subtitle: _subtitle, suggestions: _suggestions,
  conversations, activeId, onOpenConversation, onNewChat, introActive,
  models, selectedModelId, onModelSelect, maintenance = false,
  ...messageHandlers
}) {
  // No active workspace — show the home dashboard
  if (!activeId || !messages) {
    return (
      <DaxHome
        userName={userName}
        conversations={conversations || []}
        onOpenConversation={onOpenConversation}
        onNewChat={onNewChat}
        onPickSuggestion={onPickSuggestion}
        introActive={introActive}
        models={models}
        selectedModelId={selectedModelId}
        onModelSelect={onModelSelect}
        maintenance={maintenance}
      />
    );
  }

  // Active workspace — show message stream
  return (
    <MessageList
      messages={messages}
      userName={userName}
      phase={phase}
      {...messageHandlers}
    />
  );
}
