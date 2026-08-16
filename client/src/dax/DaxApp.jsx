import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import DaxShell from './components/layout/DaxShell';
import DaxTransition from './components/experience/DaxTransition';
import ConversationView from './components/conversation/ConversationView';
import AIPresencePanel from './components/ai-presence/AIPresencePanel';
import Composer from './components/composer/Composer';
import SearchPalette from './components/search/SearchPalette';
import SettingsPanel from './components/settings/SettingsPanel';
import { useDaxConversations } from './hooks/useDaxConversations';
import { useDaxChat } from './hooks/useDaxChat';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { storage } from './lib/storage';
import { generateId } from './lib/id';
import { migrateLocalConversationsToServer } from './lib/migrateToServer';
import { TEXT_LIKE_EXTENSIONS, TEXT_ATTACHMENT_MAX_BYTES } from './constants';
import toast from '../utils/toast';
import {
  getAvailableModels, getModelPreference, setModelPreference,
  deleteConversationRemote, updateConversationRemote,
} from '../api/dax';
import './theme/dax-theme.css';

function classifyAttachment(file) {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type === 'application/pdf') return 'pdf';
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'sheet';
  if (['doc', 'docx'].includes(ext)) return 'doc';
  if (TEXT_LIKE_EXTENSIONS.includes(ext)) return 'code';
  return 'other';
}

function buildAttachment(file) {
  const type = classifyAttachment(file);
  return {
    id: generateId(),
    name: file.name,
    type,
    mime: file.type,
    size: file.size,
    previewUrl: type === 'image' ? URL.createObjectURL(file) : undefined,
    extractedText: undefined,
    status: 'ready',
    _file: file,
  };
}

// Module-level guard — survives StrictMode's unmount/remount cycle so the
// intro doesn't get lost on the second mount.

