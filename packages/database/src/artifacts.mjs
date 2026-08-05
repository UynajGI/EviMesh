import { pgTable, text } from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { createLifecycleColumns } from './conventions.mjs';

export const artifacts = pgTable('artifacts', {
  artifactId: text('artifact_id').primaryKey(),
  createdBy: text('created_by').notNull().references(() => actors.actorId, { onDelete: 'restrict' }),
  ...createLifecycleColumns(),
});
