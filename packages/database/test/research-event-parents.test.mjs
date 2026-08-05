import assert from 'node:assert/strict';
import test from 'node:test';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { getTableColumns } from 'drizzle-orm';
import { researchEventParents } from '../src/research-event-parents.mjs';

test('research_event_parents model non-self event ancestry edges', () => {
  const columns = getTableColumns(researchEventParents);
  assert.deepEqual(Object.keys(columns), ['eventId', 'parentEventId']);

  const config = getTableConfig(researchEventParents);
  assert.equal(config.primaryKeys[0].name, 'research_event_parents_pkey');
  assert.deepEqual(config.primaryKeys[0].columns.map((column) => column.name), [
    'event_id',
    'parent_event_id',
  ]);
  assert.equal(config.foreignKeys.length, 2);
  assert.equal(config.checks.length, 1);
});
