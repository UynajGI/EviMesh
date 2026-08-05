import { pgTable, primaryKey, text } from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { createLifecycleColumns } from './conventions.mjs';
import { projects } from './projects.mjs';

export const projectMembers = pgTable(
  'project_members',
  {
    projectId: text('project_id')
      .notNull()
      .references(() => projects.projectId, { onDelete: 'cascade' }),
    actorId: text('actor_id')
      .notNull()
      .references(() => actors.actorId, { onDelete: 'cascade' }),
    role: text('role').notNull().default('viewer'),
    ...createLifecycleColumns(),
  },
  (table) => [primaryKey({
    name: 'project_members_pkey',
    columns: [table.projectId, table.actorId],
  })],
);
