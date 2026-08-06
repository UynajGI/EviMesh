import { SHA256_DIGEST_LENGTH, SHA256_PREFIX, sha256ReadableStream } from './hash.mjs';

export class UploadVerificationError extends Error {
  constructor(message, code = 'UPLOAD_INVALID') {
    super(message);
    this.name = 'UploadVerificationError';
    this.code = code;
  }
}

function normalizeExpectedHash(value) {
  if (typeof value !== 'string') {
    throw new UploadVerificationError('expected hash must be a sha256 digest');
  }
  const normalized = value.toLowerCase();
  const prefix = SHA256_PREFIX.toLowerCase();
  const digest = normalized.slice(prefix.length);
  if (!normalized.startsWith(prefix) || digest.length !== SHA256_DIGEST_LENGTH || !/^[0-9a-f]+$/.test(digest)) {
    throw new UploadVerificationError('expected hash must be a sha256 digest');
  }
  return normalized;
}

/** Verify an uploaded R2 object before it is accepted as an Artifact. */
export async function verifyR2Object({ bucket, key, expectedSizeBytes, expectedHash: rawExpectedHash } = {}) {
  if (!bucket || typeof bucket.head !== 'function' || typeof bucket.get !== 'function') {
    throw new UploadVerificationError('R2 bucket with head and get is required');
  }
  if (typeof key !== 'string' || key.trim().length === 0) throw new UploadVerificationError('object key is required');
  if (!Number.isInteger(expectedSizeBytes) || expectedSizeBytes < 0) throw new UploadVerificationError('expected size must be a non-negative integer');
  const expectedHash = normalizeExpectedHash(rawExpectedHash);
  const head = await bucket.head(key);
  if (!head) throw new UploadVerificationError('uploaded object not found', 'UPLOAD_NOT_FOUND');
  if (!Number.isInteger(head.size) || head.size < 0) throw new UploadVerificationError('uploaded object size is invalid', 'UPLOAD_METADATA_INVALID');
  if (head.size !== expectedSizeBytes) throw new UploadVerificationError('uploaded object size does not match', 'UPLOAD_SIZE_MISMATCH');
  const object = await bucket.get(key);
  if (!object?.body || typeof object.body.getReader !== 'function') throw new UploadVerificationError('uploaded object body is unavailable', 'UPLOAD_BODY_UNAVAILABLE');
  let actualHash;
  try {
    actualHash = await sha256ReadableStream(object.body);
  } catch (error) {
    throw new UploadVerificationError('uploaded object body could not be read', 'UPLOAD_BODY_UNAVAILABLE', { cause: error });
  }
  if (actualHash !== expectedHash) throw new UploadVerificationError('uploaded object hash does not match', 'UPLOAD_HASH_MISMATCH');
  return Object.freeze({ key, sizeBytes: head.size, rawHash: actualHash, verified: true });
}
