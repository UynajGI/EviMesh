import test from 'node:test';
import assert from 'node:assert/strict';
import { abortMultipartUploadSession, completeMultipartUploadSession, createMultipartUploadSession, createSingleUploadPlan } from '../src/upload-session.mjs';

const hash = `sha256:${'a'.repeat(64)}`;
const now = new Date('2026-01-01T00:00:00Z');

test('creates a signed single upload plan with a bounded expiry', async () => {
  const plan = await createSingleUploadPlan({ artifactId: 'artifact_1', revision: 1, rawHash: hash, sizeBytes: 12, mediaType: 'application/json', now, signer: async (input) => ({ url: `https://upload.example/${input.key}` }) });
  assert.equal(plan.uploadType, 'single');
  assert.equal(plan.key, `artifacts/artifact_1/revisions/1/${'a'.repeat(64)}`);
  assert.equal(plan.expiresAt.getTime() - now.getTime(), 900000);
});
test('starts, completes, and aborts a multipart session', async () => {
  const calls = [];
  const upload = { uploadId: 'upload_1', complete: async (parts) => { calls.push(['complete', parts]); return { etag: 'final' }; }, abort: async () => { calls.push(['abort']); } };
  const session = await createMultipartUploadSession({ bucket: { createMultipartUpload: async (key) => { calls.push(['start', key]); return upload; } }, artifactId: 'artifact_1', revision: 1, rawHash: hash, now });
  await completeMultipartUploadSession({ session, now: new Date('2026-01-01T00:01:00Z'), parts: [{ partNumber: 2, etag: 'b' }, { partNumber: 1, etag: 'a' }] });
  await abortMultipartUploadSession({ session, now: new Date('2026-01-01T00:02:00Z') });
  assert.deepEqual(calls, [['start', session.key], ['complete', [{ partNumber: 1, etag: 'a' }, { partNumber: 2, etag: 'b' }]], ['abort']]);
});

test('rejects expired or malformed multipart sessions', async () => {
  const session = await createMultipartUploadSession({ bucket: { createMultipartUpload: async () => ({ uploadId: 'u', complete: async () => {}, abort: async () => {} }) }, artifactId: 'artifact_1', revision: 1, rawHash: hash, now });
  await assert.rejects(() => completeMultipartUploadSession({ session, now: new Date('2026-01-01T01:00:00Z'), parts: [{ partNumber: 1, etag: 'a' }] }), /expired/);
  await assert.rejects(() => completeMultipartUploadSession({ session, now: new Date('2026-01-01T00:01:00Z'), parts: [{ partNumber: 1, etag: 'a' }, { partNumber: 1, etag: 'b' }] }), /unique/);
});
