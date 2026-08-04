export const EVIDENCE_TYPES = Object.freeze([
  'formal_proof',
  'numerical_result',
  'experimental_result',
  'dataset',
  'literature_support',
  'counterexample',
  'benchmark',
  'statistical_analysis',
  'code_test',
  'negative_result',
  'expert_assessment',
]);

const EVIDENCE_TYPE_SET = new Set(EVIDENCE_TYPES);

export function isEvidenceType(value) {
  return typeof value === 'string' && EVIDENCE_TYPE_SET.has(value);
}

export function assertEvidenceType(value) {
  if (!isEvidenceType(value)) {
    throw new TypeError(`unsupported evidence type: ${String(value)}`);
  }

  return value;
}
