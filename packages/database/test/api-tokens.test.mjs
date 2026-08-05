import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { apiTokens } from '../src/api-tokens.mjs';

test('api_tokens stores only hashed token credentials and lifecycle state', () => {
  const columns = getTableColumns(apiTokens);
  const config = getTableConfig(apiTokens);

  assert.equal(columns.tokenId.name, 'token_id');
  assert.equal(columns.tokenId.primary, true);
  assert.equal(columns.tokenHash.name, 'token_hash');
  assert.equal(columns.tokenHash.notNull, true);
  assert.equal(columns.tokenPrefix.name, 'token_prefix');
  assert.equal(columns.tokenPrefix.notNull, true);
  assert.equal(columns.scopes.name, 'scopes');
  assert.equal(columns.scopes.notNull, true);
  assert.equal(columns.scopes.hasDefault, true);
  assert.equal(columns.expiresAt.name, 'expires_at');
  assert.equal(columns.revokedAt.name, 'revoked_at');
  assert.equal(columns.lastUsedAt.name, 'last_used_at');
  assert.ok(config.uniqueConstraints.some((constraint) =>
    constraint.name === 'api_tokens_token_hash_unique'));
});
