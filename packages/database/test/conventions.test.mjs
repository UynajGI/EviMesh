import assert from 'node:assert/strict';
import test from 'node:test';
import { pgTable } from 'drizzle-orm/pg-core';
import { createLifecycleColumns } from '../src/index.mjs';

test('M3-03 lifecycle columns define timestamp and soft-delete semantics', () => {
  const table = pgTable('convention_probe', createLifecycleColumns());
  const columns = table[Symbol.for('drizzle:Columns')];

  assert.deepEqual(Object.keys(columns), ['createdAt', 'updatedAt', 'deletedAt']);
  assert.equal(columns.createdAt.name, 'created_at');
  assert.equal(columns.updatedAt.name, 'updated_at');
  assert.equal(columns.deletedAt.name, 'deleted_at');
  assert.equal(columns.createdAt.notNull, true);
  assert.equal(columns.updatedAt.notNull, true);
  assert.equal(columns.deletedAt.notNull, false);
  assert.equal(columns.createdAt.hasDefault, true);
  assert.equal(columns.updatedAt.hasDefault, true);
  assert.equal(columns.deletedAt.hasDefault, false);
});
