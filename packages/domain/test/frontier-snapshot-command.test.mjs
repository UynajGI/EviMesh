import test from 'node:test';
import assert from 'node:assert/strict';
import { createFrontierSnapshot, FrontierSnapshotCommandError } from '../src/frontier-snapshot-command.mjs';

function repository(latest = null) {
  const calls = [];
  const repo = { calls, withTransaction: async (callback) => callback(repo), getProjectRevision: async () => ({ revision: 2 }), getMergeProposal: async () => ({ proposalId: 'proposal-1', status: 'ready' }), getLatestFrontierSnapshot: async () => latest, getFrontierSnapshotByProjectSequence: async (_projectId, sequence) => ({ sequence }), insertFrontierSnapshot: async (snapshot) => { calls.push(snapshot); return snapshot; }, appendResearchEvent: async (event) => event };
  return repo;
}
const input = { actorId: 'actor-1', actorRole: 'maintainer', snapshotId: 'frontier-2', projectId: 'project-1', sequence: 2, previousSequence: 1, projectRevision: 2, mergeProposalId: 'proposal-1', checkpoint: { auditRoot: 'sha256:abc' }, eventFactory: async (event) => event };

test('creates a FrontierSnapshot with a fixed immediately previous sequence and proposal', async () => {
  const result = await createFrontierSnapshot({ repository: repository({ snapshotId: 'frontier-1', sequence: 1 }), ...input });
  assert.deepEqual(result.snapshot.checkpoint, { auditRoot: 'sha256:abc', mergeProposalId: 'proposal-1' });
  assert.equal(result.event.eventType, 'frontier.created');
});

test('rejects a non-contiguous sequence or a proposal that is not ready', async () => {
  await assert.rejects(() => createFrontierSnapshot({ repository: repository({ sequence: 1 }), ...input, sequence: 3, previousSequence: 1 }), (error) => error instanceof FrontierSnapshotCommandError && error.code === 'FRONTIER_SEQUENCE_INVALID');
  const repo = repository({ sequence: 1 }); repo.getMergeProposal = async () => ({ status: 'blocked' });
  await assert.rejects(() => createFrontierSnapshot({ repository: repo, ...input }), (error) => error.code === 'MERGE_PROPOSAL_NOT_READY');
});
