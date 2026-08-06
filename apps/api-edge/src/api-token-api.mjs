import { createActorApiToken, revokeActorApiToken } from '../../../packages/domain/src/api-token.mjs';
import { listOwnApiTokens } from './api-token-query.mjs';
export const listOwnTokens = listOwnApiTokens;
export async function createOwnToken({ repository, actorId, scopes, expiresAt } = {}) { return createActorApiToken({ repository, actorId, scopes, expiresAt }); }
export async function revokeOwnToken({ repository, actorId, tokenId } = {}) { return revokeActorApiToken({ repository, actorId, tokenId }); }
