import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ApiTokenManagementRepositoryError,
  createApiTokenManagementRepository,
} from '../src/api-token-management-repository.mjs';

function fakeSql({ role = 'service_role' } = {}) {
  const calls = [];
  const transaction = {
    async unsafe(query, values = []) {
      calls.push({ query, values });
      if (query.includes('current_role')) return [{ currentRole: role }];
      if (query.startsWith('SELECT "public"')) return [{ result: { query, values } }];
      return [];
    },
  };
  const sql = () => {};
  sql.calls = calls;
  sql.begin = async (callback) => callback(transaction);
  return sql;
}

test('API token repository uses only fixed safe service-role RPCs', async () => {
  const sql = fakeSql();
  const repository = createApiTokenManagementRepository(sql);
  await repository.findApiTokenByHash('A'.repeat(43));
  await repository.markApiTokenUsed('00000000-0000-7000-8000-000000000001');
  await repository.listOwnedAgentTokens('actor-owner');
  await repository.withTransaction(async (transaction) => {
    await transaction.revokeOwnedAgentToken('actor-owner', '00000000-0000-7000-8000-000000000001', 'revoked');
    await transaction.rotateOwnedAgentToken(
      'actor-owner',
      '00000000-0000-7000-8000-000000000001',
      '00000000-0000-7000-8000-000000000002',
      'rotated',
    );
  });

  const rpcQueries = sql.calls.filter(({ query }) => query.startsWith('SELECT "public"')).map(({ query }) => query);
  assert.equal(rpcQueries.length, 5);
  for (const name of [
    'api_token_auth_lookup',
    'api_token_mark_used',
    'api_token_list_owned_agent_tokens',
    'api_token_revoke_owned_agent_token',
    'api_token_rotate_owned_agent_token',
  ]) {
    assert.ok(rpcQueries.some((query) => query.includes(`"${name}"`)), `missing ${name}`);
  }
  assert.equal(sql.calls.some(({ query }) => /(?:INSERT|UPDATE|DELETE)\s+.*api_tokens/i.test(query)), false);
});

test('API token repository fails closed outside service_role', async () => {
  const repository = createApiTokenManagementRepository(fakeSql({ role: 'authenticated' }));
  await assert.rejects(
    repository.findApiTokenByHash('A'.repeat(43)),
    (error) => error instanceof ApiTokenManagementRepositoryError
      && error.code === 'API_TOKEN_SERVICE_ROLE_REQUIRED',
  );
});
