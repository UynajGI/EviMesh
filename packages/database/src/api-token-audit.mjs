import { sql } from 'drizzle-orm';
import { check, index, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { apiTokens } from './api-tokens.mjs';
import { privateSchema } from './device-authorizations.mjs';

/** Append-only credential lifecycle evidence. Never exposed as token data. */
export const apiTokenAuditEvents = privateSchema.table(
  'api_token_audit_events',
  {
    eventId: uuid('event_id').defaultRandom().primaryKey(),
    tokenId: uuid('token_id')
      .notNull()
      .references(() => apiTokens.tokenId, { onDelete: 'restrict' }),
    eventType: text('event_type').notNull(),
    actorId: text('actor_id')
      .notNull()
      .references(() => actors.actorId, { onDelete: 'restrict' }),
    relatedTokenId: uuid('related_token_id')
      .references(() => apiTokens.tokenId, { onDelete: 'restrict' }),
    details: jsonb('details').notNull().default({}),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('api_token_audit_events_token_time_idx').on(table.tokenId, table.occurredAt),
    index('api_token_audit_events_actor_time_idx').on(table.actorId, table.occurredAt),
    check('api_token_audit_events_type_allowed', sql`${table.eventType} in ('issued', 'revoked', 'rotated', 'used')`),
    check('api_token_audit_events_details_object', sql`jsonb_typeof(${table.details}) = 'object'`),
    check(
      'api_token_audit_events_related_shape',
      sql`(${table.eventType} = 'rotated' and ${table.relatedTokenId} is not null and ${table.relatedTokenId} <> ${table.tokenId})
        or (${table.eventType} <> 'rotated' and ${table.relatedTokenId} is null)`,
    ),
  ],
);
