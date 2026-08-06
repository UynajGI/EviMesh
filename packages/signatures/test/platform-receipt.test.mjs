import test from 'node:test';
import assert from 'node:assert/strict';
import { createSignedPlatformReceipt, verifyPlatformReceipt } from '../src/platform-receipt.mjs';

async function keyMaterial() {
  const keyPair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  return {
    privateKey: Buffer.from(await crypto.subtle.exportKey('pkcs8', keyPair.privateKey)).toString('base64url'),
    publicKey: Buffer.from(await crypto.subtle.exportKey('spki', keyPair.publicKey)).toString('base64url'),
  };
}

test('signs a platform receipt that verifies with the platform public key', async () => {
  const keys = await keyMaterial();
  const receipt = await createSignedPlatformReceipt({
    eventId: '018f0f4a-5c00-7000-8000-000000000001',
    serverTime: '2026-08-06T06:00:00.000Z',
    keyId: 'platform-key-1',
    privateKey: keys.privateKey,
  });
  assert.equal(receipt.server_signature.algorithm, 'Ed25519');
  assert.equal(await verifyPlatformReceipt({ receipt, publicKey: keys.publicKey }), true);
});

test('rejects a receipt whose signed fields or signature are tampered', async () => {
  const keys = await keyMaterial();
  const receipt = await createSignedPlatformReceipt({
    eventId: '018f0f4a-5c00-7000-8000-000000000001',
    serverTime: '2026-08-06T06:00:00.000Z',
    keyId: 'platform-key-1',
    privateKey: keys.privateKey,
  });
  assert.equal(await verifyPlatformReceipt({ receipt: { ...receipt, server_time: '2026-08-06T06:01:00.000Z' }, publicKey: keys.publicKey }), false);
  assert.equal(await verifyPlatformReceipt({ receipt: { ...receipt, server_signature: { ...receipt.server_signature, value: 'tampered' } }, publicKey: keys.publicKey }), false);
});
