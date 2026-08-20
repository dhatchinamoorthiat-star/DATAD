/**
 * DaxPanel — embedded Dax chat panel for workspace pages.
 *
 * Replaces the legacy ChatBot floating widget. Appears as a compact panel
 * on the right side of workspace pages. When opened with a `context` prop,
 * Dax receives the page context (e.g., "the student is viewing note X").
 *
 * This satisfies Product Constitution P2 (Dax is the One AI Identity) and
 * P1 (Calm is the Interface) by making Dax ambient rather than a destination.
 */
import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, Sparkles, PanelRightClose, Construction } from 'lucide-react';
import { daxChat } from '../../api/dax';
import { DAX_WELCOME } from '../../utils/dax';
import {
  DAX_MAINTENANCE, DAX_MAINTENANCE_BANNER, DAX_MAINTENANCE_PROMPTS, maintenanceReplyPlain,
} from '../../dax/maintenance';

// Page context descriptors — sent as the first user message when a context
// is provided, so Dax knows what the student is looking at.
const CONTEXT_MAP = {
  notes: 'I\'m looking at my study notes.',
  resume: 'I\'m working on my resume.',
  planner: 'I\'m planning my tasks.',
  career: 'I\'m exploring career opportunities.',
  study: 'I\'m in the study hub.',
  community: 'I\'m browsing the community.',
  finance: 'I\'m managing my finances.',
};

function chip(text, onClick) {
  return (
    <button
      key={text}
      onClick={onClick}
      className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50"
    >
      {text}
    </button>
  );
}

// Matches the "thinking" beat the maintenance adapter uses on the /dax page,
// so the typing dots read as a reply rather than a glitch.
const MAINTENANCE_THINKING_MS = 450;

export default function DaxPanel({ context, position = 'right' }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: DAX_MAINTENANCE ? maintenanceReplyPlain('hi') : DAX_WELCOME },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll on new messages
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Focus input when panel opens
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const send = async (text) => {
    const msg = text || input;
    if (!msg.trim() || loading) return;

    const userMsg = { role: 'user', content: msg.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Maintenance: answered locally from the fixed set, so this panel makes no
    // request at all. See ../../dax/maintenance.js.
    if (DAX_MAINTENANCE) {
      setTimeout(() => {
        setMessages((prev) => [...prev, { role: 'assistant', content: maintenanceReplyPlain(msg) }]);
        setLoading(false);
      }, MAINTENANCE_THINKING_MS);
      return;
    }

    try {
      const res = await daxChat(msg);
      setMessages((prev) => [...prev, { role: 'assistant', content: res.data?.reply || 'Sorry, I couldn\'t process that.' }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'I\'m having trouble connecting. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg transition-all hover:bg-indigo-700 hover:shadow-xl active:scale-95 lg:bottom-6"
        style={{ [position]: '1.5rem' }}
        aria-label="Open Dax"
      >
        <MessageCircle className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex w-80 flex-col rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900 lg:bottom-6"
      style={{ [position]: '1.5rem', maxHeight: 'calc(100vh - 11rem)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Dax</span>
          {context && CONTEXT_MAP[context] && (
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
              {context}
            </span>
          )}
        </div>
        <button
          onClick={() => setOpen(false)}
          className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          aria-label="Close Dax"
        >
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>

      {DAX_MAINTENANCE && (
        <div className="flex items-start gap-2 border-b border-gray-100 bg-indigo-50/60 px-4 py-2 text-[11px] leading-snug text-indigo-800 dark:border-gray-800 dark:bg-indigo-900/20 dark:text-indigo-200">
          <Construction className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>{DAX_MAINTENANCE_BANNER}</span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3" style={{ minHeight: '200px', maxHeight: '400px' }}>
        {messages.map((msg, i) => (
          <div key={i} className={`mb-3 ${msg.role === 'user' ? 'text-right' : ''}`}>
            <div
              className={`inline-block max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-left text-sm ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="mb-3">
            <div className="inline-block rounded-2xl bg-gray-100 px-3.5 py-2 text-sm text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick chips (shown before first user message) */}
      {messages.length === 1 && !loading && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {DAX_MAINTENANCE ? (
            DAX_MAINTENANCE_PROMPTS.map((p) => chip(p, () => send(p)))
          ) : (
            <>
              {chip('What should I focus on?', () => send('What should I focus on today?'))}
              {chip('Quick study tip', () => send('Give me a quick study framework'))}
              {chip('Interview help', () => send('How do I answer "Tell me about yourself?"'))}
            </>
          )}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-100 p-3 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Dax..."
            className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-400 focus:bg-white dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-indigo-500"
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
