import { pgEnum, pgTable, text } from 'drizzle-orm/pg-core';
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

export const questions = pgTable('questions', {
  questionId: text('question_id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.projectId, { onDelete: 'restrict' }),
  state: questionState('state').notNull().default('draft'),
  createdBy: text('created_by')
    .notNull()
    .references(() => actors.actorId, { onDelete: 'restrict' }),
  ...createLifecycleColumns(),
});
