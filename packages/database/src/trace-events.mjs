import { sql } from 'drizzle-orm';
import { check, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { attempts } from './attempts.mjs';

export const traceEvents = pgTable(
  'trace_events',
  {
    eventId: text('event_id').primaryKey(),
    attemptId: text('attempt_id').notNull().references(() => attempts.attemptId, { onDelete: 'restrict' }),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    hash: text('hash').notNull(),
    signature: jsonb('signature').notNull(),
    parents: jsonb('parents').notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('trace_events_event_type_namespaced', sql`${table.eventType} ~ '^[a-z][a-z0-9]*(\\.[a-z][a-z0-9]*)+$'`),
    check('trace_events_hash_sha256', sql`${table.hash} ~* '^sha256:[0-9a-f]{64}$'`),
  ],
);
