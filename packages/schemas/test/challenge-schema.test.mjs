import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const schemaPath = fileURLToPath(new URL('../challenge.schema.json', import.meta.url));
const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
const validChallenge = {
  schema: 'srp.challenge.v1',
  challenge_id: 'challenge_018f0f4a-5c00-4000-8000-000000000001',
  revision: 1,
  state: 'open',
  target_claim_revision_id: 'claim_01@revision:2',
  reason: 'The result may depend on an undocumented preprocessing step.',
  impact: { type: 'reproducibility', severity: 'major', summary: 'Independent reproduction may fail without the missing step.' },
  proposed_resolution: 'Publish the preprocessing code and rerun verification.',
  created_at: '2026-08-04T06:00:00.000Z',
  created_by: 'actor_01',
};

function validateChallenge(value) {
  for (const field of schema.required) if (!(field in value) || value[field] === undefined || value[field] === null) return `${field} is required`;
  if (value.schema !== 'srp.challenge.v1') return 'schema mismatch';
  if (!/^challenge_[0-9a-f-]{36}$/.test(value.challenge_id)) return 'challenge_id format';
  if (!Number.isInteger(value.revision) || value.revision < 1) return 'revision';
  if (!schema.properties.state.enum.includes(value.state)) return 'state';
  if (typeof value.target_claim_revision_id !== 'string' || value.target_claim_revision_id.length < 1) return 'target';
  if (typeof value.reason !== 'string' || value.reason.length < 1) return 'reason';
  const impact = value.impact;
  if (!impact || typeof impact !== 'object') return 'impact';
  for (const field of schema.$defs.impact.required) if (typeof impact[field] !== 'string' || impact[field].length < 1) return `impact.${field}`;
  if (!schema.$defs.impact.properties.type.enum.includes(impact.type) || !schema.$defs.impact.properties.severity.enum.includes(impact.severity)) return 'impact enum';
  return Number.isNaN(Date.parse(value.created_at)) ? 'created_at' : null;
}

test('defines target ClaimRevision and structured Challenge impact', () => {
  assert.equal(schema.$id, 'https://evimesh.org/schema/challenge.schema.json');
  assert.equal(schema.properties.impact.$ref, '#/$defs/impact');
  assert.deepEqual(schema.properties.state.enum, ['open', 'admissible', 'investigating', 'upheld', 'rejected', 'resolved']);
  assert.equal(validateChallenge(validChallenge), null);
});

test('rejects invalid target revision, state, and impact vectors', () => {
  for (const invalid of [
    { ...validChallenge, challenge_id: 'claim_018f0f4a-5c00-4000-8000-000000000001' },
    { ...validChallenge, target_claim_revision_id: '' },
    { ...validChallenge, state: 'accepted' },
    { ...validChallenge, impact: { ...validChallenge.impact, severity: 'error' } },
    { ...validChallenge, impact: { ...validChallenge.impact, type: 'unknown' } },
    { ...validChallenge, impact: { type: 'scope', severity: 'major' } },
  ]) {
    assert.notEqual(validateChallenge(invalid), null);
  }
});
