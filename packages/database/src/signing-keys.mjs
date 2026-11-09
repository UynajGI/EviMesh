import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { createLifecycleColumns } from './conventions.mjs';

export const signingKeys = pgTable('signing_keys', {
  keyId: text('key_id').primaryKey(),
  actorId: text('actor_id')
    .notNull()
    .references(() => actors.actorId, { onDelete: 'cascade' }),
  algorithm: text('algorithm').notNull().default('Ed25519'),
  publicKey: text('public_key').notNull(),
  fingerprint: text('fingerprint').notNull(),
  label: text('label').notNull().default('Signing key'),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revocationReason: text('revocation_reason'),
  ...createLifecycleColumns(),
}, (table) => [
  uniqueIndex('signing_keys_fingerprint_unique').on(table.fingerprint),
  uniqueIndex('signing_keys_one_active_per_actor')
    .on(table.actorId)
    .where(sql`${table.revokedAt} is null and ${table.deletedAt} is null`),
  check('signing_keys_algorithm_ed25519', sql`${table.algorithm} = 'Ed25519'`),
  check('signing_keys_public_key_canonical_spki', sql`${table.publicKey} ~ '^[A-Za-z0-9_-]{59}$'`),
  check('signing_keys_fingerprint_shape', sql`${table.fingerprint} ~ '^sha256:[0-9a-f]{64}$'`),
  check('signing_keys_label_length', sql`char_length(${table.label}) between 1 and 100`),
  check(
    'signing_keys_revocation_shape',
    sql`(${table.revokedAt} is null and ${table.revocationReason} is null) or (${table.revokedAt} is not null and ${table.revocationReason} is not null and char_length(${table.revocationReason}) between 1 and 500)`,
  ),
]);
