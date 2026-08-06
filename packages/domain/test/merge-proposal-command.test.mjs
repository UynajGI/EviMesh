import test from 'node:test';
import assert from 'node:assert/strict';
import { createMergeProposal, MergeProposalCommandError } from '../src/merge-proposal-command.mjs';

function repository() {
  const calls = [];
  const repo = {
    calls,
    withTransaction: async (callback) => callback(repo),
    getClaimRevision: async (claimId, revision) => ({ claimId, revision }),
    getVerificationPolicyRevision: async (policyId, revision) => ({ policyId, revision }),
    insertMergeProposal: async (proposal) => { calls.push(['proposal', proposal]); return proposal; },
    appendResearchEvent: async (event) => { calls.push(['event', event]); return event; },
  };
  return repo;
}

const evaluation = { policy_id: 'policy-1', revision: 2, requirements_met: true, requirement_results: [] };

test('pins a MergeProposal to exact Claim and Policy revisions', async () => {
  const repo = repository();
  const result = await createMergeProposal({ repository: repo, actorId: 'actor-1', actorRole: 'maintainer', proposalId: 'proposal-1', claimId: 'claim-1', claimRevision: 3, policyId: 'policy-1', policyRevision: 2, evaluation, eventFactory: async (event) => event });
  assert.deepEqual(result.proposal, { proposalId: 'proposal-1', claimId: 'claim-1', claimRevision: 3, policyId: 'policy-1', policyRevision: 2, status: 'ready', evaluation, createdBy: 'actor-1' });
  assert.equal(result.event.eventType, 'merge_proposal.created');
});

test('fails closed when a pinned revision or policy evaluation is unavailable', async () => {
  const repo = repository();
  repo.getClaimRevision = async () => null;
  await assert.rejects(() => createMergeProposal({ repository: repo, actorId: 'actor-1', actorRole: 'maintainer', proposalId: 'proposal-1', claimId: 'claim-1', claimRevision: 3, policyId: 'policy-1', policyRevision: 2, evaluation, eventFactory: async (event) => event }), (error) => error instanceof MergeProposalCommandError && error.code === 'CLAIM_REVISION_NOT_FOUND');
  await assert.rejects(() => createMergeProposal({ repository: repository(), actorId: 'actor-1', actorRole: 'maintainer', proposalId: 'proposal-1', claimId: 'claim-1', claimRevision: 3, policyId: 'policy-1', policyRevision: 2, evaluation: { ...evaluation, revision: 1 }, eventFactory: async (event) => event }), MergeProposalCommandError);
});
