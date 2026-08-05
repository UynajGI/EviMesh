import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { frontierSnapshots } from '../src/frontier-snapshots.mjs';

test('frontier_snapshots preserve project revision and contiguous sequence', () => {
  const columns = getTableColumns(frontierSnapshots);
  const config = getTableConfig(frontierSnapshots);

  for (const [property, name] of [
    ['snapshotId', 'snapshot_id'],
    ['projectId', 'project_id'],
    ['sequence', 'sequence'],
    ['previousSequence', 'previous_sequence'],
    ['projectRevision', 'project_revision'],
    ['checkpoint', 'checkpoint'],
    ['createdBy', 'created_by'],
    ['createdAt', 'created_at'],
  ]) {
    assert.equal(columns[property].name, name);
  }

  assert.equal(columns.snapshotId.primary, true);
  assert.equal(config.foreignKeys.length, 4);
  assert.equal(config.checks.length, 3);
});
