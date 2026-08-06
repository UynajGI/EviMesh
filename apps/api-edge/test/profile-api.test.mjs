import assert from 'node:assert/strict';
import test from 'node:test';
import { getOwnProfile, patchOwnProfile } from '../src/profile-api.mjs';

test('profile API uses only the authenticated actor id', async () => {
  const calls = [];
  const repository = { getActorProfile: async (actorId) => ({ actorId, displayName: 'Ada' }), withTransaction: async (fn) => fn(repository), updateActorProfile: async (actorId, patch) => { calls.push({ actorId, patch }); return { actorId, ...patch }; } };
  assert.deepEqual(await getOwnProfile({ repository, actorId: 'actor_ada' }), { actorId: 'actor_ada', displayName: 'Ada' });
  assert.deepEqual(await patchOwnProfile({ repository, actorId: 'actor_ada', patch: { bio: 'Researcher' } }), { actorId: 'actor_ada', bio: 'Researcher' });
  assert.deepEqual(calls, [{ actorId: 'actor_ada', patch: { bio: 'Researcher' } }]);
});
