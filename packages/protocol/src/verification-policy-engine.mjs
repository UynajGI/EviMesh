import { createVerificationPolicy } from './verification-policy.mjs';

const COUNT_REQUIREMENTS = new Set(['blind_reproductions']);

export class VerificationPolicyEvaluationError extends Error {
  constructor(message, code = 'VERIFICATION_POLICY_EVALUATION_INVALID') {
    super(message);
    this.name = 'VerificationPolicyEvaluationError';
    this.code = code;
  }
}

function record(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new VerificationPolicyEvaluationError(`${field} must be an object`);
  }
  return value;
}

function deepEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object' || Array.isArray(left) !== Array.isArray(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index] && deepEqual(left[key], right[key]));
}

function evaluateRequirement(key, expected, actual) {
  if (typeof expected === 'number') {
    if (!Number.isFinite(actual)) throw new VerificationPolicyEvaluationError(`input.${key} must be a finite number`);
    if (COUNT_REQUIREMENTS.has(key) && (!Number.isInteger(actual) || actual < 0)) {
      throw new VerificationPolicyEvaluationError(`input.${key} must be a non-negative integer`);
    }
    if (key === 'blocking_findings') return actual <= expected;
    return actual >= expected;
  }
  if (typeof expected === 'string' || typeof expected === 'boolean' || expected === null) return Object.is(actual, expected);
  return deepEqual(actual, expected);
}

/** Interpret an immutable Policy revision against a materialized input. */
export function evaluateVerificationPolicy({ policy, input } = {}) {
  const candidate = record(policy, 'policy');
  const normalized = createVerificationPolicy({
    policyId: candidate.policy_id ?? candidate.policyId,
    revision: candidate.revision,
    requirements: candidate.requirements,
    outcomes: candidate.outcomes,
  });
  input = record(input, 'input');
  const refutingReceipts = input.refuting_receipts ?? 0;
  if (!Number.isInteger(refutingReceipts) || refutingReceipts < 0) {
    throw new VerificationPolicyEvaluationError('input.refuting_receipts must be a non-negative integer');
  }

  const requirementResults = Object.entries(normalized.requirements)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, expected]) => {
      if (!Object.hasOwn(input, key)) throw new VerificationPolicyEvaluationError(`input.${key} is required`, 'POLICY_INPUT_MISSING');
      const actual = input[key];
      return Object.freeze({ key, expected, actual, met: evaluateRequirement(key, expected, actual) });
    });
  const requirementsMet = requirementResults.every((result) => result.met);

  return Object.freeze({
    schema: 'srp.verification-policy-evaluation.v1',
    policy_id: normalized.policy_id,
    revision: normalized.revision,
    input: Object.freeze({ ...input }),
    requirement_results: Object.freeze(requirementResults),
    requirements_met: requirementsMet,
    recommended_outcome: refutingReceipts > 0 ? normalized.outcomes.any_refuting_receipt ?? 'contested' : requirementsMet ? normalized.outcomes.requirements_met ?? null : null,
  });
}
