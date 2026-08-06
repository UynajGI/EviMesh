import test from 'node:test';
import assert from 'node:assert/strict';
import { getMergeProposal, MergeProposalQueryError } from '../src/merge-proposal-query.mjs';

test('returns satisfied and unsatisfied conditions from a pinned MergeProposal evaluation', async () => {
  const proposal = { proposalId: 'proposal-1', evaluation: { requirement_results: [{ key: 'blind_reproductions', met: true }, { key: 'blocking_findings', met: false }] } };
  const result = await getMergeProposal({ repository: { getMergeProposal: async () => proposal }, proposalId: 'proposal-1' });
  assert.deepEqual(result.conditions.satisfied, [{ key: 'blind_reproductions', met: true, status: 'satisfied' }]);
  assert.deepEqual(result.conditions.unsatisfied, [{ key: 'blocking_findings', met: false, status: 'unsatisfied' }]);
});

test('rejects a missing MergeProposal', async () => {
  await assert.rejects(() => getMergeProposal({ repository: { getMergeProposal: async () => null }, proposalId: 'proposal-missing' }), (error) => error instanceof MergeProposalQueryError && error.code === 'MERGE_PROPOSAL_NOT_FOUND');
});
