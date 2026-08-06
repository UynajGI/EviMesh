export class ActorIdentityError extends Error {
  constructor(message, code = 'ACTOR_IDENTITY_UNAVAILABLE', status = 401) { super(message); this.code = code; this.status = status; }
}

/** Resolve an authenticated Supabase subject through the stable identity binding. */
export async function resolveActorForSupabaseClaims({ repository, claims } = {}) {
  if (!repository || typeof repository.findIdentity !== 'function') throw new ActorIdentityError('repository findIdentity is required', 'ACTOR_IDENTITY_REPOSITORY_INVALID', 500);
  const subject = claims?.sub;
  if (typeof subject !== 'string' || !subject.trim()) throw new ActorIdentityError('authenticated subject is required');
  const identity = await repository.findIdentity('supabase', subject.trim());
  const actorId = identity?.actorId ?? identity?.actor?.actorId;
  if (typeof actorId !== 'string' || !actorId.trim()) throw new ActorIdentityError('authenticated actor identity is not provisioned', 'ACTOR_IDENTITY_NOT_FOUND', 403);
  return actorId.trim();
}
