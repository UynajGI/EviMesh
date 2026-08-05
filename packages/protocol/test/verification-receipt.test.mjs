import test from 'node:test';
import assert from 'node:assert/strict';
import { createVerificationReceipt } from '../src/verification-receipt.mjs';

const validReceipt = {
  claimRevisionId: 'claim_revision_1',
  contractRevisionId: 'contract_revision_1',
  outcome: 'supports',
  verificationTypes: ['independent_reproduction', 'statistical_check'],
  contextMode: 'blind',
  sawExpectedOutputs: false,
  implementationRelation: 'independent',
  dataRelation: 'shared',
  modelFamily: 'self_declared:qwen',
  findings: [{ severity: 'warning', code: 'SMALL_SAMPLE' }],
};

test('creates an immutable complete VerificationReceipt', () => {
  const receipt = createVerificationReceipt(validReceipt);

  assert.deepEqual(receipt, {
    schema: 'srp.verification-receipt.v1',
    claim_revision_id: 'claim_revision_1',
    contract_revision_id: 'contract_revision_1',
    outcome: 'supports',
    verification_types: ['independent_reproduction', 'statistical_check'],
    context_mode: 'blind',
    saw_expected_outputs: false,
    implementation_relation: 'independent',
    data_relation: 'shared',
    model_family: 'self_declared:qwen',
    findings: [{ severity: 'warning', code: 'SMALL_SAMPLE' }],
  });
  assert.equal(Object.isFrozen(receipt), true);
  assert.equal(Object.isFrozen(receipt.verification_types), true);
  assert.equal(Object.isFrozen(receipt.findings), true);
  assert.equal(Object.isFrozen(receipt.findings[0]), true);
});

test('rejects incomplete and malformed verification receipts', () => {
  assert.throws(() => createVerificationReceipt({ ...validReceipt, claimRevisionId: undefined }), /claim revision ID/);
  assert.throws(() => createVerificationReceipt({ ...validReceipt, outcome: 'accepted' }), /unsupported verification outcome/);
  assert.throws(() => createVerificationReceipt({ ...validReceipt, verificationTypes: [] }), /verification types/);
  assert.throws(() => createVerificationReceipt({ ...validReceipt, sawExpectedOutputs: 'no' }), /boolean/);
  assert.throws(() => createVerificationReceipt({ ...validReceipt, findings: [{ severity: 'error', code: 'BAD_SEVERITY' }] }), /unsupported finding severity/);
  assert.throws(() => createVerificationReceipt({ ...validReceipt, findings: [{ code: 'MISSING_SEVERITY' }] }), /unsupported finding severity/);
  assert.throws(() => createVerificationReceipt({ ...validReceipt, findings: [{ severity: 'warning' }] }), /finding code/);
});
