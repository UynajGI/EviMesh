import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../app/questions/new/page.js', import.meta.url), 'utf8');

test('question authoring is absent from the public reading surface', () => {
  assert.match(source, /ResearchWriteHandoff/);
  assert.match(source, /CLI or MCP/);
  assert.doesNotMatch(source, /useState|<form|method:\s*['"]POST|Preview Question/);
});
