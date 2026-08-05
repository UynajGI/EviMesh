import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { taskLeases } from '../src/task-leases.mjs';

test('task_leases are non-exclusive, expiring TaskLease markers', () => {
  const columns = getTableColumns(taskLeases);
  const config = getTableConfig(taskLeases);

  assert.equal(columns.taskId.name, 'task_id');
  assert.equal(columns.holderActorId.name, 'holder_actor_id');
  assert.equal(columns.acquiredAt.name, 'acquired_at');
  assert.equal(columns.acquiredAt.notNull, true);
  assert.equal(columns.expiresAt.name, 'expires_at');
  assert.equal(columns.expiresAt.notNull, true);
  assert.equal(columns.lastRenewedAt.name, 'last_renewed_at');
  assert.equal(columns.createdAt.name, 'created_at');
  assert.equal(columns.updatedAt.name, 'updated_at');
  assert.equal(columns.deletedAt.name, 'deleted_at');
  assert.equal(config.primaryKeys[0].name, 'task_leases_pkey');
  assert.deepEqual(config.primaryKeys[0].columns.map((column) => column.name), ['task_id', 'holder_actor_id']);
});
