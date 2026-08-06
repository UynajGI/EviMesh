import test from 'node:test';
import assert from 'node:assert/strict';
import { diffFrontiers, getLatestFrontier, listFrontierHistory, FrontierQueryError } from '../src/frontier-query.mjs';

test('returns the FrontierSnapshot with the maximum project sequence', async () => {
  const sequence = [];
  const result = await getLatestFrontier({ repository: { listFrontierSnapshots: async (filters) => { sequence.push(filters); return [{ snapshotId: 'frontier-2', sequence: 2 }, { snapshotId: 'frontier-7', sequence: 7 }, { snapshotId: 'frontier-4', sequence: 4 }]; } }, projectId: 'project-1' });
  assert.deepEqual(sequence, [{ projectId: 'project-1' }]);
  assert.deepEqual(result, { snapshotId: 'frontier-7', sequence: 7 });
});

test('returns null before a project has a genesis Frontier and fails closed for malformed sequences', async () => {
  assert.equal(await getLatestFrontier({ repository: { listFrontierSnapshots: async () => [] }, projectId: 'project-1' }), null);
  await assert.rejects(() => getLatestFrontier({ repository: { listFrontierSnapshots: async () => [{ sequence: 0 }] }, projectId: 'project-1' }), (error) => error instanceof FrontierQueryError && error.code === 'FRONTIER_SEQUENCE_INVALID');
});

test('pages immutable Frontier history with a stable opaque cursor', async () => {
  const repository = { listFrontierSnapshots: async () => [
    { snapshotId: 'frontier-3', sequence: 3, createdAt: '2026-01-03T00:00:00.000Z' },
    { snapshotId: 'frontier-1', sequence: 1, createdAt: '2026-01-01T00:00:00.000Z' },
    { snapshotId: 'frontier-2', sequence: 2, createdAt: '2026-01-02T00:00:00.000Z' },
  ] };
  const first = await listFrontierHistory({ repository, projectId: 'project-1', limit: 2 });
  const second = await listFrontierHistory({ repository, projectId: 'project-1', limit: 2, cursor: first.nextCursor });
  assert.deepEqual(first.items.map((snapshot) => snapshot.sequence), [1, 2]);
  assert.deepEqual(second.items.map((snapshot) => snapshot.sequence), [3]);
  assert.equal(second.nextCursor, null);
});

test('diffs fixed Frontier members into added, removed, and status-changed groups', async () => {
  const repository = {
    getFrontierSnapshot: async (snapshotId) => ({ snapshotId, projectId: 'project-1' }),
    listFrontierMembers: async (snapshotId) => snapshotId === 'frontier-old'
      ? [{ claimId: 'claim-removed', claimRevision: 1, membershipType: 'supporting' }, { claimId: 'claim-state', claimRevision: 1, membershipType: 'supporting' }]
      : [{ claimId: 'claim-added', claimRevision: 2, membershipType: 'supporting' }, { claimId: 'claim-state', claimRevision: 2, membershipType: 'contested' }],
  };
  const result = await diffFrontiers({ repository, fromSnapshotId: 'frontier-old', toSnapshotId: 'frontier-new' });
  assert.deepEqual(result.added, [{ claimId: 'claim-added', revision: 2, status: 'supporting' }]);
  assert.deepEqual(result.removed, [{ claimId: 'claim-removed', revision: 1, status: 'supporting' }]);
  assert.deepEqual(result.statusChanged, [{ claimId: 'claim-state', from: { claimId: 'claim-state', revision: 1, status: 'supporting' }, to: { claimId: 'claim-state', revision: 2, status: 'contested' } }]);
});
