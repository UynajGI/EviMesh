import assert from 'node:assert/strict';
import test from 'node:test';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { notifications } from '../src/notifications.mjs';

test('notifications provide an idempotent actor inbox for research events', () => {
  const columns = getTableColumns(notifications);
  assert.deepEqual(Object.keys(columns), [
    'notificationId',
    'recipientActorId',
    'eventId',
    'notificationType',
    'payload',
    'readAt',
    'createdAt',
  ]);
  assert.equal(columns.notificationId.primary, true);
  assert.equal(columns.readAt.notNull, false);

  const config = getTableConfig(notifications);
  assert.equal(config.foreignKeys.length, 2);
  assert.equal(config.indexes.length, 1);
  assert.equal(config.uniqueConstraints.length, 1);
  assert.equal(config.checks.length, 1);
});
