import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const schemaPath = fileURLToPath(new URL('../contribution.schema.json', import.meta.url));
const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
const validContribution = {
  schema: 'srp.contribution.v1',
  contribution_id: 'contribution_018f0f4a-5c00-4000-8000-000000000001',
  actor_id: 'actor_01',
  role: 'verifier',
  produced: ['verification_01', 'report_01'],
  used: ['run_01', 'claim_01@revision:2'],
  description: 'Independently reproduced the result and recorded the verification.',
  created_at: '2026-08-04T06:00:00.000Z',
};

function validateContribution(value) {
  for (const field of schema.required) if (!(field in value) || value[field] === undefined || value[field] === null) return `${field} is required`;
  if (value.schema !== 'srp.contribution.v1') return 'schema mismatch';
  if (!/^contribution_[0-9a-f-]{36}$/.test(value.contribution_id)) return 'contribution_id format';
  if (typeof value.actor_id !== 'string' || value.actor_id.length < 1) return 'actor_id';
  if (!schema.properties.role.enum.includes(value.role)) return 'role';
  for (const field of ['produced', 'used']) if (!Array.isArray(value[field]) || value[field].some((item) => typeof item !== 'string' || item.length < 1)) return field;
  if (value.produced.length === 0 && value.used.length === 0) return 'empty contribution';
  return Number.isNaN(Date.parse(value.created_at)) ? 'created_at' : null;
}

test('defines produced, used, and Contribution role vocabulary', () => {
  assert.equal(schema.$id, 'https://evimesh.org/schema/contribution.schema.json');
  assert.deepEqual(schema.properties.role.enum, ['originator', 'contributor', 'reviewer', 'verifier', 'witness', 'maintainer']);
  assert.equal(schema.anyOf.length, 2);
  assert.equal(validateContribution(validContribution), null);
});

test('rejects unsupported roles, empty attribution, and malformed objects', () => {
  for (const invalid of [
    { ...validContribution, role: 'sponsor' },
    { ...validContribution, produced: [], used: [] },
    { ...validContribution, contribution_id: 'actor_01' },
    { ...validContribution, produced: [''] },
    { ...validContribution, actor_id: '' },
  ]) {
    assert.notEqual(validateContribution(invalid), null);
  }
});
