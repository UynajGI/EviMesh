import { pgTable, text } from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { createLifecycleColumns } from './conventions.mjs';

export const challenges = pgTable('challenges', {
  challengeId: text('challenge_id').primaryKey(),
  createdBy: text('created_by').notNull().references(() => actors.actorId, { onDelete: 'restrict' }),
  ...createLifecycleColumns(),
});
