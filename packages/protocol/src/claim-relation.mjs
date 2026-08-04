const RELATION_DEFINITIONS = {
  depends_on: 'source requires the target as an upstream dependency',
  supports: 'source provides support for the target',
  refutes: 'source provides a refutation of the target',
  qualifies: 'source narrows the scope or conditions of the target',
  reproduces: 'source reproduces the result described by the target',
  extends: 'source extends the result or scope of the target',
  supersedes: 'source replaces the target as the current revision or claim',
  contradicts: 'source contradicts the target',
  derived_from: 'source is derived from the target',
  uses_method: 'source uses the method represented by the target',
  uses_dataset: 'source uses the dataset represented by the target',
  implements: 'source implements the target specification or claim',
  verifies: 'source verifies the target',
  challenges: 'source challenges the target',
};

export const CLAIM_RELATION_TYPES = Object.freeze(Object.keys(RELATION_DEFINITIONS));
const CLAIM_RELATION_TYPE_SET = new Set(CLAIM_RELATION_TYPES);

export function isClaimRelationType(value) {
  return typeof value === 'string' && CLAIM_RELATION_TYPE_SET.has(value);
}

export function assertClaimRelationType(value) {
  if (!isClaimRelationType(value)) {
    throw new TypeError(`unsupported claim relation type: ${String(value)}`);
  }

  return value;
}

export function claimRelationSemantics(type) {
  assertClaimRelationType(type);
  return RELATION_DEFINITIONS[type];
}

export function createClaimRelation({ type, source, target } = {}) {
  assertClaimRelationType(type);

  if (typeof source !== 'string' || source.length === 0) {
    throw new TypeError('claim relation source must be a non-empty string');
  }
  if (typeof target !== 'string' || target.length === 0) {
    throw new TypeError('claim relation target must be a non-empty string');
  }

  return Object.freeze({ type, source, target });
}
