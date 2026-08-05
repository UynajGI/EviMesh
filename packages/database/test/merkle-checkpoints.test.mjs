import assert from 'node:assert/strict';
import test from 'node:test';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { merkleCheckpoints } from '../src/merkle-checkpoints.mjs';

test('merkle_checkpoints persist signed roots for contiguous event ranges', () => {
  const columns = getTableColumns(merkleCheckpoints);
  assert.deepEqual(Object.keys(columns), [
    'checkpointId',
    'firstEventId',
    'lastEventId',
    'eventCount',
    'rootHash',
    'signature',
    'createdAt',
  ]);
  assert.equal(columns.checkpointId.primary, true);
  assert.equal(columns.eventCount.notNull, true);

  const config = getTableConfig(merkleCheckpoints);
  assert.equal(config.foreignKeys.length, 2);
  assert.equal(config.checks.length, 2);
});
