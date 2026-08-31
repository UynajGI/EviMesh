import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../app/runs/new/page.js', import.meta.url), 'utf8');

test('run recording moves to CLI or MCP and keeps the web read-only', () => {
  assert.match(source, /sq run record/);
  assert.match(source, /ResearchWriteHandoff/);
  assert.doesNotMatch(source, /useState|<form|indexedDB|method:\s*['"]POST/);
});
