import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const schemaPath = fileURLToPath(new URL('../claim.schema.json', import.meta.url));
const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
const validClaim = {
  schema: 'srp.claim.v1',
  claim_id: 'claim_018f0f4a-5c00-4000-8000-000000000001',
  revision: 1,
  state: 'candidate',
  statement: 'The reference method reproduces the reported result within the declared tolerance.',
  scope: ['the reference dataset', 'the stated numerical tolerance'],
  assumptions: ['the input data is unchanged'],
  falsification: ['an independently verified result outside the tolerance'],
  question_id: 'question_018f0f4a-5c00-4000-8000-000000000001',
  created_at: '2026-08-04T06:00:00.000Z',
  created_by: 'actor_01',
};

function validateClaim(value) {
  for (const field of schema.required) if (!(field in value) || value[field] === undefined || value[field] === null) return `${field} is required`;
  if (value.schema !== 'srp.claim.v1') return 'schema mismatch';
  if (!/^claim_[0-9a-f-]{36}$/.test(value.claim_id)) return 'claim_id format';
  if (!Number.isInteger(value.revision) || value.revision < 1) return 'revision';
  if (!schema.properties.state.enum.includes(value.state)) return 'state';
  if (typeof value.statement !== 'string' || value.statement.length < 1) return 'statement';
  for (const field of ['scope', 'assumptions', 'falsification']) {
    if (!Array.isArray(value[field]) || (field !== 'assumptions' && value[field].length < 1) || value[field].some((item) => typeof item !== 'string' || item.length < 1)) return field;
  }
  return Number.isNaN(Date.parse(value.created_at)) ? 'created_at' : null;
}

test('defines ClaimRevision statement and epistemic boundary fields', () => {
  assert.equal(schema.$id, 'https://evimesh.org/schema/claim.schema.json');
  assert.deepEqual(schema.required, ['schema', 'claim_id', 'revision', 'state', 'statement', 'scope', 'assumptions', 'falsification', 'created_at', 'created_by']);
  assert.equal(schema.properties.falsification.minItems, 1);
  assert.equal(validateClaim(validClaim), null);
});

test('rejects invalid Claim vectors', () => {
  for (const invalid of [
    { ...validClaim, claim_id: 'task_018f0f4a-5c00-4000-8000-000000000001' },
    { ...validClaim, state: 'resolved' },
    { ...validClaim, statement: '' },
    { ...validClaim, scope: [] },
    { ...validClaim, assumptions: [''] },
    { ...validClaim, falsification: [] },
  ]) {
    assert.notEqual(validateClaim(invalid), null);
  }
});
