import test from 'node:test';
import assert from 'node:assert/strict';
import { signMerkleCheckpoint, verifyMerkleCheckpoint } from '../src/merkle-checkpoint.mjs';

async function keyMaterial() {
  const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  return {
    privateKey: Buffer.from(await crypto.subtle.exportKey('pkcs8', keyPair.privateKey)).toString('base64url'),
    publicKey: Buffer.from(await crypto.subtle.exportKey('spki', keyPair.publicKey)).toString('base64url'),
  };
}

function checkpoint() {
  return {
    schema: 'evimesh.merkle-checkpoint.v1',
    firstEventId: 'event_1',
    lastEventId: 'event_3',
    eventCount: 3,
    rootHash: `sha256:${'a'.repeat(64)}`,
  };
}

test('signs a checkpoint root that verifies with the platform public key', async () => {
  const keys = await keyMaterial();
  const signed = await signMerkleCheckpoint({ checkpoint: checkpoint(), keyId: 'platform-key-1', privateKey: keys.privateKey });
  assert.deepEqual(Object.keys(signed.signature), ['algorithm', 'keyId', 'value']);
  assert.equal(await verifyMerkleCheckpoint({ checkpoint: signed, publicKey: keys.publicKey }), true);
});

test('rejects checkpoints with a tampered root, range, count, or signature', async () => {
  const keys = await keyMaterial();
  const signed = await signMerkleCheckpoint({ checkpoint: checkpoint(), keyId: 'platform-key-1', privateKey: keys.privateKey });
  assert.equal(await verifyMerkleCheckpoint({ checkpoint: { ...signed, rootHash: `sha256:${'b'.repeat(64)}` }, publicKey: keys.publicKey }), false);
  assert.equal(await verifyMerkleCheckpoint({ checkpoint: { ...signed, lastEventId: 'event_4' }, publicKey: keys.publicKey }), false);
  assert.equal(await verifyMerkleCheckpoint({ checkpoint: { ...signed, eventCount: 4 }, publicKey: keys.publicKey }), false);
  assert.equal(await verifyMerkleCheckpoint({ checkpoint: { ...signed, signature: { ...signed.signature, value: 'tampered' } }, publicKey: keys.publicKey }), false);
});
