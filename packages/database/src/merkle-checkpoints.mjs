import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  integer,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { researchEvents } from './research-events.mjs';

export const merkleCheckpoints = pgTable(
  'merkle_checkpoints',
  {
    checkpointId: text('checkpoint_id').primaryKey(),
    firstEventId: text('first_event_id').notNull(),
    lastEventId: text('last_event_id').notNull(),
    eventCount: integer('event_count').notNull(),
    rootHash: text('root_hash').notNull(),
    signature: text('signature').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'merkle_checkpoints_first_event_fk',
      columns: [table.firstEventId],
      foreignColumns: [researchEvents.eventId],
    }).onDelete('restrict'),
    foreignKey({
      name: 'merkle_checkpoints_last_event_fk',
      columns: [table.lastEventId],
      foreignColumns: [researchEvents.eventId],
    }).onDelete('restrict'),
    check('merkle_checkpoints_event_count_positive', sql`${table.eventCount} > 0`),
    check('merkle_checkpoints_root_hash_sha256', sql`${table.rootHash} ~* '^sha256:[0-9a-f]{64}$'`),
  ],
);
