import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const migrationPath = fileURLToPath(new URL('../drizzle/0060_claim_downstream_recursive.sql', import.meta.url));

test('M3-63 migration exposes bounded recursive Claim downstream traversal', async () => {
  const migration = await readFile(migrationPath, 'utf8');

  assert.match(migration, /CREATE OR REPLACE FUNCTION claim_downstream_dependents\(/);
  assert.match(migration, /RETURNS TABLE \(/);
  assert.match(migration, /WITH RECURSIVE downstream\(/);
  assert.match(migration, /relation\.relation_type = 'depends_on'/);
  assert.match(migration, /downstream\.depth < p_max_depth/);
  assert.match(migration, /NOT relation\.source_claim_id = ANY\(downstream\.path\)/);
  assert.match(migration, /GROUP BY downstream\.claim_id/);
});
