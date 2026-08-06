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
  assert.equal(redirect.key, `artifacts/artifact_1/revisions/2/${'b'.repeat(64)}`);
  assert.equal(redirect.expiresAt.getTime() - now.getTime(), 300000);
  assert.equal(calls[0].method, 'GET');
});

test('rejects invalid signer, expiry, and URL inputs', async () => {
  const base = { artifactId: 'artifact_1', revision: 1, rawHash, now, signer: async () => ({ url: 'https://download.example/object' }) };
  await assert.rejects(() => createDownloadRedirect({ ...base, signer: undefined }), DownloadRedirectError);
  await assert.rejects(() => createDownloadRedirect({ ...base, expiresInSeconds: 30 }), DownloadRedirectError);
  await assert.rejects(() => createDownloadRedirect({ ...base, signer: async () => ({ url: 'not-a-url' }) }), DownloadRedirectError);
});
