export class PolicyEvaluationCommandError extends Error {
  constructor(message, code = 'POLICY_EVALUATION_INVALID', status = 400) { super(message); this.name = 'PolicyEvaluationCommandError'; this.code = code; this.status = status; }
}

function text(value, field) { if (typeof value !== 'string' || !value.trim()) throw new PolicyEvaluationCommandError(`${field} must be a non-empty string`); return value.trim(); }
function positive(value, field) { if (!Number.isInteger(value) || value < 1) throw new PolicyEvaluationCommandError(`${field} must be a positive integer`); return value; }

/** Persist an auditable result bound to the exact Policy revision and materialized input. */
export async function recordPolicyEvaluation({ repository, evaluationId, claimId, policyId, policyRevision, evaluation } = {}) {
  if (!repository || typeof repository.withTransaction !== 'function' || typeof repository.insertPolicyEvaluation !== 'function') throw new PolicyEvaluationCommandError('repository policy evaluation methods are required');
  evaluationId = text(evaluationId, 'evaluation id'); claimId = text(claimId, 'claim id'); policyId = text(policyId, 'policy id'); policyRevision = positive(policyRevision, 'policy revision');
  if (!evaluation || typeof evaluation !== 'object' || evaluation.policy_id !== policyId || evaluation.revision !== policyRevision || !evaluation.input || !Array.isArray(evaluation.requirement_results)) throw new PolicyEvaluationCommandError('evaluation must match the immutable policy revision');
  const record = { evaluationId, claimId, policyId, policyRevision, inputSummary: evaluation.input, result: { requirementsMet: evaluation.requirements_met, recommendedOutcome: evaluation.recommended_outcome, requirementResults: evaluation.requirement_results } };
  return repository.withTransaction(async (transaction) => await transaction.insertPolicyEvaluation(record) ?? record);
}
