import test from 'node:test';
import assert from 'node:assert/strict';
import { artifactObjectKey, sha256Bytes, sha256ReadableStream, sha256Stream } from '../src/hash.mjs';

test('hashes a stream without requiring a complete object buffer', async () => {
  async function* chunks() {
    yield new TextEncoder().encode('hello ');
    yield new TextEncoder().encode('world');
  }

  assert.equal(
    await sha256Stream(chunks()),
    'sha256:b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
  );
});
test('hashes byte arrays and rejects invalid streams', async () => {
  assert.equal(
    await sha256Bytes(new TextEncoder().encode('hello')),
    'sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
  );
  await assert.rejects(() => sha256Stream([]), /async iterable/);
  await assert.rejects(() => sha256ReadableStream({}), /ReadableStream/);
});

test('builds a content-addressed artifact object key', () => {
  assert.equal(
    artifactObjectKey({
      artifactId: 'artifact_123',
      revision: 2,
      rawHash: `sha256:${'A'.repeat(64)}`,
    }),
    `artifacts/artifact_123/revisions/2/${'a'.repeat(64)}`,
  );
  assert.throws(() => artifactObjectKey({ artifactId: 'a', revision: 0, rawHash: `sha256:${'a'.repeat(64)}` }), /positive integer/);
  assert.throws(() => artifactObjectKey({ artifactId: 'artifact_123', revision: 1, rawHash: `sha512:${'a'.repeat(64)}` }), /sha256/);
  assert.throws(() => artifactObjectKey({ artifactId: 'artifact_123', revision: 1, rawHash: `sha256:${'a'.repeat(63)}` }), /sha256/);
  assert.throws(() => artifactObjectKey({ artifactId: 'artifact_123', revision: 1, rawHash: `sha256:${'g'.repeat(64)}` }), /sha256/);
  assert.equal(
    artifactObjectKey({ artifactId: '  artifact_123  ', revision: 2, rawHash: `sha256:${'Aa'.repeat(32)}` }),
    `artifacts/artifact_123/revisions/2/${'aa'.repeat(32)}`,
  );
});
