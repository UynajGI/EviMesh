import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [page, handoff] = await Promise.all([
  readFile(new URL('../app/claims/new/page.js', import.meta.url), 'utf8'),
  readFile(new URL('../components/research-write-handoff.js', import.meta.url), 'utf8'),
]);

test('claim authoring uses the shared local-signing handoff', () => {
  assert.match(page, /sq claim create/);
  assert.match(page, /ResearchWriteHandoff/);
  assert.match(handoff, /Agents prepare\. Humans sign locally/);
  assert.match(handoff, /Open Agent connection/);
  assert.doesNotMatch(page + handoff, /indexedDB|<form|method:\s*['"]POST|Review and sign/);
});
