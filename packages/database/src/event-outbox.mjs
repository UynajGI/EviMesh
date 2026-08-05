import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { researchEvents } from './research-events.mjs';

export const eventOutboxStatus = pgEnum('event_outbox_status', [
  'pending',
  'processing',
  'processed',
  'dead_letter',
]);

export const eventOutbox = pgTable(
  'event_outbox',
  {
    outboxId: text('outbox_id').primaryKey(),
    eventId: text('event_id').notNull(),
    status: eventOutboxStatus('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    availableAt: timestamp('available_at', { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('event_outbox_event_id_unique').on(table.eventId),
    index('event_outbox_claim_idx').on(table.status, table.availableAt),
    foreignKey({
      name: 'event_outbox_event_fk',
      columns: [table.eventId],
      foreignColumns: [researchEvents.eventId],
    }).onDelete('restrict'),
    check('event_outbox_attempts_nonnegative', sql`${table.attempts} >= 0`),
  ],
);
