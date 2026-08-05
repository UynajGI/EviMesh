import assert from 'node:assert/strict';
import test from 'node:test';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { artifacts } from '../src/artifacts.mjs';

test('artifacts provide stable identity with ownership and lifecycle columns', () => {
  const columns = getTableColumns(artifacts);
  const config = getTableConfig(artifacts);

  assert.deepEqual(Object.keys(columns), [
    'artifactId',
    'createdBy',
    'createdAt',
    'updatedAt',
    'deletedAt',
  ]);
  assert.equal(columns.artifactId.name, 'artifact_id');
  assert.equal(columns.artifactId.primary, true);
  assert.equal(columns.createdBy.name, 'created_by');
  assert.equal(columns.createdBy.notNull, true);
  assert.equal(columns.createdAt.name, 'created_at');
  assert.equal(columns.updatedAt.name, 'updated_at');
  assert.equal(columns.deletedAt.name, 'deleted_at');
  assert.equal(config.primaryKeys.length, 0);
});
