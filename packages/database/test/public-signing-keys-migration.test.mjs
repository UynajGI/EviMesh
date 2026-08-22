import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const migrationPath = fileURLToPath(new URL('../drizzle/0078_public_active_signing_keys.sql', import.meta.url));

test('public signing-key reads are active-only and portable beyond Supabase', async () => {
  const migration = await readFile(migrationPath, 'utf8');

  assert.match(migration, /rolname = 'anon'/);
  assert.match(migration, /rolname = 'authenticated'/);
  assert.match(migration, /FOR SELECT TO anon, authenticated/);
  assert.match(migration, /"revoked_at" IS NULL/);
  assert.match(migration, /"deleted_at" IS NULL/);
});
