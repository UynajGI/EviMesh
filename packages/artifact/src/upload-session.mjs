import { artifactObjectKey } from './hash.mjs';

const DEFAULT_EXPIRY_SECONDS = 900;
const MAX_EXPIRY_SECONDS = 3600;

export class UploadSessionError extends Error {
  constructor(message, code = 'UPLOAD_SESSION_INVALID') {
    super(message);
    this.name = 'UploadSessionError';
    this.code = code;
  }
}
function validExpiry(seconds) {
  if (!Number.isInteger(seconds) || seconds < 60 || seconds > MAX_EXPIRY_SECONDS) {
    throw new UploadSessionError(`expiry must be an integer between 60 and ${MAX_EXPIRY_SECONDS} seconds`);
  }
  return seconds;
}

function validNow(now) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new UploadSessionError('now must be a valid Date');
  return now;
}

function sessionFields({ artifactId, revision, rawHash, expiresInSeconds, now }) {
  const key = artifactObjectKey({ artifactId, revision, rawHash });
  const issuedAt = validNow(now);
  const expiresAt = new Date(issuedAt.getTime() + validExpiry(expiresInSeconds) * 1000);
  return { key, issuedAt, expiresAt };
}

function assertActive(session, now) {
  if (!session || !(session.expiresAt instanceof Date) || validNow(now) >= session.expiresAt) {
    throw new UploadSessionError('upload session has expired', 'UPLOAD_SESSION_EXPIRED');
  }
}

/** Build a signed single-object upload plan without exposing storage credentials. */
export async function createSingleUploadPlan({ artifactId, revision, rawHash, sizeBytes, mediaType, signer, expiresInSeconds = DEFAULT_EXPIRY_SECONDS, now = new Date() } = {}) {
  if (!Number.isInteger(sizeBytes) || sizeBytes < 0) throw new UploadSessionError('size bytes must be a non-negative integer');
  if (typeof mediaType !== 'string' || mediaType.trim().length === 0) throw new UploadSessionError('media type is required');
  if (typeof signer !== 'function') throw new UploadSessionError('upload signer is required');
  const fields = sessionFields({ artifactId, revision, rawHash, expiresInSeconds, now });
  const signed = await signer({ key: fields.key, method: 'PUT', sizeBytes, mediaType: mediaType.trim(), expiresAt: fields.expiresAt });
  if (!signed || typeof signed.url !== 'string' || signed.url.length === 0) throw new UploadSessionError('upload signer returned an invalid URL');
  return Object.freeze({ uploadType: 'single', key: fields.key, sizeBytes, mediaType: mediaType.trim(), issuedAt: fields.issuedAt, expiresAt: fields.expiresAt, url: signed.url });
}

/** Start an R2 multipart upload for a content-addressed Artifact revision. */
export async function createMultipartUploadSession({ bucket, artifactId, revision, rawHash, expiresInSeconds = DEFAULT_EXPIRY_SECONDS, now = new Date() } = {}) {
  if (!bucket || typeof bucket.createMultipartUpload !== 'function') throw new UploadSessionError('R2 bucket createMultipartUpload is required');
  const fields = sessionFields({ artifactId, revision, rawHash, expiresInSeconds, now });
  const upload = await bucket.createMultipartUpload(fields.key);
  if (!upload || typeof upload.uploadId !== 'string' || upload.uploadId.length === 0) throw new UploadSessionError('R2 returned an invalid multipart upload');
  return Object.freeze({ uploadType: 'multipart', key: fields.key, uploadId: upload.uploadId, issuedAt: fields.issuedAt, expiresAt: fields.expiresAt, upload });
}

function normalizeParts(parts) {
  if (!Array.isArray(parts) || parts.length === 0) throw new UploadSessionError('multipart parts are required');
  const normalized = parts.map((part) => {
    if (!Number.isInteger(part?.partNumber) || part.partNumber < 1 || typeof part.etag !== 'string' || part.etag.trim().length === 0) throw new UploadSessionError('each multipart part requires a positive part number and ETag');
    return { partNumber: part.partNumber, etag: part.etag.trim() };
  }).sort((left, right) => left.partNumber - right.partNumber);
  if (new Set(normalized.map((part) => part.partNumber)).size !== normalized.length) throw new UploadSessionError('multipart part numbers must be unique');
  return normalized;
}

export async function completeMultipartUploadSession({ session, parts, now = new Date() } = {}) {
  assertActive(session, now);
  if (!session.upload || typeof session.upload.complete !== 'function') throw new UploadSessionError('multipart upload complete is required');
  return session.upload.complete(normalizeParts(parts));
}

export async function abortMultipartUploadSession({ session, now = new Date() } = {}) {
  assertActive(session, now);
  if (!session.upload || typeof session.upload.abort !== 'function') throw new UploadSessionError('multipart upload abort is required');
  return session.upload.abort();
}
