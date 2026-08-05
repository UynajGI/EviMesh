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
import { questionState, questions } from './questions.mjs';

export const questionRevisions = pgTable(
  'question_revisions',
  {
    questionId: text('question_id')
      .notNull()
      .references(() => questions.questionId, { onDelete: 'restrict' }),
    revision: integer('revision').notNull(),
    supersedes: integer('supersedes'),
    state: questionState('state').notNull(),
    title: text('title').notNull(),
    statement: text('statement').notNull(),
    researchContract: jsonb('research_contract').notNull(),
    createdBy: text('created_by')
      .notNull()
      .references(() => actors.actorId, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: 'question_revisions_pkey',
      columns: [table.questionId, table.revision],
    }),
    check('question_revisions_revision_positive', sql`${table.revision} > 0`),
    check(
      'question_revisions_supersedes_previous',
      sql`(${table.revision} = 1 AND ${table.supersedes} IS NULL) OR (${table.revision} > 1 AND ${table.supersedes} = ${table.revision} - 1)`,
    ),
  ],
);
