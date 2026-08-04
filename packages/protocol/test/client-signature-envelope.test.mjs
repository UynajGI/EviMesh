import test from 'node:test';
import assert from 'node:assert/strict';
import { createClientSignatureEnvelope } from '../src/client-signature-envelope.mjs';

const validEnvelope = {
  eventType: 'claim.revised',
  payload: { claim_revision_id: 'claim_01', transition: 'accepted' },
  nonce: '0123456789abcdef',
  signature: { algorithm: 'Ed25519', key_id: 'actor-key-01', value: 'signature-bytes' },
};

test('creates deterministic client signature bytes and hash', () => {
  const envelope = createClientSignatureEnvelope(validEnvelope);
  const same = createClientSignatureEnvelope({ ...validEnvelope, payload: { transition: 'accepted', claim_revision_id: 'claim_01' } });

  assert.equal(envelope.schema, 'srp.client-signature-envelope.v1');
  assert.equal(envelope.signing_bytes, same.signing_bytes);
  assert.equal(envelope.signing_bytes_hash, same.signing_bytes_hash);
  assert.equal(Object.isFrozen(envelope), true);
  assert.equal(Object.isFrozen(envelope.payload), true);
  assert.equal(Object.isFrozen(envelope.signature), true);
});

test('rejects invalid event types, payloads, signatures, and nonce values', () => {
  assert.throws(() => createClientSignatureEnvelope({ ...validEnvelope, eventType: 'claim' }), /namespaced/);
  assert.throws(() => createClientSignatureEnvelope({ ...validEnvelope, payload: [] }), /payload/);
  assert.throws(() => createClientSignatureEnvelope({ ...validEnvelope, nonce: 'short' }), /16-128/);
  assert.throws(() => createClientSignatureEnvelope({ ...validEnvelope, nonce: `${'a'.repeat(16)}=` }), /16-128/);
  assert.throws(() => createClientSignatureEnvelope({ ...validEnvelope, signature: undefined }), /signature/);
});
