import { sql } from 'drizzle-orm';
import { check, foreignKey, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { createLifecycleColumns } from './conventions.mjs';

export const apiTokens = pgTable(
  'api_tokens',
  {
    tokenId: uuid('token_id').defaultRandom().primaryKey(),
    actorId: text('actor_id')
      .notNull()
      .references(() => actors.actorId, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    tokenPrefix: text('token_prefix').notNull(),
    label: text('label').notNull().default('API token'),
    scopes: jsonb('scopes').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    rotatedFromTokenId: uuid('rotated_from_token_id'),
    rotatedAt: timestamp('rotated_at', { withTimezone: true }),
    ...createLifecycleColumns(),
  },
  (table) => [
    unique('api_tokens_token_hash_unique').on(table.tokenHash),
    unique('api_tokens_rotated_from_token_id_unique').on(table.rotatedFromTokenId),
    foreignKey({
      columns: [table.rotatedFromTokenId],
      foreignColumns: [table.tokenId],
      name: 'api_tokens_rotated_from_token_id_api_tokens_token_id_fk',
    }).onDelete('set null'),
    check('api_tokens_label_length', sql`char_length(${table.label}) between 1 and 100`),
    check('api_tokens_hash_shape', sql`${table.tokenHash} ~ '^[A-Za-z0-9_-]{43}$'`),
    check('api_tokens_prefix_shape', sql`${table.tokenPrefix} ~ '^evimesh_[A-Za-z0-9_-]{8}$'`),
    check(
      'api_tokens_scopes_registered',
      sql`jsonb_typeof(${table.scopes}) = 'array'
        and jsonb_array_length(${table.scopes}) between 1 and 5
        and ${table.scopes} <@ '["profile:read","project:read","research:prepare","research:submit","artifact:upload"]'::jsonb`,
    ),
    check('api_tokens_expiry_after_creation', sql`${table.expiresAt} is null or ${table.expiresAt} > ${table.createdAt}`),
    check('api_tokens_revocation_after_creation', sql`${table.revokedAt} is null or ${table.revokedAt} >= ${table.createdAt}`),
    check('api_tokens_last_use_after_creation', sql`${table.lastUsedAt} is null or ${table.lastUsedAt} >= ${table.createdAt}`),
    check('api_tokens_not_soft_deleted', sql`${table.deletedAt} is null`),
    check(
      'api_tokens_rotation_state',
      sql`(${table.rotatedAt} is null and ${table.rotatedFromTokenId} is null)
        or (${table.rotatedAt} is not null and ${table.rotatedAt} >= ${table.createdAt}
          and ${table.rotatedFromTokenId} is not null and ${table.rotatedFromTokenId} <> ${table.tokenId})`,
    ),
  ],
);
