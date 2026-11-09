import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { apiTokens } from '../src/api-tokens.mjs';
import { apiTokenAuditEvents } from '../src/api-token-audit.mjs';

test('api_tokens stores only hashed token credentials and lifecycle state', () => {
  const columns = getTableColumns(apiTokens);
  const config = getTableConfig(apiTokens);

  assert.equal(columns.tokenId.name, 'token_id');
  assert.equal(columns.tokenId.primary, true);
  assert.equal(columns.tokenHash.name, 'token_hash');
  assert.equal(columns.tokenHash.notNull, true);
  assert.equal(columns.tokenPrefix.name, 'token_prefix');
  assert.equal(columns.tokenPrefix.notNull, true);
  assert.equal(columns.label.name, 'label');
  assert.equal(columns.label.notNull, true);
  assert.equal(columns.label.hasDefault, true);
  assert.equal(columns.scopes.name, 'scopes');
  assert.equal(columns.scopes.notNull, true);
  assert.equal(columns.scopes.hasDefault, false);
  assert.equal(columns.expiresAt.name, 'expires_at');
  assert.equal(columns.revokedAt.name, 'revoked_at');
  assert.equal(columns.lastUsedAt.name, 'last_used_at');
  assert.equal(columns.rotatedFromTokenId.name, 'rotated_from_token_id');
  assert.equal(columns.rotatedAt.name, 'rotated_at');
  assert.ok(config.uniqueConstraints.some((constraint) =>
    constraint.name === 'api_tokens_token_hash_unique'));
  assert.ok(config.uniqueConstraints.some((constraint) =>
    constraint.name === 'api_tokens_rotated_from_token_id_unique'));
  assert.ok(config.foreignKeys.some((constraint) =>
    constraint.getName() === 'api_tokens_rotated_from_token_id_api_tokens_token_id_fk'));
  assert.ok(config.checks.some((constraint) => constraint.name === 'api_tokens_label_length'));
  for (const name of [
    'api_tokens_hash_shape',
    'api_tokens_prefix_shape',
    'api_tokens_scopes_registered',
    'api_tokens_expiry_after_creation',
    'api_tokens_revocation_after_creation',
    'api_tokens_last_use_after_creation',
    'api_tokens_not_soft_deleted',
  ]) {
    assert.ok(config.checks.some((constraint) => constraint.name === name), `missing ${name}`);
  }
  assert.ok(config.checks.some((constraint) => constraint.name === 'api_tokens_rotation_state'));
});

test('API token audit lifecycle is private, append-only migration state', () => {
  const columns = getTableColumns(apiTokenAuditEvents);
  const config = getTableConfig(apiTokenAuditEvents);
  assert.equal(config.schema, 'private');
  assert.equal(columns.tokenId.notNull, true);
  assert.equal(columns.actorId.notNull, true);
  assert.equal(columns.details.columnType, 'PgJsonb');
  assert.ok(config.checks.some((constraint) => constraint.name === 'api_token_audit_events_type_allowed'));
  assert.ok(config.checks.some((constraint) => constraint.name === 'api_token_audit_events_related_shape'));
});
