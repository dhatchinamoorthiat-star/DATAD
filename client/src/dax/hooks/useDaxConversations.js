import { useCallback, useEffect, useMemo, useState } from 'react';
import { storage } from '../lib/storage';
import { generateId } from '../lib/id';

function newConversation(overrides = {}) {
  const now = Date.now();
  return {
    id: generateId(),
    // The server's Conversation._id once this thread has been persisted.
    // Null until the first turn comes back — the server assigns it and the
    // adapter reports it via onConversationLinked.
    serverId: null,
    title: '',
    createdAt: now,
    updatedAt: now,
    pinned: false,
    folderId: null,
    messages: [],
    ...overrides,
  };
}

function toIndexEntry(conv) {
  const lastMessage = conv.messages[conv.messages.length - 1];
  return {
    id: conv.id,
    title: conv.title,
    preview: lastMessage ? lastMessage.content.slice(0, 120) : '',
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
    pinned: conv.pinned,
    folderId: conv.folderId,
    messageCount: conv.messages.length,
  };
}

export function useDaxConversations(userId) {
  const [index, setIndex] = useState(() => storage.readIndex(userId));
  const [activeId, setActiveIdState] = useState(() => storage.readActiveId(userId));
  // Mutated in place and paired with forceRender below — the setter is
  // deliberately unused, so it is not destructured.
  const [cache] = useState(() => new Map());
  const [, forceRender] = useState(0);

  const getConversation = useCallback(
    (id) => {
      if (!id) return null;
      if (cache.has(id)) return cache.get(id);
      const loaded = storage.readConversation(userId, id);
      if (loaded) cache.set(id, loaded);
      return loaded;
    },
    [cache, userId]
  );

  const persistConversation = useCallback(
    (conv) => {
      cache.set(conv.id, conv);
      storage.writeConversation(userId, conv);
      setIndex((prevIndex) => {
        const rest = prevIndex.filter((e) => e.id !== conv.id);
        const next = [toIndexEntry(conv), ...rest];
        storage.writeIndex(userId, next);
        return next;
      });
      forceRender((n) => n + 1);
    },
    [cache, userId]
  );

  const setActiveId = useCallback((id) => {
    setActiveIdState(id);
    storage.writeActiveId(userId, id);
  }, [userId]);

  const createConversation = useCallback(
    (overrides) => {
      const conv = newConversation(overrides);
      cache.set(conv.id, conv);
      storage.writeConversation(userId, conv);
      setIndex((prev) => {
        const next = [toIndexEntry(conv), ...prev];
        storage.writeIndex(userId, next);
        return next;
      });
      setActiveId(conv.id);
      return conv;
    },
    [cache, setActiveId, userId]
  );

  const deleteConversation = useCallback(
    (id) => {
      cache.delete(id);
      storage.deleteConversation(userId, id);
      setIndex((prev) => {
        const next = prev.filter((e) => e.id !== id);
        storage.writeIndex(userId, next);
        return next;
      });
      setActiveIdState((cur) => {
        if (cur !== id) return cur;
        return null;
      });
    },
    [cache, userId]
  );

  const renameConversation = useCallback(
    (id, title) => {
      const conv = getConversation(id);
      if (!conv) return;
      const next = { ...conv, title, updatedAt: Date.now() };
      persistConversation(next);
    },
    [getConversation, persistConversation]
  );

  const pinConversation = useCallback(
    (id) => {
      const conv = getConversation(id);
      if (!conv) return;
      persistConversation({ ...conv, pinned: !conv.pinned, updatedAt: Date.now() });
    },
    [getConversation, persistConversation]
  );

  // Binds a local conversation to the server-side one the backend created for
  // it. Must persist immediately: the next turn reads conversation.serverId to
  // decide whether it is continuing a thread or starting one, so losing this
  // would fork a new server conversation on every message.
  const linkServerId = useCallback(
    (localId, serverId) => {
      const conv = getConversation(localId);
      if (!conv || conv.serverId === serverId) return;
      persistConversation({ ...conv, serverId });
    },
    [getConversation, persistConversation]
  );

  const appendMessage = useCallback(
    (convId, message) => {
      const conv = getConversation(convId);
      if (!conv) return;
      const messages = [...conv.messages, message];
      const title = conv.title || (message.role === 'user' ? message.content.slice(0, 48) : conv.title);
      persistConversation({ ...conv, messages, title, updatedAt: Date.now() });
    },
    [getConversation, persistConversation]
  );

  const updateMessage = useCallback(
    (convId, msgId, patch) => {
      const conv = getConversation(convId);
      if (!conv) return;
      const messages = conv.messages.map((m) => (m.id === msgId ? { ...m, ...patch } : m));
      persistConversation({ ...conv, messages, updatedAt: Date.now() });
    },
    [getConversation, persistConversation]
  );

  useEffect(
    () =>
      storage.onExternalChange(() => {
        setIndex(storage.readIndex(userId));
        cache.clear();
        forceRender((n) => n + 1);
      }),
    [cache, userId]
  );

  const conversations = useMemo(
    () => [...index].sort((a, b) => (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt)),
    [index]
  );

  const activeConversation = activeId ? getConversation(activeId) : null;

  const searchConversations = useCallback(
    (query) => {
      const q = query.trim().toLowerCase();
      if (!q) return conversations;
      return conversations.filter(
        (c) => c.title.toLowerCase().includes(q) || c.preview.toLowerCase().includes(q)
      );
    },
    [conversations]
  );

  return {
    conversations,
    activeId,
    activeConversation,
    setActiveId,
    createConversation,
    deleteConversation,
    renameConversation,
    pinConversation,
    appendMessage,
    updateMessage,
    searchConversations,
    getConversation,
    linkServerId,
  };
}
