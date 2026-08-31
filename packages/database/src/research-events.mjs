import { sql } from 'drizzle-orm';
import { check, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const researchEvents = pgTable(
  'research_events',
  {
    eventId: text('event_id').primaryKey(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    hash: text('hash').notNull(),
    signature: jsonb('signature').notNull(),
    parents: jsonb('parents').notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('research_events_event_id_uuidv7', sql`${table.eventId} ~* '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'`),
    check('research_events_event_type_namespaced', sql`${table.eventType} ~ '^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$'`),
    check('research_events_hash_sha256', sql`${table.hash} ~* '^sha256:[0-9a-f]{64}$'`),
  ],
);
