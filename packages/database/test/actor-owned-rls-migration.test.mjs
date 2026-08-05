import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const migrationPath = fileURLToPath(new URL('../drizzle/0064_actor_owned_rls.sql', import.meta.url));

test('M3-67 migration scopes profile, signing key, and API token access to the authenticated actor', async () => {
  const migration = await readFile(migrationPath, 'utf8');

  for (const table of ['actor_profiles', 'signing_keys', 'api_tokens']) {
    assert.match(migration, new RegExp(`'${table}'`));
    assert.match(migration, new RegExp(`'actor_owned_' \\|\\| table_name`));
  }
  assert.match(migration, /rolname = 'authenticated'/);
  assert.match(migration, /to_regprocedure\('auth\.uid\(\)'\)/);
  assert.match(migration, /FOR ALL TO authenticated/);
  assert.match(migration, /identity\.subject = auth\.uid\(\)::text/);
  assert.match(migration, /WITH CHECK/);
  assert.doesNotMatch(migration, /TO anon/);
});
