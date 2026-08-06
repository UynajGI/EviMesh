import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const migrationPath = fileURLToPath(new URL('../drizzle/0072_published_frontier_immutable.sql', import.meta.url));

test('M8-38 rejects UPDATE and DELETE after frontier.published', async () => {
  const migration = await readFile(migrationPath, 'utf8');
  assert.match(migration, /CREATE OR REPLACE FUNCTION prevent_published_frontier_mutation\(\)/);
  assert.match(migration, /event_type = 'frontier\.published'/);
  assert.match(migration, /payload ->> 'snapshot_id' = OLD\.snapshot_id/);
  assert.match(migration, /BEFORE UPDATE OR DELETE ON frontier_snapshots/);
  assert.match(migration, /BEFORE INSERT OR UPDATE OR DELETE ON frontier_members/);
  assert.match(migration, /RAISE EXCEPTION 'published frontier snapshots are immutable; % is not allowed'/);
});
