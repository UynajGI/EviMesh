import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const workflowPath = fileURLToPath(new URL('../../../.github/workflows/validate.yml', import.meta.url));

test('M3-70 CI validates the Drizzle schema snapshot', async () => {
  const workflow = await readFile(workflowPath, 'utf8');

  assert.match(workflow, /pnpm --filter @evimesh\/database db:check/);
});
