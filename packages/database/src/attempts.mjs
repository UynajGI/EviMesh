import { pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { createLifecycleColumns } from './conventions.mjs';
import { tasks } from './tasks.mjs';

export const attemptState = pgEnum('attempt_state', ['active', 'paused', 'submitted', 'abandoned']);

export const attempts = pgTable('attempts', {
  attemptId: text('attempt_id').primaryKey(),
  taskId: text('task_id').notNull().references(() => tasks.taskId, { onDelete: 'restrict' }),
  actorId: text('actor_id').notNull().references(() => actors.actorId, { onDelete: 'restrict' }),
  state: attemptState('state').notNull().default('active'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  ...createLifecycleColumns(),
});
