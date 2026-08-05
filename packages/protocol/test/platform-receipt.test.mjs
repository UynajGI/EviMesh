import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlatformReceipt } from '../src/platform-receipt.mjs';

const validReceipt = {
  eventId: '018f0f4a-5c00-7000-8000-000000000001',
  serverTime: '2026-08-04T06:00:00.000Z',
  serverSignature: { algorithm: 'Ed25519', key_id: 'server-key-01', value: 'signature-bytes' },
};

test('creates an immutable Platform Receipt', () => {
  const receipt = createPlatformReceipt(validReceipt);

  assert.deepEqual(receipt, {
    schema: 'srp.platform-receipt.v1',
    server_time: validReceipt.serverTime,
    event_id: validReceipt.eventId,
    server_signature: validReceipt.serverSignature,
  });
  assert.equal(Object.isFrozen(receipt), true);
  assert.equal(Object.isFrozen(receipt.server_signature), true);
});

test('rejects incomplete or malformed receipt fields', () => {
  assert.throws(() => createPlatformReceipt({ ...validReceipt, eventId: 'not-an-id' }), /UUIDv7/);
  assert.throws(() => createPlatformReceipt({ ...validReceipt, serverTime: 'not-a-time' }), /ISO-8601/);
  assert.throws(() => createPlatformReceipt({ ...validReceipt, serverSignature: undefined }), /signature/);
});
