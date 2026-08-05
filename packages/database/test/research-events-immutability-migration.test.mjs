import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const migrationPath = fileURLToPath(new URL('../drizzle/0056_research_events_append_only.sql', import.meta.url));

test('M3-59 migration makes research_events append-only', async () => {
  const migration = await readFile(migrationPath, 'utf8');

  assert.match(migration, /CREATE OR REPLACE FUNCTION prevent_research_event_mutation\(\)/);
  assert.match(migration, /RAISE EXCEPTION 'research_events are append-only; % is not allowed'/);
  assert.match(migration, /BEFORE UPDATE OR DELETE ON research_events/);
  assert.match(migration, /EXECUTE FUNCTION prevent_research_event_mutation\(\)/);
});
