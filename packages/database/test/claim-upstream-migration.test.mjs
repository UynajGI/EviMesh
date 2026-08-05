import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const migrationPath = fileURLToPath(new URL('../drizzle/0059_claim_upstream_recursive.sql', import.meta.url));

test('M3-62 migration exposes bounded recursive Claim upstream traversal', async () => {
  const migration = await readFile(migrationPath, 'utf8');

  assert.match(migration, /CREATE OR REPLACE FUNCTION claim_upstream_dependencies\(/);
  assert.match(migration, /RETURNS TABLE \(/);
  assert.match(migration, /WITH RECURSIVE upstream\(/);
  assert.match(migration, /relation\.relation_type = 'depends_on'/);
  assert.match(migration, /upstream\.depth < p_max_depth/);
  assert.match(migration, /NOT relation\.target_claim_id = ANY\(upstream\.path\)/);
  assert.match(migration, /GROUP BY upstream\.claim_id/);
});
