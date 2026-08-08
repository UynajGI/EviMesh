import { sql } from 'drizzle-orm';
import {
  check,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { questions } from './questions.mjs';
import { taskState, tasks } from './tasks.mjs';

export const contextMode = pgEnum('context_mode', ['frontier', 'full_trace', 'adversarial', 'blind']);

export const taskRevisions = pgTable(
  'task_revisions',
  {
    taskId: text('task_id').notNull().references(() => tasks.taskId, { onDelete: 'restrict' }),
    revision: integer('revision').notNull(),
    supersedes: integer('supersedes'),
    state: taskState('state').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    inputs: jsonb('inputs').notNull().default([]),
    outputs: jsonb('outputs').notNull(),
    acceptance: jsonb('acceptance').notNull(),
    taskType: text('task_type').notNull().default('general'),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    contextMode: contextMode('context_mode').notNull(),
    questionId: text('question_id').references(() => questions.questionId, { onDelete: 'restrict' }),
    createdBy: text('created_by').notNull().references(() => actors.actorId, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: 'task_revisions_pkey', columns: [table.taskId, table.revision] }),
    check('task_revisions_revision_positive', sql`${table.revision} > 0`),
    check(
      'task_revisions_supersedes_previous',
      sql`(${table.revision} = 1 AND ${table.supersedes} IS NULL) OR (${table.revision} > 1 AND ${table.supersedes} = ${table.revision} - 1)`,
    ),
  ],
);
