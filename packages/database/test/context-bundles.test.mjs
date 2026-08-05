import assert from 'node:assert/strict';
import test from 'node:test';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { contextBundles } from '../src/context-bundles.mjs';

test('context_bundles pin a task revision and context compilation result', () => {
  const columns = getTableColumns(contextBundles);
  assert.deepEqual(Object.keys(columns), [
    'contextBundleId',
    'taskId',
    'taskRevision',
    'frontierSnapshotId',
    'mode',
    'manifest',
    'contentHash',
    'storageUri',
    'createdAt',
  ]);

  const config = getTableConfig(contextBundles);
  assert.equal(columns.contextBundleId.primary, true);
  assert.equal(config.foreignKeys.length, 2);
  assert.equal(config.checks.length, 3);
});
