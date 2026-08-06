import test from 'node:test';
import assert from 'node:assert/strict';
import { getLatestFrontier, FrontierQueryError } from '../src/frontier-query.mjs';

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
