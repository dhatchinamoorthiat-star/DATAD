import { useCallback, useRef, useState } from 'react';
import { generateId } from '../lib/id';
import { toChunks } from '../lib/streaming';
import { MESSAGE_STATUS, DAX_CONTINUE_INTENT } from '../constants';

function makeMessage(overrides) {
  const now = Date.now();
  return {
    id: generateId(),
    role: 'user',
    content: '',
    attachments: [],
    citations: [],
    status: MESSAGE_STATUS.done,
    error: null,
    proposals: [],
    createdAt: now,
    editedAt: null,
    parentId: null,
    branchOf: null,
    ...overrides,
  };
}

// phase: 'idle' | 'awaiting-reply' | 'revealing' | 'error'
export function useDaxChat({ conversation, adapter, appendMessage, updateMessage, modelId, onConversationLinked }) {
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
  const stoppedRef = useRef(false);
  const conversationRef = useRef(conversation);
  conversationRef.current = conversation;
  // Synchronous re-entrancy guard: some UI paths (e.g. the send button)
  // can dispatch two click events for what is visually a single click,
  // which would otherwise fire two concurrent runReply() calls against the
  // same conversation and race their localStorage writes against each
  // other. React state (`phase`) can't guard this — both duplicate calls
  // happen before the first state update ever commits — so this uses a
  // plain ref, set synchronously.
  const inFlightRef = useRef(false);

  const runReply = useCallback(
    async (userText, attachments, parentId, replaceMessageId) => {
      const convId = conversationRef.current?.id;
      const controller = new AbortController();
      abortRef.current = controller;
      stoppedRef.current = false;

      const assistantId = replaceMessageId || generateId();
      const assistantMessage = makeMessage({
        id: assistantId,
        role: 'assistant',
        content: '',
        status: MESSAGE_STATUS.pending,
        parentId,
      });
      appendMessage(convId, assistantMessage);

      setPhase('awaiting-reply');
      setError(null);

      // Confirmation cards arrive on their own SSE frame, independently of the
      // text stream, so they are collected here and attached to the assistant
      // message rather than being folded into its content.
      const proposals = [];

      try {
        const result = await adapter.sendMessage({
          // conversationRef, not the captured `conversation` — this closure can
          // outlive the render it was created in, and sending against a stale
          // snapshot would mean sending a stale (or absent) serverId and
          // forking a duplicate conversation on the server.
          conversation: conversationRef.current,
          text: userText,
          attachments,
          signal: controller.signal,
          modelId,
          onConversationLinked,
          onProposal: (p) => {
            proposals.push(p);
            updateMessage(convId, assistantId, { proposals: [...proposals] });
          },
        });

        if (controller.signal.aborted) return;

        setPhase('revealing');
        updateMessage(convId, assistantId, { status: MESSAGE_STATUS.streaming });

        let revealed = '';
        let pendingFlush = false;
        for await (const chunk of toChunks(result, { signal: controller.signal })) {
          if (stoppedRef.current) break;
          revealed += chunk;
          if (!pendingFlush) {
            pendingFlush = true;
            const snapshot = revealed;
            requestAnimationFrame(() => {
              updateMessage(convId, assistantId, { content: snapshot });
              pendingFlush = false;
            });
          }
        }
        updateMessage(convId, assistantId, { content: revealed, status: MESSAGE_STATUS.done });
        setPhase('idle');
      } catch (err) {
        // Axios v1 rejects an aborted request with a CanceledError
        // (code ERR_CANCELED), not the native fetch AbortError — check both
        // so a client-side Stop always resolves cleanly instead of
        // surfacing as a generic failure.
        const wasAborted =
          err?.name === 'AbortError' || err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED';
        if (wasAborted) {
          updateMessage(convId, assistantId, { status: MESSAGE_STATUS.done });
          setPhase('idle');
          return;
        }
        const status = err?.response?.status;
        const message =
          status === 429
            ? err.response.data?.message || 'Daily message limit reached.'
            : err?.response?.data?.message || 'Dax ran into a problem answering that. Please try again.';
        updateMessage(convId, assistantId, { status: MESSAGE_STATUS.error, error: message });
        setError({ status, message, upgradeUrl: err?.response?.data?.upgradeUrl });
        setPhase('error');
      } finally {
        abortRef.current = null;
        inFlightRef.current = false;
      }
    },
    [adapter, appendMessage, updateMessage, modelId, onConversationLinked]
  );

  const send = useCallback(
    (text, attachments = []) => {
      const conv = conversationRef.current;
      if (!conv) return;
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      const userMessage = makeMessage({ role: 'user', content: text, attachments });
      appendMessage(conv.id, userMessage);
      runReply(text, attachments, userMessage.id);
    },
    [appendMessage, runReply]
  );

  const stop = useCallback(() => {
    stoppedRef.current = true;
    abortRef.current?.abort();
  }, []);

  const regenerate = useCallback(
    (messageId) => {
      const conv = conversationRef.current;
      if (!conv) return;
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      const target = conv.messages.find((m) => m.id === messageId);
      if (!target) { inFlightRef.current = false; return; }
      const parentUserMessage = conv.messages.find((m) => m.id === target.parentId);
      const newId = generateId();
      const branchMessage = makeMessage({
        id: newId,
        role: 'assistant',
        status: MESSAGE_STATUS.pending,
        parentId: target.parentId,
        branchOf: target.id,
      });
      appendMessage(conv.id, branchMessage);
      runReply(parentUserMessage?.content || '', parentUserMessage?.attachments || [], target.parentId, newId);
    },
    [appendMessage, runReply]
  );

  const continueMessage = useCallback(
    (messageId) => {
      const conv = conversationRef.current;
      if (!conv) return;
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      const target = conv.messages.find((m) => m.id === messageId);
      if (!target) { inFlightRef.current = false; return; }
      const newId = generateId();
      const branchMessage = makeMessage({
        id: newId,
        role: 'assistant',
        content: target.content,
        status: MESSAGE_STATUS.pending,
        parentId: target.parentId,
        branchOf: target.id,
      });
      appendMessage(conv.id, branchMessage);
      runReply(DAX_CONTINUE_INTENT, [], target.parentId, newId);
    },
    [appendMessage, runReply]
  );

  const editAndResend = useCallback(
    (messageId, newText) => {
      const conv = conversationRef.current;
      if (!conv) return;
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      const target = conv.messages.find((m) => m.id === messageId);
      if (!target) { inFlightRef.current = false; return; }
      const newUserId = generateId();
      const editedMessage = makeMessage({
        id: newUserId,
        role: 'user',
        content: newText,
        attachments: target.attachments,
        branchOf: target.id,
      });
      appendMessage(conv.id, editedMessage);
      runReply(newText, target.attachments, newUserId);
    },
    [appendMessage, runReply]
  );

  return { phase, error, send, stop, regenerate, continueMessage, editAndResend };
}
