import test from 'node:test';
import assert from 'node:assert/strict';
import { createResearchEvent } from '../src/research-event.mjs';

const validEvent = {
  eventId: '018f0f4a-5c00-7000-8000-000000000001',
  eventType: 'claim.revised',
  payload: { claim_revision_id: 'claim_01', transition: 'accepted' },
  hash: `sha256:${'a'.repeat(64)}`,
  signature: { algorithm: 'ed25519', key_id: 'actor-key-01', value: 'signature-bytes' },
  parents: ['018f0f4a-5c00-7000-8000-000000000000'],
};

test('creates an immutable ResearchEvent envelope', () => {
  const event = createResearchEvent(validEvent);

  assert.deepEqual(event, {
    schema: 'srp.event.v1',
    event_id: validEvent.eventId,
    event_type: validEvent.eventType,
    payload: validEvent.payload,
    hash: validEvent.hash,
    signature: validEvent.signature,
    parents: validEvent.parents,
  });
  assert.equal(Object.isFrozen(event), true);
  assert.equal(Object.isFrozen(event.payload), true);
  assert.equal(Object.isFrozen(event.signature), true);
  assert.equal(Object.isFrozen(event.parents), true);
});

test('generates a UUIDv7 event ID and permits a genesis event', () => {
  const event = createResearchEvent({ ...validEvent, eventId: undefined, parents: [] });

  assert.match(event.event_id, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.deepEqual(event.parents, []);
});

test('accepts namespaced lifecycle event segments with underscores', () => {
  assert.equal(createResearchEvent({ ...validEvent, eventType: 'claim.state_changed' }).event_type, 'claim.state_changed');
});

test('rejects incomplete or malformed envelope fields', () => {
  assert.throws(() => createResearchEvent({ ...validEvent, eventType: 'claim' }), /namespaced/);
  assert.throws(() => createResearchEvent({ ...validEvent, payload: undefined }), /payload/);
  assert.throws(() => createResearchEvent({ ...validEvent, hash: 'sha256:not-a-digest' }), /sha256/);
  assert.throws(() => createResearchEvent({ ...validEvent, signature: undefined }), /signature/);
  assert.throws(() => createResearchEvent({ ...validEvent, parents: ['not-an-id'] }), /UUIDv7/);
});
