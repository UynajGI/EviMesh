import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const migrationPath = fileURLToPath(new URL('../drizzle/0066_rls_active_row_fixes.sql', import.meta.url));

test('review fix migration hides tombstoned public rows and exposes only the caller identity', async () => {
  const migration = await readFile(migrationPath, 'utf8');

  assert.match(migration, /CREATE POLICY identities_read_own_subject ON identities/);
  assert.match(migration, /subject = auth\.uid\(\)::text/);
  assert.match(migration, /CREATE POLICY %I ON %I FOR SELECT TO anon USING \(deleted_at IS NULL\)/);
  assert.match(migration, /DROP POLICY IF EXISTS/);
  assert.match(migration, /'projects'/);
  assert.match(migration, /'claim_relations'/);
});
