import { pgEnum, pgTable, text } from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { createLifecycleColumns } from './conventions.mjs';

export const projectState = pgEnum('project_state', [
  'draft',
  'active',
  'archived',
]);

export const projects = pgTable('projects', {
  projectId: text('project_id').primaryKey(),
  state: projectState('state').notNull().default('draft'),
  name: text('name').notNull(),
  summary: text('summary').notNull(),
  createdBy: text('created_by')
    .notNull()
    .references(() => actors.actorId, { onDelete: 'restrict' }),
  license: text('license').notNull(),
  ...createLifecycleColumns(),
});
