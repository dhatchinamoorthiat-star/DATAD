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
    code({ inline, className, children, ...rest }) {
      const match = /language-(\w+)/.exec(className || '');
      if (inline) {
        return (
          <code className={className} {...rest}>
            {children}
          </code>
        );
      }
      const code = extractText(children).replace(/\n$/, '');
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
