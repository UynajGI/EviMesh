import { sha256ReadableStream } from './hash.mjs';

export class UploadVerificationError extends Error {
  constructor(message, code = 'UPLOAD_INVALID') {
    super(message);
    this.name = 'UploadVerificationError';
    this.code = code;
  }
}

function normalizeExpectedHash(value) {
  if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/i.test(value)) {
    throw new UploadVerificationError('expected hash must be a sha256 digest');
  }
  return value.toLowerCase();
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
  if (head.size !== expectedSizeBytes) throw new UploadVerificationError('uploaded object size does not match', 'UPLOAD_SIZE_MISMATCH');
  const object = await bucket.get(key);
  if (!object?.body) throw new UploadVerificationError('uploaded object body is unavailable', 'UPLOAD_BODY_UNAVAILABLE');
  const actualHash = await sha256ReadableStream(object.body);
  if (actualHash !== expectedHash) throw new UploadVerificationError('uploaded object hash does not match', 'UPLOAD_HASH_MISMATCH');
  return Object.freeze({ key, sizeBytes: head.size, rawHash: actualHash, verified: true });
}
