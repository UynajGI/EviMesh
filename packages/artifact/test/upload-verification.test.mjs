import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyR2Object } from '../src/upload-verification.mjs';

function stream(text) {
  return new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(text)); controller.close(); } });
}

function bucketFor(text) {
  const bytes = new TextEncoder().encode(text);
  return {
    head: async () => ({ size: bytes.byteLength }),
    get: async () => ({ body: stream(text) }),
  };
}

test('verifies R2 object size and streamed content hash', async () => {
  const result = await verifyR2Object({ bucket: bucketFor('hello'), key: 'k', expectedSizeBytes: 5, expectedHash: 'sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824' });
  assert.deepEqual(result, { key: 'k', sizeBytes: 5, rawHash: 'sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824', verified: true });
});
test('rejects mismatched size and hash before acceptance', async () => {
  await assert.rejects(() => verifyR2Object({ bucket: bucketFor('hello'), key: 'k', expectedSizeBytes: 4, expectedHash: `sha256:${'a'.repeat(64)}` }), (error) => error.code === 'UPLOAD_SIZE_MISMATCH' && /size does not match/.test(error.message));
  await assert.rejects(() => verifyR2Object({ bucket: bucketFor('hello'), key: 'k', expectedSizeBytes: 5, expectedHash: `sha256:${'a'.repeat(64)}` }), (error) => error.code === 'UPLOAD_HASH_MISMATCH' && /hash does not match/.test(error.message));
});

test('rejects malformed verifier inputs and unavailable objects', async () => {
  await assert.rejects(() => verifyR2Object({ bucket: {}, key: 'k', expectedSizeBytes: 5, expectedHash: `sha256:${'a'.repeat(64)}` }), /head and get/);
  await assert.rejects(() => verifyR2Object({ bucket: bucketFor('hello'), key: '  ', expectedSizeBytes: 5, expectedHash: `sha256:${'a'.repeat(64)}` }), /object key/);
  await assert.rejects(() => verifyR2Object({ bucket: bucketFor('hello'), key: 'k', expectedSizeBytes: -1, expectedHash: `sha256:${'a'.repeat(64)}` }), /expected size/);
  await assert.rejects(() => verifyR2Object({ bucket: bucketFor('hello'), key: 'k', expectedSizeBytes: 5, expectedHash: 'sha512:bad' }), /expected hash/);
  await assert.rejects(() => verifyR2Object({ bucket: { head: async () => null, get: async () => null }, key: 'k', expectedSizeBytes: 5, expectedHash: `sha256:${'a'.repeat(64)}` }), (error) => error.code === 'UPLOAD_NOT_FOUND');
  await assert.rejects(() => verifyR2Object({ bucket: { head: async () => ({ size: 5 }), get: async () => ({}) }, key: 'k', expectedSizeBytes: 5, expectedHash: `sha256:${'a'.repeat(64)}` }), (error) => error.code === 'UPLOAD_BODY_UNAVAILABLE');
  await assert.rejects(() => verifyR2Object({ bucket: { head: async () => ({ size: '5' }), get: async () => ({}) }, key: 'k', expectedSizeBytes: 5, expectedHash: `sha256:${'a'.repeat(64)}` }), (error) => error.code === 'UPLOAD_METADATA_INVALID');
});
