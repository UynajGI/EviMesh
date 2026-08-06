import test from 'node:test';
import assert from 'node:assert/strict';
import { createDownloadRedirect, DownloadRedirectError } from '../src/download-redirect.mjs';

const rawHash = `sha256:${'b'.repeat(64)}`;
const now = new Date('2026-01-01T00:00:00Z');

test('creates a bounded signed GET redirect', async () => {
  const calls = [];
  const redirect = await createDownloadRedirect({ artifactId: 'artifact_1', revision: 2, rawHash, now, signer: async (input) => {
    calls.push(input);
    return { url: `https://download.example/${input.key}` };
  } });
  assert.equal(redirect.status, 302);
  assert.equal(redirect.key, `objects/sha256/${'b'.repeat(64)}`);
  assert.equal(redirect.expiresAt.getTime() - now.getTime(), 300000);
  assert.equal(calls[0].method, 'GET');
});

test('rejects invalid signer, expiry, and URL inputs', async () => {
  const base = { artifactId: 'artifact_1', revision: 1, rawHash, now, signer: async () => ({ url: 'https://download.example/object' }) };
  await assert.rejects(() => createDownloadRedirect({ ...base, signer: undefined }), DownloadRedirectError);
  await assert.rejects(() => createDownloadRedirect({ ...base, expiresInSeconds: 30 }), DownloadRedirectError);
  await assert.rejects(() => createDownloadRedirect({ ...base, expiresInSeconds: 3601 }), DownloadRedirectError);
  await assert.rejects(() => createDownloadRedirect({ ...base, expiresInSeconds: 90.5 }), DownloadRedirectError);
  await assert.rejects(() => createDownloadRedirect({ ...base, now: '2026-08-06T00:00:00.000Z' }), DownloadRedirectError);
  await assert.rejects(() => createDownloadRedirect({ ...base, now: new Date('invalid') }), DownloadRedirectError);
  await assert.rejects(() => createDownloadRedirect({ ...base, signer: async () => ({ url: 'not-a-url' }) }), DownloadRedirectError);
  await assert.rejects(() => createDownloadRedirect({ ...base, signer: async () => ({ url: 'http://download.example/object' }) }), DownloadRedirectError);
  await assert.rejects(
    () => createDownloadRedirect({ ...base, signer: async () => { throw new Error('signing unavailable'); } }),
    (error) => error.code === 'DOWNLOAD_SIGNER_FAILED' && error.cause?.message === 'signing unavailable',
  );
});

test('allows an explicitly configured local HTTP signer', async () => {
  const redirect = await createDownloadRedirect({
    artifactId: 'artifact_1', revision: 1, rawHash, now,
    signer: async () => ({ url: 'http://127.0.0.1:9000/object' }),
    allowedProtocols: ['https:', 'http:'],
  });
  assert.equal(redirect.location, 'http://127.0.0.1:9000/object');
});
