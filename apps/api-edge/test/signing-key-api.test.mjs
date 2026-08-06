import assert from 'node:assert/strict';
import test from 'node:test';
import { registerOwnSigningKey } from '../src/signing-key-api.mjs';
test('registers only the supplied public Ed25519 key for its actor', async () => { const repo = { withTransaction: async (fn) => fn(repo), findActiveSigningKey: async () => null, insertSigningKey: async (key) => key }; assert.deepEqual(await registerOwnSigningKey({ repository: repo, actorId: 'actor_1', keyId: 'key_1', publicKey: 'did:key:zExample' }), { actorId: 'actor_1', keyId: 'key_1', publicKey: 'did:key:zExample', algorithm: 'Ed25519' }); });
