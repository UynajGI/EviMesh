import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateClaimPolicyJob, PolicyEvaluationWorkerError } from '../src/policy-evaluation-worker.mjs';

function repository() {
  const receipts = [
    { receiptId: 'receipt-1', runId: 'run-1', outcome: 'supports', contextMode: 'blind' },
    { receiptId: 'receipt-2', runId: 'run-2', outcome: 'supports', contextMode: 'frontier' },
  ];
  return {
    getClaim: async () => ({ claimId: 'claim-1', createdAt: '2026-08-01T00:00:00.000Z' }),
    getVerificationPolicyRevision: async () => ({ policy_id: 'policy-1', revision: 1, requirements: { blocking_findings: 0, blind_reproductions: 1, distinct_implementations: 2, successful_reproductions: 2 }, outcomes: { requirements_met: 'provisionally_accepted', any_refuting_receipt: 'contested' } }),
    listVerificationReceipts: async () => receipts,
    listVerificationFindings: async () => [],
  };
}

test('materializes Claim policy input from receipts and evaluates it', async () => {
  const result = await evaluateClaimPolicyJob({ repository: repository(), claimId: 'claim-1', policyId: 'policy-1', policyRevision: 1, now: '2026-08-02T00:00:00.000Z' });
  assert.equal(result.evaluation.requirements_met, true);
  assert.equal(result.evaluation.recommended_outcome, 'provisionally_accepted');
});

test('fails closed for an unsupported policy requirement', async () => {
  const repo = repository(); repo.getVerificationPolicyRevision = async () => ({ policy_id: 'policy-1', revision: 1, requirements: { opaque_requirement: true }, outcomes: { requirements_met: 'accepted' } });
  await assert.rejects(() => evaluateClaimPolicyJob({ repository: repo, claimId: 'claim-1', policyId: 'policy-1', policyRevision: 1 }), (error) => error instanceof PolicyEvaluationWorkerError && error.code === 'POLICY_REQUIREMENT_UNSUPPORTED');
});

test('excludes duplicate receipts from support, blind, and refutation counters', async () => {
  const repo = repository();
  repo.listVerificationReceipts = async () => [
    { receiptId: 'support', runId: 'run-1', outcome: 'supports', contextMode: 'blind' },
    { receiptId: 'duplicate-support', runId: 'run-1', outcome: 'supports', contextMode: 'blind', duplicateOfReceiptId: 'support' },
    { receiptId: 'duplicate-refutation', runId: 'run-2', outcome: 'refutes', contextMode: 'blind', duplicateOfReceiptId: 'support' },
  ];
  repo.getVerificationPolicyRevision = async () => ({ policy_id: 'policy-1', revision: 1, requirements: { blind_reproductions: 1, successful_reproductions: 1 }, outcomes: { requirements_met: 'provisionally_accepted', any_refuting_receipt: 'contested' } });
  const result = await evaluateClaimPolicyJob({ repository: repo, claimId: 'claim-1', policyId: 'policy-1', policyRevision: 1 });
  assert.equal(result.evaluation.recommended_outcome, 'provisionally_accepted');
  assert.equal(result.evaluation.input.refuting_receipts, 0);
});
