/**
 * Markdown for the compact chat surfaces (the DaxPanel bubble, and anywhere
 * else a reply is shown outside the /dax page).
 *
 * The panel rendered `{msg.content}` as raw text, so every live reply arrived
 * with its formatting visible: "go to **Finance → Tracker** at the route
 * `/finance/tracker`". The maintenance replies escaped this only because they
 * were pre-stripped by maintenanceReplyPlain(); the model's output never was.
 *
 * NOT the /dax renderer (dax/components/conversation/MessageContent.jsx): that
 * one is styled by `dax-prose` and `--dax-text`, which belong to the Dax page's
 * own theme, and it carries a code-block component with a copy button — too
 * heavy for a 320px bubble. This shares the same remark plugins so the two
 * parse identically, but every element inherits the bubble's own colour, which
 * is what lets one component work on both the indigo user bubble and the grey
 * assistant one, in light mode and dark.
 */
import ReactMarkdown from 'react-markdown';
import { remarkPlugins } from '../../dax/lib/markdown.jsx';

// text-inherit throughout: the bubble sets the colour, not the markdown.
const COMPONENTS = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 list-disc space-y-0.5 pl-4 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 list-decimal space-y-0.5 pl-4 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="leading-snug">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  h1: ({ children }) => <h1 className="mb-1 text-sm font-semibold">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-1 text-sm font-semibold">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1 text-sm font-semibold">{children}</h3>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
      {children}
    </a>
  ),
  // Dax quotes routes constantly now that it knows the app map, so inline code
  // is the single most common bit of markup on this surface. Kept subtle — a
  // faint tint rather than a box, so a sentence with three paths still reads.
  // `inline` is always undefined in react-markdown v9, so block vs span is
  // decided the same way the /dax renderer does it: a fenced block carries a
  // language class or a newline, an inline span carries neither.
  code: ({ className, children }) => {
    const text = Array.isArray(children) ? children.join('') : String(children ?? '');
    const isBlock = /language-(\w+)/.test(className || '') || text.includes('\n');
    return isBlock ? (
      <pre className="mb-2 overflow-x-auto rounded-lg bg-black/10 p-2 text-xs last:mb-0 dark:bg-white/10">
        <code>{children}</code>
      </pre>
    ) : (
      <code className="rounded bg-black/10 px-1 py-0.5 text-[0.9em] dark:bg-white/15">{children}</code>
    );
  },
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-current/30 pl-2 opacity-90 last:mb-0">{children}</blockquote>
  ),
  hr: () => <hr className="my-2 border-current/20" />,
};

export default function ChatMarkdown({ content }) {
  return (
    <div className="text-left [&>*:last-child]:mb-0">
      <ReactMarkdown remarkPlugins={remarkPlugins} components={COMPONENTS}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
