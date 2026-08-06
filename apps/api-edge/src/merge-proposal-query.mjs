export class MergeProposalQueryError extends Error {
  constructor(message, code = 'MERGE_PROPOSAL_QUERY_INVALID', status = 400) {
    super(message);
    this.name = 'MergeProposalQueryError';
    this.code = code;
    this.status = status;
  }
}

function requiredId(value) {
  if (typeof value !== 'string' || !value.trim()) throw new MergeProposalQueryError('proposal id must be a non-empty string');
  return value.trim();
}

/** Return a pinned MergeProposal with explicit satisfied and unsatisfied policy conditions. */
export async function getMergeProposal({ repository, proposalId } = {}) {
  if (!repository || typeof repository.getMergeProposal !== 'function') throw new MergeProposalQueryError('repository getMergeProposal is required');
  proposalId = requiredId(proposalId);
  const proposal = await repository.getMergeProposal(proposalId);
  if (!proposal) throw new MergeProposalQueryError('merge proposal not found', 'MERGE_PROPOSAL_NOT_FOUND', 404);
  const requirements = Array.isArray(proposal.evaluation?.requirement_results) ? proposal.evaluation.requirement_results : [];
  const conditions = requirements.map((requirement) => ({ ...requirement, status: requirement.met ? 'satisfied' : 'unsatisfied' }));
  return {
    proposal,
    conditions: {
      satisfied: conditions.filter((condition) => condition.status === 'satisfied'),
      unsatisfied: conditions.filter((condition) => condition.status === 'unsatisfied'),
    },
  };
}
