import { jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
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
    scopes: jsonb('scopes').notNull().default([]),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    ...createLifecycleColumns(),
  },
  (table) => [unique('api_tokens_token_hash_unique').on(table.tokenHash)],
);
