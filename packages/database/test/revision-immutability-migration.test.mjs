import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const migrationPath = fileURLToPath(new URL('../drizzle/0057_revision_append_only.sql', import.meta.url));
const revisionTables = [
  'project_revisions',
  'question_revisions',
  'research_contract_revisions',
  'task_revisions',
  'claim_revisions',
  'artifact_revisions',
  'verification_contract_revisions',
  'verification_policy_revisions',
  'challenge_revisions',
];

test('M3-60 migration makes every revision projection append-only', async () => {
  const migration = await readFile(migrationPath, 'utf8');

  assert.match(migration, /CREATE OR REPLACE FUNCTION prevent_revision_mutation\(\)/);
  assert.match(migration, /RAISE EXCEPTION '% is append-only; % is not allowed'/);

  for (const table of revisionTables) {
    assert.match(migration, new RegExp(`BEFORE UPDATE OR DELETE ON ${table}`));
    assert.match(migration, new RegExp(`${table}_append_only_trigger`));
  }
});
