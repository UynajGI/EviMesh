import { sql } from 'drizzle-orm';
import {
  check,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { claimState, claims } from './claims.mjs';
import { questions } from './questions.mjs';

export const claimRevisions = pgTable(
  'claim_revisions',
  {
    claimId: text('claim_id').notNull().references(() => claims.claimId, { onDelete: 'restrict' }),
    revision: integer('revision').notNull(),
    supersedes: integer('supersedes'),
    state: claimState('state').notNull(),
    statement: text('statement').notNull(),
    scope: jsonb('scope').notNull(),
    assumptions: jsonb('assumptions').notNull().default([]),
    falsification: jsonb('falsification').notNull(),
    questionId: text('question_id').references(() => questions.questionId, { onDelete: 'restrict' }),
    createdBy: text('created_by').notNull().references(() => actors.actorId, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: 'claim_revisions_pkey', columns: [table.claimId, table.revision] }),
    check('claim_revisions_revision_positive', sql`${table.revision} > 0`),
    check(
      'claim_revisions_supersedes_previous',
      sql`(${table.revision} = 1 AND ${table.supersedes} IS NULL) OR (${table.revision} > 1 AND ${table.supersedes} = ${table.revision} - 1)`,
    ),
  ],
);
