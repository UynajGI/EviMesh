import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const migrationPath = fileURLToPath(new URL('../drizzle/0061_claim_dependency_acyclic.sql', import.meta.url));

test('M3-64 migration rejects Claim depends_on cycles in the database', async () => {
  const migration = await readFile(migrationPath, 'utf8');

  assert.match(migration, /CREATE OR REPLACE FUNCTION assert_claim_dependency_acyclic\(\)/);
  assert.match(migration, /WITH RECURSIVE reachable\(claim_id\)/);
  assert.match(migration, /WHERE relation\.relation_type = 'depends_on'/);
  assert.match(migration, /WHERE reachable\.claim_id = NEW\.source_claim_id/);
  assert.match(migration, /RAISE EXCEPTION 'depends_on cycle detected/);
  assert.match(migration, /claim_relations_dependency_acyclic_trigger/);
  assert.match(migration, /BEFORE INSERT OR UPDATE OF source_claim_id, target_claim_id, relation_type/);
});
