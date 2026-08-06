import test from 'node:test';
import assert from 'node:assert/strict';
import { createChunkManifest, ChunkManifestError, verifyChunkManifest } from '../src/chunk-manifest.mjs';
import { sha256Bytes } from '../src/hash.mjs';

const first = Buffer.from('Evi');
const second = Buffer.from('Mesh');

async function manifest() {
  return createChunkManifest({
    sizeBytes: first.length + second.length,
    chunks: [
      { offset: 0, sizeBytes: first.length, hash: await sha256Bytes(first) },
      { offset: first.length, sizeBytes: second.length, hash: await sha256Bytes(second) },
    ],
  });
}

test('creates a contiguous manifest with every chunk hash and offset', async () => {
  const value = await manifest();
  assert.deepEqual(value.chunks.map((chunk) => chunk.offset), [0, 3]);
  assert.equal(value.sizeBytes, 7);
  assert.throws(() => createChunkManifest({ sizeBytes: 7, chunks: [{ ...value.chunks[0], offset: 1 }] }), ChunkManifestError);
});

test('verifies all chunks and fails when one byte is tampered', async () => {
  const value = await manifest();
  const bytes = Buffer.concat([first, second]);
  const result = await verifyChunkManifest({ manifest: value, readChunk: ({ offset, sizeBytes }) => bytes.subarray(offset, offset + sizeBytes) });
  assert.deepEqual(result, { valid: true, sizeBytes: 7, chunksVerified: 2 });
  bytes[4] ^= 1;
  await assert.rejects(() => verifyChunkManifest({ manifest: value, readChunk: ({ offset, sizeBytes }) => bytes.subarray(offset, offset + sizeBytes) }), (error) => error.code === 'CHUNK_HASH_MISMATCH');
});
