import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const migrationPath = fileURLToPath(new URL('../drizzle/0067_claim_graph_ignore_deleted_edges.sql', import.meta.url));

test('review fix migration ignores deleted dependency edges in every Claim graph operation', async () => {
  const migration = await readFile(migrationPath, 'utf8');

  assert.match(migration, /CREATE OR REPLACE FUNCTION claim_upstream_dependencies/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION claim_downstream_dependents/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION assert_claim_dependency_acyclic/);
  assert.ok((migration.match(/relation\.deleted_at IS NULL/g) ?? []).length >= 5);
  assert.match(migration, /NEW\.deleted_at IS NULL/);
});
