import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { createLifecycleColumns } from './conventions.mjs';

export const signingKeys = pgTable('signing_keys', {
  keyId: text('key_id').primaryKey(),
  actorId: text('actor_id')
    .notNull()
    .references(() => actors.actorId, { onDelete: 'cascade' }),
  algorithm: text('algorithm').notNull().default('Ed25519'),
  publicKey: text('public_key').notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  ...createLifecycleColumns(),
});
