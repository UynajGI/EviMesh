import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertEvidenceType,
  EVIDENCE_TYPES,
  isEvidenceType,
} from '../src/evidence-type.mjs';

test('defines the complete Evidence type vocabulary', () => {
  assert.deepEqual(EVIDENCE_TYPES, [
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
  assert.equal(Object.isFrozen(EVIDENCE_TYPES), true);
  EVIDENCE_TYPES.forEach((type) => assert.equal(assertEvidenceType(type), type));
});

test('rejects unknown Evidence types', () => {
  assert.equal(isEvidenceType('claim'), false);
  assert.equal(isEvidenceType(null), false);
  assert.throws(() => assertEvidenceType('claim'), /unsupported evidence type/);
  assert.throws(() => assertEvidenceType(1), /unsupported evidence type/);
});
