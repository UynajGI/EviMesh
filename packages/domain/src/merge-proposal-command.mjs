import { assertProjectRoleForAction } from './project-authorization.mjs';

export class MergeProposalCommandError extends Error {
  constructor(message, code = 'MERGE_PROPOSAL_INVALID', status = 400) {
    super(message);
    this.name = 'MergeProposalCommandError';
    this.code = code;
    this.status = status;
  }
}

function text(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new MergeProposalCommandError(`${field} must be a non-empty string`);
  return value.trim();
}

function positive(value, field) {
  if (!Number.isInteger(value) || value < 1) throw new MergeProposalCommandError(`${field} must be a positive integer`);
  return value;
}

/** Create an auditable proposal pinned to immutable Claim and Policy revisions. */
export async function createMergeProposal({ repository, actorId, actorRole, proposalId, claimId, claimRevision, policyId, policyRevision, evaluation, eventFactory } = {}) {
  const methods = ['withTransaction', 'getClaimRevision', 'getVerificationPolicyRevision', 'insertMergeProposal', 'appendResearchEvent'];
  if (!repository || methods.some((method) => typeof repository[method] !== 'function')) throw new MergeProposalCommandError('repository merge proposal methods are required');
  proposalId = text(proposalId, 'proposal id'); actorId = text(actorId, 'actor id'); claimId = text(claimId, 'claim id'); policyId = text(policyId, 'policy id');
  claimRevision = positive(claimRevision, 'claim revision'); policyRevision = positive(policyRevision, 'policy revision');
  if (!evaluation || typeof evaluation !== 'object' || evaluation.policy_id !== policyId || evaluation.revision !== policyRevision || !Array.isArray(evaluation.requirement_results)) {
    throw new MergeProposalCommandError('evaluation must match the pinned policy revision');
  }
  if (typeof eventFactory !== 'function') throw new MergeProposalCommandError('eventFactory is required');
  assertProjectRoleForAction({ actorRole, requiredRole: 'maintainer' });

  return repository.withTransaction(async (transaction) => {
    const revision = await transaction.getClaimRevision(claimId, claimRevision);
    if (!revision) throw new MergeProposalCommandError('claim revision not found', 'CLAIM_REVISION_NOT_FOUND', 404);
    const policy = await transaction.getVerificationPolicyRevision(policyId, policyRevision);
    if (!policy) throw new MergeProposalCommandError('policy revision not found', 'POLICY_REVISION_NOT_FOUND', 404);
    const proposal = { proposalId, claimId, claimRevision, policyId, policyRevision, status: evaluation.requirements_met ? 'ready' : 'blocked', evaluation, createdBy: actorId };
    const event = await eventFactory({ eventType: 'merge_proposal.created', payload: { entity_type: 'merge_proposal', proposal_id: proposalId, claim_id: claimId, claim_revision: claimRevision, policy_id: policyId, policy_revision: policyRevision, actor_id: actorId } });
    if (!event || typeof event !== 'object') throw new MergeProposalCommandError('eventFactory must return an event object');
    return { proposal: await transaction.insertMergeProposal(proposal) ?? proposal, event: await transaction.appendResearchEvent(event) ?? event };
  });
}
