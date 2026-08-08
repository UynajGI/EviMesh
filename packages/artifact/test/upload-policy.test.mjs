import test from 'node:test';
import assert from 'node:assert/strict';
import { assertUploadPolicy, DEFAULT_MAX_UPLOAD_SIZE_BYTES, UploadPolicyError } from '../src/upload-policy.mjs';

test('allows ordinary scientific upload metadata', () => {
  assert.deepEqual(
    assertUploadPolicy({ sizeBytes: 12, mediaType: 'Text/CSV; charset=utf-8', fileName: 'results.csv' }),
    { sizeBytes: 12, mediaType: 'text/csv', fileName: 'results.csv', maxSizeBytes: DEFAULT_MAX_UPLOAD_SIZE_BYTES },
  );
});

test('rejects forbidden media types and extensions with a stable code', () => {
  assert.throws(
    () => assertUploadPolicy({ sizeBytes: 1, mediaType: 'application/x-msdownload' }),
    (error) => error instanceof UploadPolicyError && error.code === 'UPLOAD_MEDIA_TYPE_DENIED',
  );
  assert.throws(
    () => assertUploadPolicy({ sizeBytes: 1, mediaType: 'application/octet-stream', fileName: 'payload.EXE' }),
    (error) => error instanceof UploadPolicyError && error.code === 'UPLOAD_MEDIA_TYPE_DENIED',
  );
});

test('rejects uploads larger than the configured quota with a stable code', () => {
  assert.throws(
    () => assertUploadPolicy({ sizeBytes: 11, maxSizeBytes: 10, mediaType: 'text/plain' }),
    (error) => error instanceof UploadPolicyError && error.code === 'UPLOAD_SIZE_QUOTA_EXCEEDED',
  );
});
