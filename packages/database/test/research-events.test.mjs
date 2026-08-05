import assert from 'node:assert/strict';
import test from 'node:test';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { researchEvents } from '../src/research-events.mjs';

test('research_events persist signed, hash-addressed event envelopes', () => {
  const columns = getTableColumns(researchEvents);
  assert.deepEqual(Object.keys(columns), [
    'eventId',
    'eventType',
    'payload',
    'hash',
    'signature',
    'parents',
    'createdAt',
  ]);
  assert.equal(columns.eventId.primary, true);
  assert.equal(columns.parents.hasDefault, true);

  const config = getTableConfig(researchEvents);
  assert.equal(config.checks.length, 3);
});
