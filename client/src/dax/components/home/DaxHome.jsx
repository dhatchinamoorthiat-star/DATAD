import { useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { formatDistanceToNowStrict } from 'date-fns';
import {
  ArrowUp, ArrowUpRight, MessageSquare, Plus, Pin,
  Lightbulb, CalendarDays, FileText, MessageCircle, User, Wrench, Hammer,
} from 'lucide-react';
import DaxOrb from '../common/DaxOrb';

// Dax home — Claude-style landing: a centered greeting with the orb, one
// big prompt box front and center (typing here starts the chat directly),
// quick-start chips beneath it, and recent conversations below.

const EASE = [0.16, 1, 0.3, 1];

function rise(delay, reduce) {
  if (reduce) return { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { delay: delay / 2, duration: 0.2 } };
  return {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.5, ease: EASE },
  };
}

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function preview(conv) {
  const text = conv.preview || conv.messages?.[conv.messages.length - 1]?.content || '';
  if (!text) return null;
  return text.replace(/\s+/g, ' ').slice(0, 90);
}

const QUICK_ACTIONS = [
  { label: 'Review my resume', prompt: 'Help me review and improve my resume', icon: FileText },
  { label: 'Plan my week', prompt: 'Help me plan out my week based on my tasks and deadlines', icon: CalendarDays },
  { label: 'Study a topic', prompt: 'I want to learn a topic. Help me break it down.', icon: Lightbulb },
  { label: 'Brainstorm ideas', prompt: 'Let\'s brainstorm some ideas. Ask me what I\'m working on.', icon: MessageCircle },
];

// While Dax is in maintenance only a fixed set of questions has a real answer
// (see ../../maintenance.js) — offering the full quick-starts would just walk
// students into the "I can't answer that yet" reply.
const MAINTENANCE_ACTIONS = [
  { label: 'Say hi', prompt: 'Hi', icon: MessageCircle },
  { label: 'Who are you?', prompt: 'Who are you?', icon: User },
  { label: 'Who made you?', prompt: 'Who made you?', icon: Hammer },
  { label: 'What can you do?', prompt: 'What can you do?', icon: Wrench },
];

export default function DaxHome({
  userName,
  conversations = [],
  onOpenConversation,
  onNewChat,
  onPickSuggestion,
  introActive = false,
  maintenance = false,
}) {
  const reduce = useReducedMotion();
  const [prompt, setPrompt] = useState('');
  const inputRef = useRef(null);
  const recent = conversations.slice(0, 4);
  const firstName = userName?.split(' ')[0];

  function submit() {
    const text = prompt.trim();
    if (!text) return;
    setPrompt('');
    onPickSuggestion?.(text);
  }

  return (
    <div className="relative h-full w-full overflow-y-auto dax-scrollbar">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse 55% 40% at 50% 20%, rgb(var(--dax-accent-rgb) / 0.08) 0%, transparent 70%)' }}
      />

      {/* While the intro/outro curtain is up, hold the content back — it
          mounts (and staggers in) only once the curtain lifts, so the
          reveal and the orb's flight from the curtain read as one motion. */}
      {introActive ? null : (
      <div className="relative mx-auto flex w-full max-w-2xl flex-col items-center px-6 pt-14 pb-12">
        {/* Orb + centered greeting */}
        <motion.div {...rise(0.05, reduce)} className="flex flex-col items-center text-center">
          <DaxOrb size={48} layoutId="dax-orb" />
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
            {timeGreeting()}{firstName ? `, ${firstName}` : ''}.
          </h1>
        </motion.div>

        {/* Big prompt box — the primary way in */}
        <motion.div {...rise(0.18, reduce)} className="mt-7 w-full">
          <div
            className="rounded-2xl border border-[var(--dax-border)] bg-[var(--dax-surface)] p-3 shadow-[var(--dax-shadow-lift)] transition-colors focus-within:border-[rgb(var(--dax-accent-rgb)/0.6)]"
            /* Widens the click target onto the padding around the textarea.
               Keyboard users tab straight to the textarea, so there is no
               keyboard behaviour to mirror here. */
            role="presentation"
            onClick={() => inputRef.current?.focus()}
          >
            <textarea
              ref={inputRef}
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
              }}
              placeholder="How can Dax help you today?"
              className="w-full resize-none bg-transparent px-1.5 pt-1 text-[15px] leading-relaxed text-[var(--dax-text)] placeholder-[var(--dax-text-faint)] focus:outline-none"
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={submit}
                disabled={!prompt.trim()}
                aria-label="Send"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--dax-accent)] text-[var(--dax-accent-contrast)] transition-opacity disabled:opacity-30"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Quick-start chips */}
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {(maintenance ? MAINTENANCE_ACTIONS : QUICK_ACTIONS).map((a, i) => (
              <motion.button
                key={a.label}
                {...rise(0.3 + i * 0.05, reduce)}
                type="button"
                onClick={() => { setPrompt(a.prompt); inputRef.current?.focus(); }}
                className="flex items-center gap-1.5 rounded-full border border-[var(--dax-border)] bg-[var(--dax-surface)] px-3 py-1.5 text-xs font-medium text-[var(--dax-text-muted)] transition-colors hover:border-[rgb(var(--dax-accent-rgb)/0.5)] hover:text-[var(--dax-text)]"
              >
                <a.icon className="h-3.5 w-3.5 text-[var(--dax-accent)]" />
                {a.label}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Recent conversations */}
        {recent.length > 0 && (
          <motion.section {...rise(0.45, reduce)} className="mt-10 w-full">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--dax-text-faint)]">
                Your recent chats
              </h2>
              <button
                type="button"
                onClick={onNewChat}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[var(--dax-accent)] transition-colors hover:bg-[rgb(var(--dax-accent-rgb)/0.08)]"
              >
                <Plus className="h-3.5 w-3.5" /> New chat
              </button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-[var(--dax-border)]">
              {recent.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onOpenConversation?.(c.id)}
                  className={`group flex w-full items-center gap-3 bg-[var(--dax-surface)] px-4 py-2.5 text-left transition-colors hover:bg-[var(--dax-surface-hover)] ${
                    i > 0 ? 'border-t border-[var(--dax-border)]' : ''
                  }`}
                >
                  <MessageSquare className="h-4 w-4 shrink-0 text-[var(--dax-text-faint)]" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--dax-text)]">
                      <span className="truncate">{c.title || 'Untitled conversation'}</span>
                      {c.pinned && <Pin className="h-3 w-3 shrink-0 text-[var(--dax-accent)]" />}
                    </span>
                    {preview(c) && (
                      <span className="mt-0.5 block truncate text-xs text-[var(--dax-text-muted)]">{preview(c)}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-[11px] text-[var(--dax-text-faint)]">
                    {c.updatedAt ? formatDistanceToNowStrict(c.updatedAt, { addSuffix: true }) : ''}
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[var(--dax-text-faint)] opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              ))}
            </div>
          </motion.section>
        )}
      </div>
      )}
    </div>
  );
}
