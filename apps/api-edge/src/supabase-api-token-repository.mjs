import { ApiTokenError } from '../../../packages/domain/src/api-token.mjs';

/*
 * Service-only PostgREST adapter for the 0087 API-token RPCs. After 0087 no
 * browser or service role can read `api_tokens` directly; every list, revoke,
 * lookup, and usage mark goes through a SECURITY DEFINER function that checks
 * ownership and writes the audit trail in the same transaction.
 */

const RPC = Object.freeze({
  list: 'api_token_list_owned_agent_tokens',
  revoke: 'api_token_revoke_owned_agent_token',
  lookup: 'api_token_auth_lookup',
  markUsed: 'api_token_mark_used',
});

const STATUS_BY_CODE = Object.freeze({
  API_TOKEN_OWNER_FORBIDDEN: 403,
  API_TOKEN_NOT_FOUND: 404,
  API_TOKEN_NOT_ACTIVE: 404,
  API_TOKEN_ALREADY_REVOKED: 409,
  API_TOKEN_REVOCATION_INVALID: 400,
  API_TOKEN_HASH_INVALID: 400,
});

function tokenError(message, code, status) {
  const error = new ApiTokenError(message, code);
  error.status = status;
  return error;
}

function serviceHeaders(serviceRoleKey) {
  const headers = { accept: 'application/json', 'content-type': 'application/json', apikey: serviceRoleKey };
  if (!serviceRoleKey.startsWith('sb_secret_')) headers.authorization = `Bearer ${serviceRoleKey}`;
  return headers;
}

export function createSupabaseApiTokenRepository({ url, serviceRoleKey, fetchImpl = fetch } = {}) {
  const baseUrl = typeof url === 'string' && url.trim() ? url.trim().replace(/\/$/, '') : null;
  const secret = typeof serviceRoleKey === 'string' && serviceRoleKey.trim() ? serviceRoleKey.trim() : null;
  if (!baseUrl || !secret) return null;

  async function rpc(name, body) {
    let response;
    try {
      response = await fetchImpl(`${baseUrl}/rest/v1/rpc/${name}`, { method: 'POST', headers: serviceHeaders(secret), body: JSON.stringify(body) });
    } catch {
      throw tokenError('API token service is unavailable', 'API_TOKEN_UNAVAILABLE', 503);
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const tagged = /^\[([A-Z0-9_]+)\]\s*(.*)$/.exec(typeof payload?.message === 'string' ? payload.message : '');
      const code = tagged?.[1] ?? 'API_TOKEN_UNAVAILABLE';
      throw tokenError(tagged?.[2] || 'API token service is unavailable', code, STATUS_BY_CODE[code] ?? 503);
    }
    return payload;
  }

  const transaction = Object.freeze({
    revokeOwnedAgentToken: (ownerActorId, tokenId, reason) => rpc(RPC.revoke, { p_owner_actor_id: ownerActorId, p_token_id: tokenId, p_reason: reason }),
  });

  return Object.freeze({
    async listApiTokensByActor(ownerActorId) {
      const rows = await rpc(RPC.list, { p_owner_actor_id: ownerActorId });
      return Array.isArray(rows) ? rows : [];
    },
    revokeOwnedAgentToken: transaction.revokeOwnedAgentToken,
    // Each RPC is atomic in PostgreSQL; the domain's transaction boundary maps 1:1.
    withTransaction: async (callback) => callback(transaction),
    async findApiTokenByHash(tokenHash) {
      const record = await rpc(RPC.lookup, { p_token_hash: tokenHash });
      return record && typeof record === 'object' ? record : null;
    },
    async updateApiTokenLastUsedAt(tokenId) {
      return rpc(RPC.markUsed, { p_token_id: tokenId });
    },
  });
}
