import api from './axios';
import { getChatHistory, clearChat } from './dax';
import { DAX_CONTINUE_INTENT } from '../dax/constants';

// What to tell the model when an attachment's text never materialised. Each
// reads as a fact about the file, not an apology for the product.
const UNREADABLE_NOTE = {
  unsupported: 'this file format cannot be read on this deployment — only the file name is available',
  scanned: 'this looks like a scanned or photographed document, so no text could be extracted from it — only the file name is available',
  empty: 'no text could be extracted from this file — only the file name is available',
  default: "only the file name is available; this file's contents could not be read",
};

function composePrompt(text, attachments = []) {
  const parts = [];
  if (text && text !== DAX_CONTINUE_INTENT) parts.push(text);
  if (text === DAX_CONTINUE_INTENT) parts.push('Please continue your previous answer from where you left off.');

  for (const att of attachments) {
    if (att.extractedText) {
      parts.push(`\n\n[Attached file: "${att.name}"]\n\`\`\`\n${att.extractedText}\n\`\`\``);
    } else {
      // Why it could not be read matters to the answer. "Scanned" invites Dax
      // to say the pages are images and ask for the text; the blanket "cannot
      // read this yet" invited it to apologise for a limitation that no longer
      // applies to most documents.
      parts.push(`\n\n[Attached file: "${att.name}" — ${UNREADABLE_NOTE[att.unreadableReason] || UNREADABLE_NOTE.default}]`);
    }
  }
  return parts.join('');
}

function mapBackendMessage(raw) {
  return {
    id: raw._id || raw.id,
    role: raw.role,
    content: raw.content,
    attachments: [],
    citations: [],
    status: 'done',
    error: null,
    createdAt: raw.createdAt ? new Date(raw.createdAt).getTime() : Date.now(),
    editedAt: null,
    parentId: null,
    branchOf: null,
  };
}

// Real NVIDIA token-by-token streaming over SSE, consumed via axios's fetch
// adapter (same request-shape convention as the existing, previously-unused
// searchStream() in api/search.js) so the axios auth interceptor still
// attaches the bearer token. Returns an AsyncIterable — lib/streaming.js's
// toChunks() passes real iterables through with zero artificial delay, so
// this is a drop-in swap for the previous single-shot sendMessage with no
// changes needed anywhere else in the Dax library.
async function* streamDaxChat(prompt, signal, modelId, conversationId, clientConversationId, onConversationId, onProposal) {
  const res = await api.post(
    '/dax/chat/stream',
    { message: prompt, modelId, conversationId, clientConversationId },
    { responseType: 'stream', adapter: 'fetch', signal }
  );

  // A quota-exceeded (or otherwise pre-stream) error comes back as plain
  // JSON, not SSE — the fetch adapter still resolves res.data as a stream in
  // that case, so detect it via content-type rather than assuming SSE.
  // axios's fetch adapter exposes a native Headers instance (only readable
  // via .get()), not a plain object — bracket access silently returns
  // undefined instead of throwing, so both shapes must be handled.
  const contentType =
    (typeof res.headers?.get === 'function' ? res.headers.get('content-type') : res.headers?.['content-type']) || '';
  if (!contentType.includes('text/event-stream')) {
    const text = await new Response(res.data).text();
    const data = text ? JSON.parse(text) : {};
    if (data._error) throw Object.assign(new Error(data.message), { response: { status: data._error, data } });
    return;
  }

  const reader = res.data.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  // The backend's provider fallback chain can stall completely — no token,
  // no error frame, no closed connection — if every candidate model times
  // out without one of them raising a catchable error server-side. Without
  // a client-side ceiling, reader.read() then just never resolves and the
  // UI is stuck "typing" forever with no way for the user to recover short
  // of a page reload. Reset on every frame received, not just tokens, so a
  // genuinely slow-but-alive stream isn't cut off early.
  const STALL_TIMEOUT_MS = 30000;
  async function readWithStallTimeout() {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(async () => {
        try { await reader.cancel(); } catch { /* already closed */ }
        reject(new Error('Dax is taking longer than usual to respond. Please try again.'));
      }, STALL_TIMEOUT_MS);
    });
    try {
      return await Promise.race([reader.read(), timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
  // The server's only clean way to end this stream is a 'done' frame — set
  // right before res.end() in daxRoutes.js. If the underlying connection
  // drops for any other reason (server restart, proxy hiccup, network
  // blip), reader.read() resolves { done: true } with no such frame ever
  // having arrived. Without this flag that looked identical to a normal
  // finished reply — whatever text had streamed so far got marked 'done'
  // and shown as Dax's complete answer, silently truncated mid-sentence.
  let sawTerminalFrame = false;

  while (true) {
    const { done, value } = await readWithStallTimeout();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split('\n\n');
    buffer = frames.pop();

    for (const frame of frames) {
      if (!frame.trim()) continue;
      const lines = frame.split('\n');
      const eventLine = lines.find((l) => l.startsWith('event: '));
      const dataLine = lines.find((l) => l.startsWith('data: '));
      if (!eventLine || !dataLine) continue;
      const type = eventLine.slice('event: '.length);
      const data = JSON.parse(dataLine.slice('data: '.length));

      if (type === 'token') yield data.text;
      if (type === 'error') { sawTerminalFrame = true; throw new Error(data.message); }
      if (type === 'done' && data._error) {
        sawTerminalFrame = true;
        throw Object.assign(new Error(data.message), { response: { status: data._error, data } });
      }
      // A turn sent without a conversationId (a brand-new local chat) makes
      // the server create the conversation and report its id here. Recording
      // it against the local conversation is what binds the two together, so
      // every following turn in this thread resolves to the same server-side
      // history instead of spawning a new conversation each time.
      // Emitted just before 'done', so a confirmation card attaches to the
      // finished reply rather than appearing mid-sentence.
      if (type === 'proposal' && data.proposal) onProposal?.(data.proposal);
      if (type === 'done') {
        sawTerminalFrame = true;
        if (data.conversationId) onConversationId?.(data.conversationId);
      }
    }
  }

  if (!sawTerminalFrame) {
    throw new Error('Connection to Dax was lost before the reply finished. Please try again.');
  }
}

export function createDaxChatAdapter() {
  return {
    /**
     * @param {object}   args
     * @param {Function} [args.onConversationLinked] Called as
     *   (localConversationId, serverConversationId) the first time the server
     *   reports the id it assigned to this conversation. The caller is expected
     *   to persist serverId onto its local record — without that, every turn
     *   would start a fresh server-side conversation and history would never
     *   accumulate. Passed per call rather than at construction because the
     *   adapter is built in DaxPage while the conversation store lives in DaxApp.
     */
    sendMessage({ conversation, text, attachments, signal, modelId, onConversationLinked, onProposal }) {
      const prompt = composePrompt(text, attachments);
      return streamDaxChat(
        prompt,
        signal,
        modelId,
        conversation?.serverId,
        // Local id, so a conversation that has never been persisted still starts
        // its own server-side thread instead of appending to the last one.
        conversation?.id,
        (serverId) => {
          if (conversation?.id && serverId !== conversation.serverId) {
            onConversationLinked?.(conversation.id, serverId);
          }
        },
        onProposal
      );
    },
    async loadInitialMessages(conversationId) {
      const { data } = await getChatHistory(conversationId);
      return (data.messages || []).map(mapBackendMessage);
    },
    async clearRemoteHistory() {
      await clearChat();
    },
  };
}
