import assert from 'node:assert/strict'; import test from 'node:test'; import { listOwnApiTokens } from '../src/api-token-query.mjs';
test('lists only safe API token metadata', async () => {
  const tokens = await listOwnApiTokens({ actorId: 'actor_1', repository: { listApiTokensByActor: async () => [{ tokenId: 'token_1', tokenPrefix: 'evimesh_abc', tokenHash: 'secret-hash', label: 'cli', agentActorId: 'agent_1', scopes: ['read'], createdAt: '2026-11-01', expiresAt: null, revokedAt: null, lastUsedAt: null, rotatedFromTokenId: 'old' }] } });
  assert.deepEqual(tokens, [{ tokenId: 'token_1', tokenPrefix: 'evimesh_abc', label: 'cli', agentActorId: 'agent_1', scopes: ['read'], createdAt: '2026-11-01', expiresAt: null, revokedAt: null, lastUsedAt: null }]);
  assert.equal(JSON.stringify(tokens).includes('secret-hash'), false);
});
