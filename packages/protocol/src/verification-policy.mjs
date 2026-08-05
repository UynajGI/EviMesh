function requireString(value, field) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
}

function requirePositiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError(`${field} must be a positive integer`);
  }
}

function freezeRecord(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length === 0) {
    throw new TypeError(`${field} must be a non-empty object`);
  }
  for (const [key, entry] of Object.entries(value)) {
    requireString(key, `${field} key`);
    if (entry === undefined || entry === null || (typeof entry === 'object' && Object.keys(entry).length === 0)) {
      throw new TypeError(`${field}.${key} must have a value`);
    }
  }
  return Object.freeze({ ...value });
}

export function createVerificationPolicy({ policyId, revision, requirements, outcomes } = {}) {
  requireString(policyId, 'policy ID');
  requirePositiveInteger(revision, 'policy revision');
  const frozenRequirements = freezeRecord(requirements, 'requirements');
  const frozenOutcomes = freezeRecord(outcomes, 'outcomes');

  return Object.freeze({
    schema: 'srp.verification-policy.v1',
    policy_id: policyId,
    revision,
    requirements: frozenRequirements,
    outcomes: frozenOutcomes,
  });
}
