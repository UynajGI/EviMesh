import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const schemaPath = fileURLToPath(new URL('../verification.schema.json', import.meta.url));
const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
const validVerification = {
  schema: 'srp.verification-receipt.v1',
  claim_revision_id: 'claim_01@revision:2',
  contract_revision_id: 'contract_01@revision:1',
  outcome: 'supports',
  verification_types: ['numerical_reproduction', 'code_test'],
  context_mode: 'blind',
  saw_expected_outputs: true,
  implementation_relation: 'independent',
  data_relation: 'same_dataset',
  model_family: 'deterministic_reference',
  findings: [{ severity: 'note', code: 'REPRODUCTION_MATCH', message: 'Result matched tolerance.' }],
};

function validateVerification(value) {
  for (const field of schema.required) if (!(field in value) || value[field] === undefined || value[field] === null) return `${field} is required`;
  if (value.schema !== 'srp.verification-receipt.v1') return 'schema mismatch';
  for (const field of ['claim_revision_id', 'contract_revision_id', 'implementation_relation', 'data_relation', 'model_family']) if (typeof value[field] !== 'string' || value[field].length < 1) return field;
  if (!schema.properties.outcome.enum.includes(value.outcome) || !schema.properties.context_mode.enum.includes(value.context_mode)) return 'enum';
  if (!Array.isArray(value.verification_types) || value.verification_types.length < 1) return 'verification_types';
  if (typeof value.saw_expected_outputs !== 'boolean' || !Array.isArray(value.findings)) return 'receipt fields';
  for (const finding of value.findings) {
    if (!finding || !schema.$defs.finding.required.every((field) => typeof finding[field] === 'string' && finding[field].length > 0)) return 'finding fields';
    if (!schema.$defs.finding.properties.severity.enum.includes(finding.severity)) return 'finding severity';
  }
  return null;
}

test('defines fixed ClaimRevision Verification Receipt fields', () => {
  assert.equal(schema.$id, 'https://evimesh.org/schema/verification.schema.json');
  assert.equal(schema.properties.schema.const, 'srp.verification-receipt.v1');
  assert.deepEqual(schema.$defs.finding.properties.severity.enum, ['critical', 'major', 'warning', 'note']);
  assert.equal(validateVerification(validVerification), null);
});

test('rejects invalid outcome, context, independence, and Finding vectors', () => {
  for (const invalid of [
    { ...validVerification, claim_revision_id: '' },
    { ...validVerification, outcome: 'accepted' },
    { ...validVerification, context_mode: 'unknown' },
    { ...validVerification, saw_expected_outputs: 'yes' },
    { ...validVerification, findings: [{ severity: 'error', code: 'BAD' }] },
    { ...validVerification, findings: [{ severity: 'major', code: '' }] },
  ]) {
    assert.notEqual(validateVerification(invalid), null);
  }
});
