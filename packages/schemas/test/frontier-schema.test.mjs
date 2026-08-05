import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const schemaPath = fileURLToPath(new URL('../frontier.schema.json', import.meta.url));
const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
const validFrontier = {
  schema: 'srp.frontier.v1',
  number: 2,
  previous: 1,
  revision: 2,
  members: [{ claim_revision_id: 'claim_01@revision:2', status: 'accepted' }],
  policy: { policy_id: 'numeric-reproduction', revision: 3 },
  checkpoint: { algorithm: 'sha256', hash: `sha256:${'a'.repeat(64)}` },
};

function validateFrontier(value) {
  for (const field of schema.required) if (!(field in value) || value[field] === undefined) return `${field} is required`;
  if (value.schema !== 'srp.frontier.v1') return 'schema mismatch';
  if (!Number.isInteger(value.number) || value.number < 1 || !Number.isInteger(value.revision) || value.revision < 1) return 'number/revision';
  if (value.previous !== null && (!Number.isInteger(value.previous) || value.previous < 1 || value.previous >= value.number)) return 'previous';
  if (!Array.isArray(value.members) || value.members.some((member) => !member || typeof member.claim_revision_id !== 'string' || !schema.$defs.member.properties.status.enum.includes(member.status))) return 'members';
  if (!value.policy || typeof value.policy.policy_id !== 'string' || value.policy.policy_id.length < 1 || !Number.isInteger(value.policy.revision) || value.policy.revision < 1) return 'policy';
  if (!value.checkpoint || value.checkpoint.algorithm !== 'sha256' || !/^sha256:[0-9a-f]{64}$/.test(value.checkpoint.hash)) return 'checkpoint';
  return null;
}

test('defines append-only Frontier previous, members, policy, and checkpoint fields', () => {
  assert.equal(schema.$id, 'https://evimesh.org/schema/frontier.schema.json');
  assert.equal(schema.properties.previous.type.includes('null'), true);
  assert.equal(schema.$defs.checkpoint.properties.algorithm.const, 'sha256');
  assert.equal(validateFrontier(validFrontier), null);
});

test('accepts a genesis previous value and rejects malformed Frontier vectors', () => {
  assert.equal(validateFrontier({ ...validFrontier, number: 1, previous: null, members: [] }), null);
  for (const invalid of [
    { ...validFrontier, previous: 2 },
    { ...validFrontier, members: [{ claim_revision_id: 'claim_01', status: 'refuted' }] },
    { ...validFrontier, policy: { policy_id: '', revision: 1 } },
    { ...validFrontier, checkpoint: { algorithm: 'sha1', hash: `sha256:${'a'.repeat(64)}` } },
    { ...validFrontier, checkpoint: { algorithm: 'sha256', hash: 'sha256:not-a-digest' } },
  ]) {
    assert.notEqual(validateFrontier(invalid), null);
  }
});
