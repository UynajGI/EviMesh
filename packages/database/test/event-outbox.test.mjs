import assert from 'node:assert/strict';
import test from 'node:test';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { eventOutbox, eventOutboxStatus } from '../src/event-outbox.mjs';

test('event_outbox provides unique, retryable transactional event jobs', () => {
  const columns = getTableColumns(eventOutbox);
  assert.deepEqual(Object.keys(columns), [
    'outboxId',
    'eventId',
    'status',
    'attempts',
    'availableAt',
    'lockedAt',
    'processedAt',
    'lastError',
    'createdAt',
  ]);
  assert.equal(columns.outboxId.primary, true);
  assert.equal(columns.status.hasDefault, true);
  assert.equal(columns.attempts.hasDefault, true);
  assert.deepEqual(eventOutboxStatus.enumValues, ['pending', 'processing', 'processed', 'dead_letter']);

  const config = getTableConfig(eventOutbox);
  assert.equal(config.foreignKeys.length, 1);
  assert.equal(config.indexes.length, 1);
  assert.equal(config.uniqueConstraints.length, 1);
  assert.equal(config.checks.length, 1);
});
