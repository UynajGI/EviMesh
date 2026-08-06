import { createHash } from 'node:crypto';

const SHA256_PREFIX = 'sha256:';

function assertChunk(chunk) {
  if (!(typeof chunk === 'string' || chunk instanceof Uint8Array || Buffer.isBuffer(chunk))) {
    throw new TypeError('hash chunks must be strings or byte arrays');
  }
}
/** Hash an async iterable of chunks without buffering the complete object. */
export async function sha256Stream(chunks) {
  if (!chunks || typeof chunks[Symbol.asyncIterator] !== 'function') {
    throw new TypeError('sha256Stream requires an async iterable');
  }

  const hash = createHash('sha256');
  for await (const chunk of chunks) {
    assertChunk(chunk);
    hash.update(chunk);
  }
  return `${SHA256_PREFIX}${hash.digest('hex')}`;
}

export async function sha256Bytes(bytes) {
  if (!(bytes instanceof Uint8Array || Buffer.isBuffer(bytes))) {
    throw new TypeError('sha256Bytes requires a byte array');
  }
  return sha256Stream((async function* () { yield bytes; })());
}

export function artifactObjectKey({ artifactId, revision, rawHash } = {}) {
  if (typeof artifactId !== 'string' || artifactId.trim().length === 0) {
    throw new TypeError('artifact id must be a non-empty string');
  }
  if (!Number.isInteger(revision) || revision < 1) {
    throw new TypeError('artifact revision must be a positive integer');
  }
  if (typeof rawHash !== 'string' || !/^sha256:[0-9a-f]{64}$/i.test(rawHash)) {
    throw new TypeError('raw hash must be a sha256 digest');
  }
  return `artifacts/${artifactId.trim()}/revisions/${revision}/${rawHash.slice(SHA256_PREFIX.length).toLowerCase()}`;
}