export default function DaxApp({ adapter, config = {} }) {
  const navigate = useNavigate();
  const navigatingAwayRef = useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const {
    brandName = 'Dax',
    greeting = 'Good to see you. What\'s on your mind?',
    subtitle = 'Ask anything — Dax reads, remembers, and works alongside you.',
    userName,
    exitHref,
    onExit,
    userId,
    defaultMode = 'workspace',
  } = config;

  // Intro plays on every arrival at the Dax page (no session gate — hiding
  // it after the first visit made it look like the intro was broken).
  const [transition, setTransition] = useState('intro');
  const transitionRef = useRef(transition);
  const setTransitionMode = (mode) => { transitionRef.current = mode; setTransition(mode); };

  // Intercept browser back gesture/button
  useEffect(() => {
    window.history.pushState({ daxIntercepted: true }, '');

    const onPopState = (e) => {
      if (navigatingAwayRef.current) return;
      if (transitionRef.current === 'outro') return;

      e.preventDefault();
      window.history.forward();
      setTransitionMode('outro');
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const finishExit = onExit || (exitHref ? () => navigate(exitHref) : undefined);
  const handleExit = finishExit ? () => setTransitionMode('outro') : undefined;

  const handleTransitionDone = useCallback(() => {
    const wasOutro = transitionRef.current === 'outro';
    setTransitionMode(null);
    if (wasOutro) {
      navigatingAwayRef.current = true;
      finishExit?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    conversations, activeId, activeConversation, setActiveId,
    createConversation, deleteConversation, renameConversation, pinConversation,
    appendMessage, updateMessage, searchConversations, linkServerId, getConversation,
  } = useDaxConversations(userId);

  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [models, setModels] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState(null);
  const bootstrappedRef = useRef(false);
  const modelBootstrappedRef = useRef(false);

  const { phase, error, send, stop, regenerate, continueMessage, editAndResend } = useDaxChat({
    conversation: activeConversation,
    adapter,
    appendMessage,
    updateMessage,
    modelId: selectedModelId,
    onConversationLinked: linkServerId,
  });

  // The failure itself is already shown inline as the assistant's reply
  // (AssistantMessage renders message.error). A quota error additionally
  // carries an upgradeUrl with nowhere else to go — that CTA only surfaces
  // here, via a toast action button, so hitting the daily cap doesn't
  // silently dead-end without a path to upgrade.
  useEffect(() => {
    if (error?.status === 429 && error.upgradeUrl) {
      toast.warning(error.message, {
        id: 'dax:quota-exceeded',
        action: { label: 'Upgrade', onClick: () => navigate(error.upgradeUrl) },
      });
    }
  }, [error, navigate]);

  // Load available models and user's preference on mount
  useEffect(() => {
    if (modelBootstrappedRef.current) return;
    modelBootstrappedRef.current = true;
    (async () => {
      try {
        const [modelsRes, prefRes] = await Promise.all([
          getAvailableModels(),
          getModelPreference(),
        ]);
        setModels(modelsRes.data.models || []);
        const pref = prefRes.data;
        const modelsList = modelsRes.data.models || [];
        const match = modelsList.find(
          (m) => m.provider === pref.provider && (!pref.model || m.model === pref.model)
        );
        if (match) {
          setSelectedModelId(match.id);
        } else if (modelsList.length > 0) {
          setSelectedModelId(modelsList[0].id);
        }
      } catch {
        // model list unavailable
      }
    })();
  }, []);

  async function handleModelSelect(modelId) {
    setSelectedModelId(modelId);
    try {
      await setModelPreference(modelId);
    } catch {
      // preference save failed
    }
  }

  // Land on home every arrival: a persisted activeId would otherwise drop
  // the student straight into their last transcript, skipping the welcome.
  useEffect(() => { setActiveId(null); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  // First visit: lift any pre-existing localStorage conversations to the
  // server, then seed from the backend if there is still nothing to show.
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    (async () => {
      // Runs before the early-return below, and deliberately regardless of how
      // many local conversations exist — a populated local store is precisely
      // the case that has history worth migrating. Non-destructive and
      // idempotent, so a failure here is safe to swallow and retry next load.
      try {
        await migrateLocalConversationsToServer(userId);
      } catch {
        // Offline or the import failed — the local copy is untouched and the
        // migration flag stays unset, so this retries on the next visit.
      }

      if (conversations.length > 0) {
        setActiveId(null);
        return;
      }

      let seeded = [];
      try {
        seeded = (await adapter.loadInitialMessages?.()) || [];
      } catch {
        seeded = [];
      }
      const conv = createConversation({ title: seeded.length ? 'Previous conversation' : '' });
      seeded.forEach((m) => appendMessage(conv.id, m));
      setActiveId(null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Local mutations mirrored to the server for any conversation that has been
  // persisted (serverId set). Local state is updated first and unconditionally,
  // so the UI stays responsive and a failed sync never blocks the interaction;
  // the cost is that an offline rename can drift until the next edit. Deletes
  // matter most — without this the server copy would be orphaned, and it still
  // holds the messages that feed the model's context.
  const syncDelete = useCallback((id) => {
    const conv = getConversation(id);
    deleteConversation(id);
    if (id === activeId) setActiveId(null);
    if (conv?.serverId) deleteConversationRemote(conv.serverId).catch(() => {});
  }, [getConversation, deleteConversation, activeId, setActiveId]);

  const syncRename = useCallback((id, title) => {
    const conv = getConversation(id);
    renameConversation(id, title);
    if (conv?.serverId) updateConversationRemote(conv.serverId, { title }).catch(() => {});
  }, [getConversation, renameConversation]);

  const syncPin = useCallback((id) => {
    const conv = getConversation(id);
    pinConversation(id);
    if (conv?.serverId) updateConversationRemote(conv.serverId, { pinned: !conv.pinned }).catch(() => {});
  }, [getConversation, pinConversation]);

  function ensureConversation() {
    if (activeConversation) return activeConversation;
    return createConversation({});
  }

  function handleSend(textOverride) {
    const conv = ensureConversation();
    if (conv.id !== activeId) setActiveId(conv.id);
    const text = textOverride ?? draft.trim();
    setDraft('');
    const toSend = attachments;
    setAttachments([]);
    setTimeout(() => send(text, toSend), 0);
  }

  async function handleAttachFiles(files) {
    const built = files.map(buildAttachment);
    setAttachments((prev) => [...prev, ...built]);
    for (const att of built) {
      if (['code', 'other'].includes(att.type) && att._file.size <= TEXT_ATTACHMENT_MAX_BYTES && att._file.type.startsWith('text')) {
        setAttachments((prev) => prev.map((a) => (a.id === att.id ? { ...a, status: 'reading' } : a)));
        try {
          const text = await att._file.text();
          setAttachments((prev) => prev.map((a) => (a.id === att.id ? { ...a, extractedText: text, status: 'ready' } : a)));
        } catch {
          setAttachments((prev) => prev.map((a) => (a.id === att.id ? { ...a, status: 'ready' } : a)));
        }
      }
    }
  }

  function handleRemoveAttachment(id) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  function handlePickSuggestion(prompt) {
    const conv = ensureConversation();
    setActiveId(conv.id);
    setDraft('');
    if (defaultMode === 'home') {
      navigate('/dax');
    }
    setTimeout(() => send(prompt, []), 50);
  }

  function handleNewConversation() {
    const conv = createConversation({});
    setActiveId(conv.id);
    if (defaultMode === 'home') {
      navigate('/dax');
    }
  }

  function handleOpenConversation(id) {
    setActiveId(id);
    if (defaultMode === 'home') {
      navigate('/dax');
    }
  }

  function handleGoHome() {
    navigate('/dax?home');
  }

  useKeyboardShortcuts(
    {
      'mod+k': (e) => { e.preventDefault(); setSearchOpen(true); },
      'mod+shift+o': (e) => { e.preventDefault(); handleNewConversation(); },
    },
    []
  );

  const isBusy = phase === 'awaiting-reply' || phase === 'revealing';
  const showHome = defaultMode === 'home';
  const hasActiveWorkspace = !!activeId && !!activeConversation;
  // Home has its own centered prompt box — hide the bottom composer there.
  const homeVisible = showHome || !hasActiveWorkspace;

  return (
    <LayoutGroup>
      <DaxShell
        sidebarOpen={sidebarOpen}
        onToggleSidebar={setSidebarOpen}
        sidebarProps={{
          brandName,
          collapsed: false,
          onToggleCollapse: () => {},
          conversations,
          activeId,
          onSelect: (id) => { handleOpenConversation(id); setSidebarOpen(false); },
          onNew: () => { handleNewConversation(); setSidebarOpen(false); },
          onPin: syncPin,
          onDelete: syncDelete,
          onRename: syncRename,
          onSearch: () => setSearchOpen(true),
          onSettings: () => setSettingsOpen(true),
          onExit: handleExit,
          userName,
        }}
        headerRight={
          <>
            {!showHome && (
              <button
                onClick={handleGoHome}
                className="cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--dax-text-muted)] transition-colors hover:bg-[var(--dax-surface-hover)] hover:text-[var(--dax-text)]"
              >
                Home
              </button>
            )}
            {exitHref && (
              <button
                onClick={handleExit}
                className="cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--dax-text-muted)] transition-colors hover:bg-[var(--dax-surface-hover)] hover:text-[var(--dax-text)]"
              >
                Dashboard
              </button>
            )}
          </>
        }
        showAIPanel={!showHome && hasActiveWorkspace}
        aiPanel={!showHome && hasActiveWorkspace ? (
          <AIPresencePanel onAction={handlePickSuggestion} compact />
        ) : null}
        composer={homeVisible ? null : (
          <Composer
            value={draft}
            onChange={setDraft}
            onSend={handleSend}
            onStop={stop}
            isBusy={isBusy}
            attachments={attachments}
            onAttachFiles={handleAttachFiles}
            onRemoveAttachment={handleRemoveAttachment}
            models={models}
            selectedModelId={selectedModelId}
            onModelSelect={handleModelSelect}
            modelDisabled={isBusy}
          />
        )}
      >
        <ConversationView
          activeId={showHome ? null : activeId}
          conversations={conversations}
          messages={activeConversation?.messages || []}
          userName={userName}
          phase={phase}
          greeting={greeting}
          subtitle={subtitle}
          onPickSuggestion={handlePickSuggestion}
          models={models}
          selectedModelId={selectedModelId}
          onModelSelect={handleModelSelect}
          onOpenConversation={handleOpenConversation}
          introActive={transition !== null}
          onNewChat={handleNewConversation}
          onCopy={(text) => navigator.clipboard?.writeText(text)}
          onRegenerate={regenerate}
          onContinue={continueMessage}
          onEditMessage={editAndResend}
          onSwitchBranch={() => {}}
        />
      </DaxShell>

      <SearchPalette
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        conversations={conversations}
        searchConversations={searchConversations}
        onSelect={(id) => { handleOpenConversation(id); setSearchOpen(false); }}
      />

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} brandName={brandName} />

      <DaxTransition
        mode={transition}
        userName={userName}
        brandName={brandName}
        onDone={handleTransitionDone}
      />
    </LayoutGroup>
  );
}
