import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const migrationPath = fileURLToPath(new URL('../drizzle/0000_enable-postgresql-extensions.sql', import.meta.url));

test('M3-02 migration enables required PostgreSQL extensions idempotently', async () => {
  const migration = await readFile(migrationPath, 'utf8');

  assert.match(migration, /CREATE EXTENSION IF NOT EXISTS "pgcrypto";/);
  assert.match(migration, /CREATE EXTENSION IF NOT EXISTS "uuid-ossp";/);
});
