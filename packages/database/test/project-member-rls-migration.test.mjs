import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const migrationPath = fileURLToPath(new URL('../drizzle/0065_project_member_rls.sql', import.meta.url));

test('M3-68 migration limits project membership reads to the authenticated actor', async () => {
  const migration = await readFile(migrationPath, 'utf8');

  assert.match(migration, /CREATE POLICY project_member_read_own_memberships ON project_members/);
  assert.match(migration, /FOR SELECT TO authenticated/);
  assert.match(migration, /identity\.actor_id = project_members\.actor_id/);
  assert.match(migration, /identity\.subject = auth\.uid\(\)::text/);
  assert.match(migration, /to_regprocedure\('auth\.uid\(\)'\)/);
  assert.doesNotMatch(migration, /TO anon/);
  assert.doesNotMatch(migration, /FOR (?:INSERT|UPDATE|DELETE|ALL) TO authenticated/);
});
