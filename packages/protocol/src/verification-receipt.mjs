const VERIFICATION_OUTCOMES = Object.freeze(['supports', 'refutes', 'qualifies', 'inconclusive']);

function requireString(value, field) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
}

function frozenStringArray(value, field) {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string' || item.length === 0)) {
    throw new TypeError(`${field} must be a non-empty string array`);
  }
  return Object.freeze([...value]);
}

function frozenFindings(value) {
  if (!Array.isArray(value)) {
    throw new TypeError('findings must be an array');
  }
  return Object.freeze(value.map((finding) => {
    if (!finding || typeof finding !== 'object' || Array.isArray(finding)) {
      throw new TypeError('each finding must be an object');
    }
    requireString(finding.severity, 'finding severity');
    requireString(finding.code, 'finding code');
    return Object.freeze({ ...finding });
  }));
}

export function createVerificationReceipt({
  claimRevisionId,
  contractRevisionId,
  outcome,
  verificationTypes,
  contextMode,
  sawExpectedOutputs,
  implementationRelation,
  dataRelation,
  modelFamily,
  findings = [],
} = {}) {
  requireString(claimRevisionId, 'claim revision ID');
  requireString(contractRevisionId, 'contract revision ID');
  requireString(outcome, 'verification outcome');
  if (!VERIFICATION_OUTCOMES.includes(outcome)) {
    throw new TypeError(`unsupported verification outcome: ${outcome}`);
  }
  requireString(contextMode, 'context mode');
  requireString(implementationRelation, 'implementation relation');
  requireString(dataRelation, 'data relation');
  requireString(modelFamily, 'model family');
  if (typeof sawExpectedOutputs !== 'boolean') {
    throw new TypeError('saw expected outputs must be a boolean');
  }

  return Object.freeze({
    schema: 'srp.verification-receipt.v1',
    claim_revision_id: claimRevisionId,
    contract_revision_id: contractRevisionId,
    outcome,
    verification_types: frozenStringArray(verificationTypes, 'verification types'),
    context_mode: contextMode,
    saw_expected_outputs: sawExpectedOutputs,
    implementation_relation: implementationRelation,
    data_relation: dataRelation,
    model_family: modelFamily,
    findings: frozenFindings(findings),
  });
}
