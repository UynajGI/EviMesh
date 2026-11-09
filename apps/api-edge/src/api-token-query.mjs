export async function listOwnApiTokens({ repository, actorId } = {}) {
  if (!repository || typeof repository.listApiTokensByActor !== 'function') throw new TypeError('repository listApiTokensByActor is required');
  if (typeof actorId !== 'string' || !actorId.trim()) throw new TypeError('actor id is required');
  const tokens = await repository.listApiTokensByActor(actorId.trim());
  return (tokens ?? []).map(({ tokenId, tokenPrefix, label = null, agentActorId = null, scopes, createdAt = null, expiresAt, revokedAt, lastUsedAt }) => ({ tokenId, tokenPrefix, label, agentActorId, scopes, createdAt, expiresAt, revokedAt, lastUsedAt }));
}
