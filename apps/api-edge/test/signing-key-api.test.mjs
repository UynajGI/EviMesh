import assert from 'node:assert/strict';
import test from 'node:test';
import { registerOwnSigningKey } from '../src/signing-key-api.mjs';

const PUBLIC_KEY = Buffer.concat([
  Buffer.from('302a300506032b6570032100', 'hex'),
  Buffer.alloc(32, 1),
]).toString('base64url');

test('registers only the supplied public Ed25519 key for its actor', async () => {
  const repo = {
    withTransaction: async (fn) => fn(repo),
    findActiveSigningKey: async () => null,
    insertSigningKey: async (key) => key,
  };
  assert.deepEqual(await registerOwnSigningKey({ repository: repo, actorId: 'actor_1', keyId: 'key_1', publicKey: PUBLIC_KEY }), {
    actorId: 'actor_1',
    keyId: 'key_1',
    publicKey: PUBLIC_KEY,
    algorithm: 'Ed25519',
  });
});
