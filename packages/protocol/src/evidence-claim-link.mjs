const LINK_SEMANTICS = {
  supports: 'evidence supports the claim revision',
  refutes: 'evidence refutes the claim revision',
  qualifies: 'evidence narrows the scope or conditions of the claim revision',
  reproduces: 'evidence reproduces the result in the claim revision',
};

export const EVIDENCE_CLAIM_RELATIONS = Object.freeze(Object.keys(LINK_SEMANTICS));
const RELATION_SET = new Set(EVIDENCE_CLAIM_RELATIONS);

export function isEvidenceClaimRelation(value) {
  return typeof value === 'string' && RELATION_SET.has(value);
}

export function assertEvidenceClaimRelation(value) {
  if (!isEvidenceClaimRelation(value)) {
    throw new TypeError(`unsupported evidence-claim relation: ${String(value)}`);
  }

  return value;
}

export function evidenceClaimRelationSemantics(value) {
  assertEvidenceClaimRelation(value);
  return LINK_SEMANTICS[value];
}

export function createEvidenceClaimLink({ type, evidenceId, claimRevisionId } = {}) {
  assertEvidenceClaimRelation(type);
  if (typeof evidenceId !== 'string' || evidenceId.length === 0) {
    throw new TypeError('evidence claim link requires an evidence ID');
  }
  if (typeof claimRevisionId !== 'string' || claimRevisionId.length === 0) {
    throw new TypeError('evidence claim link requires a claim revision ID');
  }

  return Object.freeze({
    type,
    source: evidenceId,
    target: claimRevisionId,
  });
}
