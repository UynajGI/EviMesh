import { evaluateVerificationPolicy } from '../../../packages/protocol/src/verification-policy-engine.mjs';

export class PolicyEvaluationWorkerError extends Error {
  constructor(message, code = 'POLICY_EVALUATION_WORKER_INVALID') {
    super(message);
    this.name = 'PolicyEvaluationWorkerError';
    this.code = code;
  }
}

function requiredText(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new PolicyEvaluationWorkerError(`${field} must be a non-empty string`);
  return value.trim();
}

function supportedReceipts(receipts) { return receipts.filter((receipt) => receipt.outcome === 'supports'); }

/** Materialize one Claim's policy input from immutable receipts and findings. */
export async function evaluateClaimPolicyJob({ repository, claimId, policyId, policyRevision, now = new Date() } = {}) {
  const methods = ['getClaim', 'getVerificationPolicyRevision', 'listVerificationReceipts', 'listVerificationFindings'];
  if (!repository || methods.some((method) => typeof repository[method] !== 'function')) throw new PolicyEvaluationWorkerError('repository policy evaluation methods are required');
  claimId = requiredText(claimId, 'claim id'); policyId = requiredText(policyId, 'policy id');
  if (!Number.isInteger(policyRevision) || policyRevision < 1) throw new PolicyEvaluationWorkerError('policy revision must be a positive integer');
  const nowDate = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(nowDate.getTime())) throw new PolicyEvaluationWorkerError('evaluation time is invalid');

  const claim = await repository.getClaim(claimId);
  if (!claim) throw new PolicyEvaluationWorkerError('claim not found', 'CLAIM_NOT_FOUND');
  const policy = await repository.getVerificationPolicyRevision(policyId, policyRevision);
  if (!policy) throw new PolicyEvaluationWorkerError('policy revision not found', 'POLICY_REVISION_NOT_FOUND');
  const loadedReceipts = await repository.listVerificationReceipts({ claimId });
  const receipts = Array.isArray(loadedReceipts) ? loadedReceipts : [];
  const findings = (await Promise.all(receipts.map(async (receipt) => ({ receiptId: receipt.receiptId, findings: await repository.listVerificationFindings(receipt.receiptId) })))).flatMap(({ findings: values }) => Array.isArray(values) ? values : []);
  const supporting = supportedReceipts(receipts);
  const input = {};
  for (const key of Object.keys(policy.requirements)) {
    if (key === 'schema_gate') input[key] = 'pass';
    else if (key === 'blocking_findings') input[key] = findings.filter((finding) => finding.severity === 'critical' || finding.severity === 'major').length;
    else if (key === 'successful_reproductions') input[key] = supporting.length;
    else if (key === 'blind_reproductions') input[key] = supporting.filter((receipt) => receipt.contextMode === 'blind').length;
    else if (key === 'distinct_implementations') input[key] = new Set(supporting.map((receipt) => receipt.implementationId ?? receipt.runId)).size;
    else if (key === 'challenge_window_hours') {
      const createdAt = new Date(claim.createdAt).getTime();
      if (!Number.isFinite(createdAt)) throw new PolicyEvaluationWorkerError('claim createdAt is required for challenge window', 'CLAIM_TIMESTAMP_INVALID');
      input[key] = Math.max(0, (nowDate.getTime() - createdAt) / 3_600_000);
    } else throw new PolicyEvaluationWorkerError(`unsupported policy requirement: ${key}`, 'POLICY_REQUIREMENT_UNSUPPORTED');
  }
  input.refuting_receipts = receipts.filter((receipt) => receipt.outcome === 'refutes').length;
  return { claim, policy, evaluation: evaluateVerificationPolicy({ policy, input }) };
}
