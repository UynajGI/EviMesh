import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { frontierMembers } from '../src/frontier-members.mjs';

test('frontier_members pin Claim revisions into an immutable snapshot', () => {
  const columns = getTableColumns(frontierMembers);
  const config = getTableConfig(frontierMembers);

  for (const [property, name] of [
    ['snapshotId', 'snapshot_id'],
    ['claimId', 'claim_id'],
    ['claimRevision', 'claim_revision'],
    ['membershipType', 'membership_type'],
    ['createdAt', 'created_at'],
  ]) {
    assert.equal(columns[property].name, name);
  }

  assert.equal(config.primaryKeys[0].name, 'frontier_members_pkey');
  assert.deepEqual(config.primaryKeys[0].columns.map((column) => column.name), [
    'snapshot_id', 'claim_id', 'claim_revision',
  ]);
  assert.equal(config.foreignKeys.length, 2);
  assert.equal(config.checks.length, 1);
});
