import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const migrationPath = fileURLToPath(new URL('../drizzle/0062_public_table_rls_default.sql', import.meta.url));

test('M3-65 migration enables RLS on existing and newly created public tables', async () => {
  const migration = await readFile(migrationPath, 'utf8');

  assert.match(migration, /CREATE OR REPLACE FUNCTION enable_public_table_rls\(\)/);
  assert.match(migration, /pg_event_trigger_ddl_commands\(\)/);
  assert.match(migration, /command_tag = 'CREATE TABLE'/);
  assert.match(migration, /schema_name = 'public'/);
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /CREATE EVENT TRIGGER public_table_rls_default_trigger/);
  assert.match(migration, /ON ddl_command_end/);
  assert.match(migration, /WHEN TAG IN \('CREATE TABLE'\)/);
});
