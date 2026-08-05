import { pgEnum, pgTable, text } from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { createLifecycleColumns } from './conventions.mjs';
import { questions } from './questions.mjs';

export const taskState = pgEnum('task_state', [
  'draft',
  'open',
  'active',
  'blocked',
  'verification_requested',
  'completed',
  'cancelled',
]);

export const tasks = pgTable('tasks', {
  taskId: text('task_id').primaryKey(),
  questionId: text('question_id').references(() => questions.questionId, { onDelete: 'restrict' }),
  state: taskState('state').notNull().default('draft'),
  createdBy: text('created_by')
    .notNull()
    .references(() => actors.actorId, { onDelete: 'restrict' }),
  ...createLifecycleColumns(),
});
