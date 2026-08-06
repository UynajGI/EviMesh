import test from 'node:test';
import assert from 'node:assert/strict';
import { generateEd25519KeyPair } from '../src/ed25519.mjs';
import { createSignedPlatformReceipt } from '../src/platform-receipt.mjs';
import { rotatePlatformKeyring, verifyPlatformReceiptWithKeyring } from '../src/platform-keyring.mjs';

test('retains old and new platform keys so both historical receipts verify after rotation', async () => {
  const oldKey = generateEd25519KeyPair();
  const newKey = generateEd25519KeyPair();
  const oldReceipt = await createSignedPlatformReceipt({
    eventId: '018f0f4a-5c00-7000-8000-000000000001', serverTime: '2026-08-06T06:00:00.000Z', keyId: 'platform-old', privateKey: oldKey.private_key,
  });
  const rotation = await rotatePlatformKeyring({
    keyring: { activeKey: { keyId: 'platform-old', publicKey: oldKey.public_key } },
    newKey: { keyId: 'platform-new', publicKey: newKey.public_key }, oldPrivateKey: oldKey.private_key,
  });
  const newReceipt = await createSignedPlatformReceipt({
    eventId: '018f0f4a-5c00-7000-8000-000000000002', serverTime: '2026-08-06T06:01:00.000Z', keyId: 'platform-new', privateKey: newKey.private_key,
  });

  assert.equal(rotation.declaration.old_key_id, 'platform-old');
  assert.equal(rotation.declaration.new_key_id, 'platform-new');
  assert.equal(await verifyPlatformReceiptWithKeyring({ receipt: oldReceipt, keyring: rotation.keyring }), true);
  assert.equal(await verifyPlatformReceiptWithKeyring({ receipt: newReceipt, keyring: rotation.keyring }), true);
  assert.equal(await verifyPlatformReceiptWithKeyring({ receipt: { ...oldReceipt, server_signature: { ...oldReceipt.server_signature, key_id: 'unknown' } }, keyring: rotation.keyring }), false);
});
