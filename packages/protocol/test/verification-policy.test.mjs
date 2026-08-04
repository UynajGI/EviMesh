import test from 'node:test';
import assert from 'node:assert/strict';
import { createVerificationPolicy } from '../src/verification-policy.mjs';

const validPolicy = {
  policyId: 'numeric-reproduction',
  revision: 1,
  requirements: {
    schema_gate: 'pass',
    blocking_findings: 0,
    successful_reproductions: 2,
    blind_reproductions: 1,
    distinct_implementations: 2,
    challenge_window_hours: 168,
  },
  outcomes: {
    any_refuting_receipt: 'contested',
    requirements_met: 'provisionally_accepted',
  },
};

test('creates an immutable versioned VerificationPolicy', () => {
  const policy = createVerificationPolicy(validPolicy);

  assert.deepEqual(policy, {
    schema: 'srp.verification-policy.v1',
    policy_id: 'numeric-reproduction',
    revision: 1,
    requirements: validPolicy.requirements,
    outcomes: validPolicy.outcomes,
  });
  assert.equal(Object.isFrozen(policy), true);
  assert.equal(Object.isFrozen(policy.requirements), true);
  assert.equal(Object.isFrozen(policy.outcomes), true);
});

test('rejects incomplete or invalid policy versions', () => {
  assert.throws(() => createVerificationPolicy({ ...validPolicy, policyId: '' }), /policy ID/);
  assert.throws(() => createVerificationPolicy({ ...validPolicy, revision: 0 }), /positive integer/);
  assert.throws(() => createVerificationPolicy({ ...validPolicy, requirements: {} }), /requirements/);
  assert.throws(() => createVerificationPolicy({ ...validPolicy, outcomes: undefined }), /outcomes/);
  assert.throws(() => createVerificationPolicy({ ...validPolicy, requirements: { schema_gate: null } }), /requirements/);
});
