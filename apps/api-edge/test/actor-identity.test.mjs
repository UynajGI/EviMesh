import assert from 'node:assert/strict';
import test from 'node:test';
import { ActorIdentityError, resolveActorForSupabaseClaims } from '../src/actor-identity.mjs';

test('resolves only the supabase identity bound to the JWT subject', async () => {
  const calls = [];
  const actorId = await resolveActorForSupabaseClaims({ repository: { findIdentity: async (...args) => { calls.push(args); return { actorId: 'actor_1' }; } }, claims: { sub: 'user_1' } });
  assert.equal(actorId, 'actor_1'); assert.deepEqual(calls, [['supabase', 'user_1']]);
});
test('rejects unprovisioned subjects', async () => {
  await assert.rejects(() => resolveActorForSupabaseClaims({ repository: { findIdentity: async () => null }, claims: { sub: 'user_2' } }), (error) => error instanceof ActorIdentityError && error.code === 'ACTOR_IDENTITY_NOT_FOUND');
});
