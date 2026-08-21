export class ActorIdentityError extends Error {
  constructor(message, code = 'ACTOR_IDENTITY_UNAVAILABLE', status = 401) { super(message); this.code = code; this.status = status; }
}

/** Resolve an authenticated Supabase subject through the stable identity binding.
 * `accessToken` (optional) lets token-aware repositories read the binding under
 * the caller's own RLS scope; repositories without that option ignore it. */
export async function resolveActorForSupabaseClaims({ repository, claims, accessToken = null } = {}) {
  // API-token claims already carry the resolved actor; no identity lookup needed.
  if (claims?.kind === 'api_token' && typeof claims.actorId === 'string' && claims.actorId.trim()) {
    return claims.actorId.trim();
  }
  if (!repository || typeof repository.findIdentity !== 'function') throw new ActorIdentityError('repository findIdentity is required', 'ACTOR_IDENTITY_REPOSITORY_INVALID', 500);
  const subject = claims?.sub;
  if (typeof subject !== 'string' || !subject.trim()) throw new ActorIdentityError('authenticated subject is required');
  const identity = await repository.findIdentity('supabase', subject.trim(), ...(accessToken ? [{ accessToken }] : []));
  const actorId = identity?.actorId ?? identity?.actor?.actorId;
  if (typeof actorId !== 'string' || !actorId.trim()) throw new ActorIdentityError('authenticated actor identity is not provisioned', 'ACTOR_IDENTITY_NOT_FOUND', 403);
  return actorId.trim();
}
