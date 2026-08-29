/*
 * Constrained Markdown -> AST renderer for the docs product (docs-plan.md §3.2).
 * Docs content is a whitelist dialect: headings, paragraphs, lists, fenced
 * code, blockquotes, GFM tables, and inline code/bold/italic/links. No raw
 * HTML passes through - anything outside the dialect renders as plain text.
 */

/** Inline parse: `code`, **bold**, *italic*, [text](href). Returns segments. */
export function parseInline(text) {
  const segments = [];
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\([^)\s]+\))/g;
  let cursor = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) segments.push({ type: 'text', value: text.slice(cursor, match.index) });
    const token = match[0];
    if (token.startsWith('`')) segments.push({ type: 'code', value: token.slice(1, -1) });
    else if (token.startsWith('**')) segments.push({ type: 'bold', value: token.slice(2, -2) });
    else if (token.startsWith('*')) segments.push({ type: 'italic', value: token.slice(1, -1) });
    else {
      const link = token.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      segments.push({ type: 'link', text: link[1], href: link[2] });
    }
    cursor = match.index + token.length;
  }
  if (cursor < text.length) segments.push({ type: 'text', value: text.slice(cursor) });
  return segments;
}

function splitRow(line) {
  return line.replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
}

function isTableDivider(line) {
  return /^\|(\s*:?-{2,}:?\s*\|)+\s*:?-{2,}:?\s*\|?\s*$/.test(line.trim().replace(/\|/g, '|'));
}

/** Parse the whitelist dialect into a block AST. */
export function parseMarkdown(source) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim() === '') { index += 1; continue; }

    // Fenced code block.
    if (line.startsWith('```')) {
      const language = line.slice(3).trim();
      const body = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith('```')) {
        body.push(lines[index]);
        index += 1;
      }
      index += 1; // closing fence
      blocks.push({ type: 'code', language: language || 'text', lines: body });
      continue;
    }

    // Heading.
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2].trim() });
      index += 1;
      continue;
    }

    // Blockquote.
    if (line.startsWith('> ')) {
      const body = [];
      while (index < lines.length && lines[index].startsWith('> ')) {
        body.push(lines[index].slice(2));
        index += 1;
      }
      blocks.push({ type: 'quote', inline: parseInline(body.join(' ')) });
      continue;
    }

    // GFM table: header row, divider row, then body rows.
    if (line.includes('|') && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
      const header = splitRow(line);
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].includes('|') && lines[index].trim() !== '') {
        rows.push(splitRow(lines[index]));
        index += 1;
      }
      blocks.push({ type: 'table', header, rows });
      continue;
    }

    // Unordered list.
    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index])) {
        items.push(parseInline(lines[index].replace(/^[-*]\s+/, '')));
        index += 1;
      }
      blocks.push({ type: 'list', ordered: false, items });
      continue;
    }

    // Ordered list.
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        items.push(parseInline(lines[index].replace(/^\d+\.\s+/, '')));
        index += 1;
      }
      blocks.push({ type: 'list', ordered: true, items });
      continue;
    }

    // Paragraph: consume until blank line or a structural block starts.
    const paragraph = [];
    while (
      index < lines.length
      && lines[index].trim() !== ''
      && !lines[index].startsWith('```')
      && !/^#{1,4}\s/.test(lines[index])
      && !/^[-*]\s+/.test(lines[index])
      && !/^\d+\.\s+/.test(lines[index])
      && !lines[index].startsWith('> ')
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push({ type: 'paragraph', inline: parseInline(paragraph.join(' ')) });
  }

  return blocks;
}

/** Slug for heading anchors: lowercase, alphanumerics and hyphens. */
export function headingSlug(text) {
  return text.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '');
}

/** Headings of level 2-3, for the per-page table of contents. */
export function tableOfContents(blocks) {
  return blocks
    .filter((block) => block.type === 'heading' && (block.level === 2 || block.level === 3))
    .map((block) => ({ level: block.level, text: block.text, slug: headingSlug(block.text) }));
}
