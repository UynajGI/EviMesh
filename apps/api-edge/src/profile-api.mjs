import { normalizeActorProfilePatch, updateOwnActorProfile } from '../../../packages/domain/src/actor-profile.mjs';

function actorId(value) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError('authenticated actor id is required');
  return value.trim();
}

/** Read only the Profile owned by the authenticated Actor. */
export async function getOwnProfile({ repository, actorId: authenticatedActorId, accessToken } = {}) {
  const id = actorId(authenticatedActorId);
  if (!repository || typeof repository.getActorProfile !== 'function') throw new TypeError('repository getActorProfile is required');
  const profile = await repository.getActorProfile(id, { accessToken });
  if (!profile) throw Object.assign(new Error('actor profile not found'), { code: 'ACTOR_PROFILE_NOT_FOUND', status: 404 });
  return profile;
}

/** Update only the Profile owned by the authenticated Actor. */
export async function patchOwnProfile({ repository, actorId: authenticatedActorId, accessToken, patch } = {}) {
  const id = actorId(authenticatedActorId);
  patch = normalizeActorProfilePatch(patch);
  // The hosted adapter uses one atomic PostgREST upsert, including the first
  // save. It deliberately does not expose a general transaction wrapper.
  if (typeof repository?.upsertActorProfile === 'function') {
    return repository.upsertActorProfile(id, patch, { accessToken });
  }
  return updateOwnActorProfile({ repository, actorId: id, patch });
}
