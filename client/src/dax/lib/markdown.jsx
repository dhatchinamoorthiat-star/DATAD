import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

export const remarkPlugins = [remarkGfm];
export const rehypePlugins = [[rehypeHighlight, { detect: false, ignoreMissing: true }]];

function extractText(node) {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node.props?.children) return extractText(node.props.children);
  return '';
}

export function buildComponents({ isStreaming, CodeBlock, Citation: _Citation }) {
  return {
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ),
    // `_inline` is kept in the signature, prefixed, purely as documentation:
    // react-markdown used to pass it and no longer does. Destructuring it here
    // also stops it being spread onto the DOM node by ...rest.
    code({ inline: _inline, className, children, ...rest }) {
      const match = /language-(\w+)/.exec(className || '');
      const text = extractText(children);
      // react-markdown v9 stopped passing `inline` — it is always undefined
      // here, so the old `if (inline)` never fired and EVERY code span became a
      // full CodeBlock. A one-word span like `/subscribe` rendered as a bordered
      // block with a language label and a Copy button, mid-sentence. It went
      // unnoticed while replies rarely used inline code; Dax quotes routes
      // constantly now, so it showed up on the first answer.
      //
      // A fenced block always arrives with a language class or a trailing
      // newline; an inline span has neither.
      const isBlock = Boolean(match) || text.includes('\n');
      if (!isBlock) {
        return (
          <code className={className} {...rest}>
            {children}
          </code>
        );
      }
      const code = text.replace(/\n$/, '');
      return (
        <CodeBlock language={match?.[1]} code={code} isStreaming={isStreaming}>
          {code}
        </CodeBlock>
      );
    },
    // Citations are written by the model as [[cite:id|label]] and pre-parsed
    // upstream — left as a passthrough for now since no backend citation
    // format exists yet. Kept here so the render pipeline has a real seam.
  };
}
