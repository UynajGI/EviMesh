import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { traceEvents } from '../src/trace-events.mjs';

test('trace_events preserve immutable signed Attempt trace records', () => {
  const columns = getTableColumns(traceEvents);
  const config = getTableConfig(traceEvents);

  assert.equal(columns.eventId.name, 'event_id');
  assert.equal(columns.eventId.primary, true);
  assert.equal(columns.attemptId.name, 'attempt_id');
  assert.equal(columns.attemptId.notNull, true);
  assert.equal(columns.eventType.name, 'event_type');
  assert.equal(columns.payload.name, 'payload');
  assert.equal(columns.hash.name, 'hash');
  assert.equal(columns.signature.name, 'signature');
  assert.equal(columns.parents.name, 'parents');
  assert.equal(columns.parents.hasDefault, true);
  assert.equal(columns.createdAt.name, 'created_at');
  assert.equal(columns.createdAt.notNull, true);
  assert.equal(columns.updatedAt, undefined);
  assert.equal(columns.deletedAt, undefined);
  assert.equal(config.checks.length, 2);
});
