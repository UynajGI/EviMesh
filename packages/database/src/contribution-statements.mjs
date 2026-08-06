import { sql } from 'drizzle-orm';
import { check, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { researchEvents } from './research-events.mjs';

export const contributionRole = pgEnum('contribution_role', [
  'originator',
  'contributor',
  'reviewer',
  'verifier',
  'witness',
  'maintainer',
]);

export const contributionStatements = pgTable(
  'contribution_statements',
  {
    statementId: text('statement_id').primaryKey(),
    eventId: text('event_id').notNull().references(() => researchEvents.eventId, { onDelete: 'restrict' }),
    actorId: text('actor_id').notNull().references(() => actors.actorId, { onDelete: 'restrict' }),
    role: contributionRole('role').notNull(),
    description: text('description').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('contribution_statements_description_nonempty', sql`${table.description} <> ''`),
  ],
);
