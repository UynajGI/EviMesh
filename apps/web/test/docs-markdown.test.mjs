import test from 'node:test';
import assert from 'node:assert/strict';
import { headingSlug, parseInline, parseMarkdown, tableOfContents } from '../lib/docs-markdown.mjs';

test('inline parsing covers code, bold, italic, links, and plain text', () => {
  assert.deepEqual(parseInline('plain words'), [{ type: 'text', value: 'plain words' }]);
  assert.deepEqual(parseInline('run `sq verify` now'), [
    { type: 'text', value: 'run ' },
    { type: 'code', value: 'sq verify' },
    { type: 'text', value: ' now' },
  ]);
  assert.deepEqual(parseInline('**must** sign'), [
    { type: 'bold', value: 'must' },
    { type: 'text', value: ' sign' },
  ]);
  const segments = parseInline('see [the reference](/docs/reference/api) *first*');
  assert.deepEqual(segments[0], { type: 'text', value: 'see ' });
  assert.deepEqual(segments[1], { type: 'link', text: 'the reference', href: '/docs/reference/api' });
  assert.deepEqual(segments[2], { type: 'text', value: ' ' });
  assert.deepEqual(segments[3], { type: 'italic', value: 'first' });
});

test('headings, code fences, and quotes become typed blocks', () => {
  const blocks = parseMarkdown('## Two\n\n```bash\nsq status\n```\n\n> quoted note');
  assert.equal(blocks[0].type, 'heading');
  assert.equal(blocks[0].level, 2);
  assert.equal(blocks[1].type, 'code');
  assert.equal(blocks[1].language, 'bash');
  assert.deepEqual(blocks[1].lines, ['sq status']);
  assert.equal(blocks[2].type, 'quote');
});

test('lists keep order and items parse inline segments', () => {
  const blocks = parseMarkdown('- one `a`\n- two\n\n1. first\n2. second');
  assert.equal(blocks[0].type, 'list');
  assert.equal(blocks[0].ordered, false);
  assert.deepEqual(blocks[0].items[0][0], { type: 'text', value: 'one ' });
  assert.equal(blocks[1].type, 'list');
  assert.equal(blocks[1].ordered, true);
});

test('gfm tables parse header, divider, and body rows', () => {
  const blocks = parseMarkdown('| Object | Stable id |\n| --- | --- |\n| Claim | claim-a1b2 |\n| Run | run-demo-1 |');
  assert.equal(blocks[0].type, 'table');
  assert.deepEqual(blocks[0].header, ['Object', 'Stable id']);
  assert.deepEqual(blocks[0].rows, [['Claim', 'claim-a1b2'], ['Run', 'run-demo-1']]);
});

test('paragraphs stop at structural blocks', () => {
  const blocks = parseMarkdown('first para line\nsecond line\n\n## Next\n- item');
  assert.equal(blocks[0].type, 'paragraph');
  assert.equal(blocks[0].inline[0].value.includes('second line'), true);
  assert.equal(blocks[1].type, 'heading');
  assert.equal(blocks[2].type, 'list');
});

test('tableOfContents returns only level 2-3 headings with slugs', () => {
  const toc = tableOfContents(parseMarkdown('# Top\n## Alpha\n### Beta gamma\n#### skipped'));
  assert.deepEqual(toc, [
    { level: 2, text: 'Alpha', slug: 'alpha' },
    { level: 3, text: 'Beta gamma', slug: 'beta-gamma' },
  ]);
});

test('headingSlug keeps cjk characters and collapses punctuation', () => {
  assert.equal(headingSlug('Claim lifecycle'), 'claim-lifecycle');
  assert.equal(headingSlug('状态与转移'), '状态与转移');
  assert.equal(headingSlug('What / Why?'), 'what-why');
});
