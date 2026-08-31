import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../app/challenges/new/page.js', import.meta.url), 'utf8');

test('challenge authoring hands a forward research object to CLI or MCP', () => {
  assert.match(source, /ResearchWriteHandoff/);
  assert.match(source, /sq challenge create/);
  assert.match(source, /new downstream research object/);
  assert.doesNotMatch(source, /useState|<form|method:\s*['"]POST|signature/);
});
