import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [panel, page] = await Promise.all([
  readFile(new URL('../components/artifact-upload-panel.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/artifacts/upload/page.js', import.meta.url), 'utf8'),
]);

test('artifact upload is a local CLI or Agent handoff, never a browser transfer', () => {
  assert.match(panel, /sq evidence add/);
  assert.match(panel, /public website does not receive research files/);
  assert.doesNotMatch(panel, /method:\s*['"]POST|<input|<form|crypto\.subtle|XMLHttpRequest/);
  assert.match(page, /ResearchWriteHandoff/);
});
