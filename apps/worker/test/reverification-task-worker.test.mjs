import test from 'node:test';
import assert from 'node:assert/strict';
import { createReverificationTasksJob } from '../src/reverification-task-worker.mjs';

test('creates one re-verification Task per affected Claim and deduplicates existing work', async () => {
  const created = [];
  const repository = {
    getClaim: async (claimId) => ({ claimId, state: 'dependency_tainted' }),
    listReverificationTasksByClaim: async (claimId) => claimId === 'claim-existing' ? [{ taskId: 'task-existing' }] : [],
    createReverificationTask: async (task) => { created.push(task); return task; },
  };
  const result = await createReverificationTasksJob({
    repository,
    sourceClaimId: 'claim-source',
    impactedClaimIds: ['claim-new', 'claim-existing', 'claim-source', 'claim-new'],
    taskIdFactory: ({ claimId }) => `reverify-${claimId}`,
  });
  assert.deepEqual(created, [{ taskId: 'reverify-claim-new', claimId: 'claim-new', sourceClaimId: 'claim-source' }]);
  assert.deepEqual(result.createdTasks, created);
});
