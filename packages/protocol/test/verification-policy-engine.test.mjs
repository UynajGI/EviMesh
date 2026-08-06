import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateVerificationPolicy, VerificationPolicyEvaluationError } from '../src/verification-policy-engine.mjs';

const policy = {
  schema: 'srp.verification-policy.v1', policy_id: 'numeric-reproduction', revision: 1,
  requirements: { schema_gate: 'pass', successful_reproductions: 2, blind_reproductions: 1 },
  outcomes: { requirements_met: 'provisionally_accepted', any_refuting_receipt: 'contested' },
};

test('interprets the versioned policy JSON deterministically', () => {
  const result = evaluateVerificationPolicy({ policy, input: { blind_reproductions: 1, schema_gate: 'pass', successful_reproductions: 3 } });
  assert.equal(result.requirements_met, true);
  assert.equal(result.recommended_outcome, 'provisionally_accepted');
  assert.deepEqual(result.requirement_results.map(({ key, met }) => [key, met]), [['blind_reproductions', true], ['schema_gate', true], ['successful_reproductions', true]]);
  assert.equal(Object.isFrozen(result), true);
});

test('reports unmet requirements without promoting the Claim', () => {
  const result = evaluateVerificationPolicy({ policy, input: { blind_reproductions: 0, schema_gate: 'pass', successful_reproductions: 2 } });
  assert.equal(result.requirements_met, false);
  assert.equal(result.recommended_outcome, null);
  assert.equal(result.requirement_results.find((item) => item.key === 'blind_reproductions').met, false);
});

test('does not promote a Claim with blocking Findings', () => {
  const blockedPolicy = { ...policy, requirements: { ...policy.requirements, blocking_findings: 0 } };
  const result = evaluateVerificationPolicy({ policy: blockedPolicy, input: { blind_reproductions: 1, blocking_findings: 1, schema_gate: 'pass', successful_reproductions: 2 } });
  assert.equal(result.requirements_met, false);
  assert.equal(result.recommended_outcome, null);
  assert.equal(result.requirement_results.find((item) => item.key === 'blocking_findings').met, false);
});

test('marks a Claim contested when a valid refuting Receipt exists', () => {
  const result = evaluateVerificationPolicy({ policy, input: { blind_reproductions: 1, refuting_receipts: 1, schema_gate: 'pass', successful_reproductions: 2 } });
  assert.equal(result.requirements_met, true);
  assert.equal(result.recommended_outcome, 'contested');
});

test('fails closed for missing or malformed policy inputs', () => {
  assert.throws(() => evaluateVerificationPolicy({ policy, input: { schema_gate: 'pass', successful_reproductions: 2 } }), (error) => error instanceof VerificationPolicyEvaluationError && error.code === 'POLICY_INPUT_MISSING');
  assert.throws(() => evaluateVerificationPolicy({ policy, input: { blind_reproductions: '1', schema_gate: 'pass', successful_reproductions: 2 } }), /finite number/);
});
