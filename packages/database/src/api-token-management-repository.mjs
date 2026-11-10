const SERVICE_ROLE = 'service_role';

export class ApiTokenManagementRepositoryError extends Error {
  constructor(message, code = 'API_TOKEN_REPOSITORY_INVALID', status = 500) {
    super(message);
    this.name = 'ApiTokenManagementRepositoryError';
    this.code = code;
    this.status = status;
  }
}

function assertSqlClient(sql) {
  if (typeof sql !== 'function' || typeof sql.begin !== 'function') {
    throw new ApiTokenManagementRepositoryError('a Postgres.js client with begin() is required');
  }
}

async function rpc(transaction, name, values) {
  const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
  const rows = await transaction.unsafe(`SELECT "public"."${name}"(${placeholders}) AS result`, values);
  return rows?.[0]?.result ?? null;
}

async function asServiceRole(sql, callback) {
  return sql.begin(async (transaction) => {
    if (typeof transaction.unsafe !== 'function') {
      throw new ApiTokenManagementRepositoryError('Postgres transaction executor is invalid');
    }
    await transaction.unsafe('SET LOCAL ROLE service_role');
    const roleRows = await transaction.unsafe('SELECT current_role::text AS "currentRole"');
    if (roleRows?.[0]?.currentRole !== SERVICE_ROLE) {
      throw new ApiTokenManagementRepositoryError(
        'repository must execute as service_role',
        'API_TOKEN_SERVICE_ROLE_REQUIRED',
        403,
      );
    }
    return callback(transaction);
  });
}

function transactionMethods(transaction) {
  return Object.freeze({
    revokeOwnedAgentToken: (ownerActorId, tokenId, reason) => rpc(
      transaction,
      'api_token_revoke_owned_agent_token',
      [ownerActorId, tokenId, reason],
    ),
    revokeApiToken: (ownerActorId, tokenId, reason) => rpc(
      transaction,
      'api_token_revoke_owned_agent_token',
      [ownerActorId, tokenId, reason],
    ),
    rotateOwnedAgentToken: (ownerActorId, oldTokenId, newTokenId, reason) => rpc(
      transaction,
      'api_token_rotate_owned_agent_token',
      [ownerActorId, oldTokenId, newTokenId, reason],
    ),
  });
}

/** Service-only safe projection and lifecycle adapter; never returns token_hash. */
export function createApiTokenManagementRepository(sql) {
  assertSqlClient(sql);
  return Object.freeze({
    withTransaction: (callback) => asServiceRole(sql, (transaction) => callback(transactionMethods(transaction))),
    findApiTokenByHash: (tokenHash) => asServiceRole(
      sql,
      (transaction) => rpc(transaction, 'api_token_auth_lookup', [tokenHash]),
    ),
    markApiTokenUsed: (tokenId) => asServiceRole(
      sql,
      (transaction) => rpc(transaction, 'api_token_mark_used', [tokenId]),
    ),
    updateApiTokenLastUsedAt: (tokenId) => asServiceRole(
      sql,
      (transaction) => rpc(transaction, 'api_token_mark_used', [tokenId]),
    ),
    listOwnedAgentTokens: (ownerActorId) => asServiceRole(
      sql,
      (transaction) => rpc(transaction, 'api_token_list_owned_agent_tokens', [ownerActorId]),
    ),
    listApiTokensByActor: (ownerActorId) => asServiceRole(
      sql,
      (transaction) => rpc(transaction, 'api_token_list_owned_agent_tokens', [ownerActorId]),
    ),
  });
}
