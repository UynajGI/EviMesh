import { SHA256_DIGEST_LENGTH, SHA256_PREFIX, sha256Bytes } from './hash.mjs';

const HASH_PATTERN = new RegExp(`^${SHA256_PREFIX}[0-9a-f]{${SHA256_DIGEST_LENGTH}}$`, 'i');

export class ChunkManifestError extends Error {
  constructor(message, code = 'CHUNK_MANIFEST_INVALID') {
    super(message);
    this.name = 'ChunkManifestError';
    this.code = code;
  }
}

function nonNegativeInteger(value, field) {
  if (!Number.isInteger(value) || value < 0) throw new ChunkManifestError(`${field} must be a non-negative integer`);
  return value;
}

function normalizeChunk(chunk, index, expectedOffset) {
  if (!chunk || typeof chunk !== 'object' || Array.isArray(chunk)) throw new ChunkManifestError(`chunks[${index}] must be an object`);
  const offset = nonNegativeInteger(chunk.offset, `chunks[${index}].offset`);
  const sizeBytes = nonNegativeInteger(chunk.sizeBytes, `chunks[${index}].sizeBytes`);
  if (sizeBytes === 0) throw new ChunkManifestError(`chunks[${index}].sizeBytes must be positive`);
  if (offset !== expectedOffset) throw new ChunkManifestError(`chunks[${index}].offset must be contiguous`);
  if (typeof chunk.hash !== 'string' || !HASH_PATTERN.test(chunk.hash)) throw new ChunkManifestError(`chunks[${index}].hash must be a sha256 digest`);
  return Object.freeze({ offset, sizeBytes, hash: chunk.hash.toLowerCase() });
}

/** Create a contiguous, content-addressed manifest for a streamed Artifact object. */
export function createChunkManifest({ sizeBytes, chunks } = {}) {
  sizeBytes = nonNegativeInteger(sizeBytes, 'sizeBytes');
  if (!Array.isArray(chunks)) throw new ChunkManifestError('chunks must be an array');
  let expectedOffset = 0;
  const normalizedChunks = chunks.map((chunk, index) => {
    const normalized = normalizeChunk(chunk, index, expectedOffset);
    expectedOffset += normalized.sizeBytes;
    return normalized;
  });
  if (expectedOffset !== sizeBytes) throw new ChunkManifestError('chunk sizes must equal sizeBytes');
  return Object.freeze({ sizeBytes, chunks: Object.freeze(normalizedChunks) });
}

/** Verify every manifest chunk against a reader that returns its exact bytes. */
export async function verifyChunkManifest({ manifest, readChunk } = {}) {
  const normalized = createChunkManifest(manifest);
  if (typeof readChunk !== 'function') throw new ChunkManifestError('readChunk must be a function');
  for (const chunk of normalized.chunks) {
    const bytes = await readChunk({ offset: chunk.offset, sizeBytes: chunk.sizeBytes });
    if (!(bytes instanceof Uint8Array || Buffer.isBuffer(bytes))) throw new ChunkManifestError('readChunk must return a byte array', 'CHUNK_READER_INVALID');
    if (bytes.byteLength !== chunk.sizeBytes) throw new ChunkManifestError('readChunk returned an unexpected byte length', 'CHUNK_SIZE_MISMATCH');
    if (await sha256Bytes(bytes) !== chunk.hash) throw new ChunkManifestError('chunk hash does not match manifest', 'CHUNK_HASH_MISMATCH');
  }
  return Object.freeze({ valid: true, sizeBytes: normalized.sizeBytes, chunksVerified: normalized.chunks.length });
}
