import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const schemaPath = fileURLToPath(new URL('../event.schema.json', import.meta.url));
const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
const validEvent = {
  schema: 'srp.event.v1',
  event_id: '018f0f4a-5c00-7000-8000-000000000001',
  event_type: 'claim.revised',
  payload: { claim_revision_id: 'claim_01@revision:2', transition: 'accepted' },
  hash: `sha256:${'a'.repeat(64)}`,
  signature: { algorithm: 'Ed25519', key_id: 'actor-key-01', value: 'signature-bytes' },
  parents: ['018f0f4a-5c00-7000-8000-000000000000'],
};

function validateEvent(value) {
  for (const field of schema.required) if (!(field in value) || value[field] === undefined || value[field] === null) return `${field} is required`;
  if (value.schema !== 'srp.event.v1' || !/^([0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.test(value.event_id)) return 'event ID';
  if (!/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/.test(value.event_type)) return 'event type';
  if (!value.payload || typeof value.payload !== 'object' || Object.keys(value.payload).length === 0) return 'payload';
  if (!/^sha256:[0-9a-f]{64}$/i.test(value.hash)) return 'hash';
  if (!value.signature || value.signature.algorithm !== 'Ed25519' || typeof value.signature.key_id !== 'string' || value.signature.key_id.length < 1 || typeof value.signature.value !== 'string' || value.signature.value.length < 1) return 'signature';
  if (!Array.isArray(value.parents) || value.parents.some((parent) => !/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parent))) return 'parents';
  return null;
}

test('defines signed ResearchEvent and parent event fields', () => {
  assert.equal(schema.$id, 'https://evimesh.org/schema/event.schema.json');
  assert.equal(schema.$defs.signature.properties.algorithm.const, 'Ed25519');
  assert.equal(schema.properties.parents.uniqueItems, true);
  assert.equal(validateEvent(validEvent), null);
  assert.equal(validateEvent({ ...validEvent, event_type: 'claim.state_changed' }), null);
});

test('accepts a genesis event and rejects malformed signature or parent vectors', () => {
  assert.equal(validateEvent({ ...validEvent, parents: [] }), null);
  for (const invalid of [
    { ...validEvent, event_id: '018f0f4a-5c00-4000-6000-000000000001' },
    { ...validEvent, event_type: 'claim' },
    { ...validEvent, hash: 'sha256:not-a-digest' },
    { ...validEvent, signature: { ...validEvent.signature, algorithm: 'RSA' } },
    { ...validEvent, parents: ['not-a-uuidv7'] },
  ]) {
    assert.notEqual(validateEvent(invalid), null);
  }
});
