import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [workspace, receipt, page] = await Promise.all([
  readFile(new URL('../components/verification-workspace.js', import.meta.url), 'utf8'),
  readFile(new URL('../components/verification-receipt-form.js', import.meta.url), 'utf8'),
  readFile(new URL('../app/verification/receipt/new/page.js', import.meta.url), 'utf8'),
]);

test('verification UI is a read-only record plus local-signing handoff', () => {
  assert.match(workspace, /Verification authoring boundary/);
  assert.match(receipt, /sq verify submit/);
  assert.match(receipt, /human reviews and signs.*local device/i);
  assert.match(page, /ResearchWriteHandoff/);
  assert.doesNotMatch(workspace + receipt + page, /useState|<form|Submit verification<|method:\s*['"]POST|setSigned/);
});
