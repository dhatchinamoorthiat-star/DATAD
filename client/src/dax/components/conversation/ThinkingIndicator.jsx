import { useEffect, useState } from 'react';
import Avatar from '../common/Avatar';

const PHRASES = ['Thinking…', 'Reading your message…', 'Composing a reply…'];

export default function ThinkingIndicator() {
  const [phrase, setPhrase] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPhrase((p) => (p + 1) % PHRASES.length), 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-start gap-3 px-1 py-2">
      <Avatar speaker="assistant" />
      <div className="flex items-center gap-2 pt-1.5">
        <span className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="dax-thinking-dot h-1.5 w-1.5 rounded-full bg-[var(--dax-accent)]"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </span>
        <span className="text-xs text-[var(--dax-text-muted)]">{PHRASES[phrase]}</span>
      </div>
    </div>
  );
}
