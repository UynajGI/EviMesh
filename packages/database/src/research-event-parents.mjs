import { sql } from 'drizzle-orm';
import { check, foreignKey, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';
import { researchEvents } from './research-events.mjs';

export const researchEventParents = pgTable(
  'research_event_parents',
  {
    eventId: text('event_id').notNull(),
    parentEventId: text('parent_event_id').notNull(),
  },
  (table) => [
    primaryKey({
      name: 'research_event_parents_pkey',
      columns: [table.eventId, table.parentEventId],
    }),
    foreignKey({
      name: 'research_event_parents_event_fk',
      columns: [table.eventId],
      foreignColumns: [researchEvents.eventId],
    }).onDelete('restrict'),
    foreignKey({
      name: 'research_event_parents_parent_fk',
      columns: [table.parentEventId],
      foreignColumns: [researchEvents.eventId],
    }).onDelete('restrict'),
    check('research_event_parents_no_self_loop', sql`${table.eventId} <> ${table.parentEventId}`),
  ],
);
