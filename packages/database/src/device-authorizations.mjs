import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgSchema,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { apiTokens } from './api-tokens.mjs';

export const privateSchema = pgSchema('private');

/**
 * Private RFC 8628 lifecycle state. Codes and access tokens are represented
 * only by SHA-256 digests; this table is never part of the research DAG.
 */
export const deviceAuthorizations = privateSchema.table(
  'device_authorizations',
  {
    deviceAuthorizationId: uuid('device_authorization_id').defaultRandom().primaryKey(),
    deviceCodeDigest: text('device_code_digest').notNull(),
    userCodeDigest: text('user_code_digest').notNull(),
    clientId: text('client_id').notNull(),
    requestedScopes: text('requested_scopes').array().notNull(),
    status: text('status').notNull().default('pending'),
    agentActorId: text('agent_actor_id').references(() => actors.actorId, { onDelete: 'restrict' }),
    approvedByActorId: text('approved_by_actor_id').references(() => actors.actorId, { onDelete: 'restrict' }),
    deniedByActorId: text('denied_by_actor_id').references(() => actors.actorId, { onDelete: 'restrict' }),
    issuedTokenId: uuid('issued_token_id').references(() => apiTokens.tokenId, { onDelete: 'restrict' }),
    createdEventId: uuid('created_event_id'),
    approvalEventId: uuid('approval_event_id'),
    consumptionEventId: uuid('consumption_event_id'),
    denialEventId: uuid('denial_event_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    deniedAt: timestamp('denied_at', { withTimezone: true }),
  },
  (table) => [
    unique('device_authorizations_device_code_digest_unique').on(table.deviceCodeDigest),
    unique('device_authorizations_user_code_digest_unique').on(table.userCodeDigest),
    unique('device_authorizations_issued_token_id_unique').on(table.issuedTokenId),
    index('device_authorizations_expires_at_idx').on(table.expiresAt),
    index('device_authorizations_approved_by_actor_id_idx').on(table.approvedByActorId),
    foreignKey({
      columns: [table.createdEventId],
      foreignColumns: [deviceAuthorizationEvents.eventId],
      name: 'device_authorizations_created_event_id_events_event_id_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.approvalEventId],
      foreignColumns: [deviceAuthorizationEvents.eventId],
      name: 'device_authorizations_approval_event_id_events_event_id_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.consumptionEventId],
      foreignColumns: [deviceAuthorizationEvents.eventId],
      name: 'device_authorizations_consumption_event_id_events_event_id_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [table.denialEventId],
      foreignColumns: [deviceAuthorizationEvents.eventId],
      name: 'device_authorizations_denial_event_id_events_event_id_fk',
    }).onDelete('restrict'),
    check('device_authorizations_device_code_digest_sha256', sql`${table.deviceCodeDigest} ~ '^[A-Za-z0-9_-]{43}$'`),
    check('device_authorizations_user_code_digest_sha256', sql`${table.userCodeDigest} ~ '^[A-Za-z0-9_-]{43}$'`),
    check('device_authorizations_client_id_length', sql`char_length(${table.clientId}) between 1 and 100`),
    check(
      'device_authorizations_requested_scopes_allowed',
      sql`cardinality(${table.requestedScopes}) between 1 and 5 and ${table.requestedScopes} <@ array['profile:read', 'project:read', 'research:prepare', 'research:submit', 'artifact:upload']::text[]`,
    ),
    check('device_authorizations_status_allowed', sql`${table.status} in ('pending', 'approved', 'consumed', 'denied')`),
    check('device_authorizations_expiry_after_creation', sql`${table.expiresAt} > ${table.createdAt}`),
    check(
      'device_authorizations_lifecycle_shape',
      sql`
        (${table.status} = 'pending' and ${table.agentActorId} is null and ${table.approvedByActorId} is null and ${table.approvedAt} is null and ${table.issuedTokenId} is null and ${table.consumedAt} is null and ${table.deniedAt} is null)
        or (${table.status} = 'approved' and ${table.agentActorId} is not null and ${table.approvedByActorId} is not null and ${table.approvedAt} is not null and ${table.approvalEventId} is not null and ${table.issuedTokenId} is null and ${table.consumedAt} is null and ${table.deniedAt} is null)
        or (${table.status} = 'consumed' and ${table.agentActorId} is not null and ${table.approvedByActorId} is not null and ${table.approvedAt} is not null and ${table.approvalEventId} is not null and ${table.issuedTokenId} is not null and ${table.consumedAt} is not null and ${table.consumptionEventId} is not null and ${table.deniedAt} is null)
        or (${table.status} = 'denied' and ${table.deniedByActorId} is not null and ${table.deniedAt} is not null and ${table.denialEventId} is not null and ${table.issuedTokenId} is null and ${table.consumedAt} is null)
      `,
    ),
  ],
);

/** Append-only account-security audit trail for one Device Authorization. */
export const deviceAuthorizationEvents = privateSchema.table(
  'device_authorization_events',
  {
    eventId: uuid('event_id').defaultRandom().primaryKey(),
    deviceAuthorizationId: uuid('device_authorization_id')
      .notNull()
      .references(() => deviceAuthorizations.deviceAuthorizationId, { onDelete: 'restrict' }),
    eventType: text('event_type').notNull(),
    actorId: text('actor_id').references(() => actors.actorId, { onDelete: 'restrict' }),
    details: jsonb('details').notNull().default({}),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('device_authorization_events_grant_time_idx').on(table.deviceAuthorizationId, table.occurredAt),
    check(
      'device_authorization_events_type_allowed',
      sql`${table.eventType} in ('started', 'approved', 'consumed', 'denied')`,
    ),
  ],
);
