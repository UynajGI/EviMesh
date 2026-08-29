import Link from 'next/link';
import { cn } from '@/lib/utils';
import { headingSlug, parseInline } from '@/lib/docs-markdown.mjs';
import { DocsCopyButton } from '@/components/docs/docs-code-block';

/*
 * Docs article renderer (docs-plan.md §4.2). Maps the whitelist AST onto the
 * existing design-system components; prose is capped at 72ch, headings carry
 * anchors, and code blocks render through the client copy button.
 */

function Inline({ segments }) {
  return segments.map((segment, index) => {
    if (segment.type === 'code') {
      return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground" key={index}>{segment.value}</code>;
    }
    if (segment.type === 'bold') {
      return <strong className="font-semibold text-foreground" key={index}>{segment.value}</strong>;
    }
    if (segment.type === 'italic') {
      return <em key={index}>{segment.value}</em>;
    }
    if (segment.type === 'link') {
      const external = segment.href.startsWith('http');
      return (
        <a
          className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
          href={segment.href}
          key={index}
          {...(external ? { rel: 'noopener noreferrer', target: '_blank' } : {})}
        >
          {segment.text}
        </a>
      );
    }
    return <span key={index}>{segment.value}</span>;
  });
}

export function DocsBlocks({ blocks }) {
  return blocks.map((block, index) => {
    switch (block.type) {
      case 'heading': {
        const slug = headingSlug(block.text);
        const Tag = `h${Math.min(block.level + 1, 6)}`;
        return (
          <Tag className={cn('scroll-mt-24 font-semibold text-foreground', block.level <= 2 ? 'mt-10 text-xl' : 'mt-8 text-base')} id={slug} key={index}>
            <a className="sr-only focus:not-sr-only" href={`#${slug}`}>link to this section</a>
            {block.text}
          </Tag>
        );
      }
      case 'paragraph':
        return <p className="mt-4 max-w-[72ch] leading-7 text-muted-foreground" key={index}><Inline segments={block.inline} /></p>;
      case 'list':
        return block.ordered ? (
          <ol className="mt-4 max-w-[72ch] list-decimal space-y-1.5 pl-6 leading-7 text-muted-foreground" key={index}>
            {block.items.map((item, itemIndex) => <li key={itemIndex}><Inline segments={item} /></li>)}
          </ol>
        ) : (
          <ul className="mt-4 max-w-[72ch] list-disc space-y-1.5 pl-6 leading-7 text-muted-foreground" key={index}>
            {block.items.map((item, itemIndex) => <li key={itemIndex}><Inline segments={item} /></li>)}
          </ul>
        );
      case 'code':
        return (
          <div className="mt-5 overflow-hidden rounded-lg border border-border bg-card" key={index}>
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-1.5">
              <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{block.language}</span>
              <DocsCopyButton code={block.lines.join('\n')} />
            </div>
            <pre className="overflow-x-auto px-4 py-3 font-mono text-xs leading-6 text-foreground"><code>{block.lines.join('\n')}</code></pre>
          </div>
        );
      case 'quote':
        return (
          <blockquote className="mt-5 max-w-[72ch] border-l-2 border-primary pl-4 text-sm leading-7 text-muted-foreground" key={index}>
            <Inline segments={block.inline} />
          </blockquote>
        );
      case 'table':
        return (
          <div className="mt-5 overflow-x-auto rounded-lg border border-border" key={index}>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  {block.header.map((cell) => <th className="px-4 py-2 font-semibold text-foreground" key={cell}>{cell}</th>)}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr className="border-b border-border last:border-b-0" key={rowIndex}>
                    {row.map((cell, cellIndex) => <td className="px-4 py-2 align-top text-muted-foreground" key={cellIndex}>{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      default:
        return null;
    }
  });
}
