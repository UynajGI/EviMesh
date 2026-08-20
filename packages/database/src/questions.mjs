import { check, index, pgEnum, pgTable, text } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { actors } from './actors.mjs';
import { createLifecycleColumns } from './conventions.mjs';
import { projects } from './projects.mjs';

export const questionState = pgEnum('question_state', [
  'draft',
  'proposed',
  'under_review',
  'admissible',
  'active',
  'resolved',
  'archived',
  'rejected',
]);

/*
 * Subject-area tags (UI design book: Explore 主题 rail). Free-text
 * navigation labels, never a taxonomy or a scoring dimension: they exist so
 * research can be found by field and stay bounded per question.
 */
export const QUESTION_TOPIC_LIMIT = 8;

export const questions = pgTable('questions', {
  questionId: text('question_id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.projectId, { onDelete: 'restrict' }),
  state: questionState('state').notNull().default('draft'),
  createdBy: text('created_by')
    .notNull()
    .references(() => actors.actorId, { onDelete: 'restrict' }),
  topics: text('topics').array().notNull().default(sql`'{}'::text[]`),
  ...createLifecycleColumns(),
}, (table) => [
  index('questions_topics_idx').using('gin', table.topics),
  check('questions_topics_bound', sql`array_length(${table.topics}, 1) is null or array_length(${table.topics}, 1) <= ${QUESTION_TOPIC_LIMIT}`),
]);
