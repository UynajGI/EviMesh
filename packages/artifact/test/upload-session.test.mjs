import test from 'node:test';
import assert from 'node:assert/strict';
import { abortMultipartUploadSession, completeMultipartUploadSession, createMultipartUploadSession, createSingleUploadPlan, UploadSessionError } from '../src/upload-session.mjs';

const hash = `sha256:${'a'.repeat(64)}`;
const now = new Date('2026-01-01T00:00:00Z');

test('creates a signed single upload plan with a bounded expiry', async () => {
  const plan = await createSingleUploadPlan({ artifactId: 'artifact_1', revision: 1, rawHash: hash, sizeBytes: 12, mediaType: 'application/json', now, signer: async (input) => ({ url: `https://upload.example/${input.key}` }) });
  assert.equal(plan.uploadType, 'single');
  assert.equal(plan.key, `objects/sha256/${'a'.repeat(64)}`);
  assert.equal(plan.expiresAt.getTime() - now.getTime(), 900000);
});

test('rejects invalid single upload plan inputs', async () => {
  const base = { artifactId: 'artifact_1', revision: 1, rawHash: hash, sizeBytes: 12, mediaType: 'application/json', now, signer: async () => ({ url: 'https://upload.example/object' }) };
  await assert.rejects(() => createSingleUploadPlan({ ...base, sizeBytes: -1 }), UploadSessionError);
  await assert.rejects(() => createSingleUploadPlan({ ...base, sizeBytes: 1.5 }), UploadSessionError);
  await assert.rejects(() => createSingleUploadPlan({ ...base, mediaType: ' ' }), UploadSessionError);
  await assert.rejects(() => createSingleUploadPlan({ ...base, signer: undefined }), UploadSessionError);
  await assert.rejects(() => createSingleUploadPlan({ ...base, signer: async () => ({ url: 'not-a-url' }) }), UploadSessionError);
  await assert.rejects(() => createSingleUploadPlan({ ...base, expiresInSeconds: 30 }), UploadSessionError);
  await assert.rejects(() => createSingleUploadPlan({ ...base, expiresInSeconds: 60.5 }), UploadSessionError);
});

test('starts, completes, and aborts a multipart session', async () => {
  const calls = [];
  const upload = { uploadId: 'upload_1', complete: async (parts) => { calls.push(['complete', parts]); return { etag: 'final' }; }, abort: async () => { calls.push(['abort']); } };
  const session = await createMultipartUploadSession({ bucket: { createMultipartUpload: async (key) => { calls.push(['start', key]); return upload; } }, artifactId: 'artifact_1', revision: 1, rawHash: hash, now });
  const result = await completeMultipartUploadSession({ session, now: new Date('2026-01-01T00:01:00Z'), parts: [{ partNumber: 2, etag: 'b' }, { partNumber: 1, etag: 'a' }] });
  await abortMultipartUploadSession({ session, now: new Date('2026-01-01T00:02:00Z') });
  assert.deepEqual(result, { etag: 'final' });
  assert.deepEqual(calls, [['start', session.key], ['complete', [{ partNumber: 1, etag: 'a' }, { partNumber: 2, etag: 'b' }]], ['abort']]);
});

test('rejects expired or malformed multipart sessions', async () => {
  const session = await createMultipartUploadSession({ bucket: { createMultipartUpload: async () => ({ uploadId: 'u', complete: async () => {}, abort: async () => {} }) }, artifactId: 'artifact_1', revision: 1, rawHash: hash, now });
  await assert.rejects(() => completeMultipartUploadSession({ session, now: new Date('2026-01-01T01:00:00Z'), parts: [{ partNumber: 1, etag: 'a' }] }), /expired/);
  await assert.rejects(() => completeMultipartUploadSession({ session, now: new Date('2026-01-01T00:01:00Z'), parts: [{ partNumber: 1, etag: 'a' }, { partNumber: 1, etag: 'b' }] }), /unique/);
});

test('allows abort after expiry and rejects missing multipart methods', async () => {
  const session = await createMultipartUploadSession({ bucket: { createMultipartUpload: async () => ({ uploadId: 'u', complete: async () => ({ etag: 'final' }), abort: async () => 'aborted' }) }, artifactId: 'artifact_1', revision: 1, rawHash: hash, now });
  assert.equal(await abortMultipartUploadSession({ session, now: new Date('2026-01-01T01:00:00Z') }), 'aborted');
  await assert.rejects(() => completeMultipartUploadSession({ session: { ...session, upload: { ...session.upload, complete: undefined } }, now, parts: [{ partNumber: 1, etag: 'a' }] }), UploadSessionError);
  await assert.rejects(() => abortMultipartUploadSession({ session: { ...session, upload: { ...session.upload, abort: undefined } }, now }), UploadSessionError);
});
