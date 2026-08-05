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
import { projectState, projects } from './projects.mjs';

export const projectRevisions = pgTable(
  'project_revisions',
  {
    projectId: text('project_id')
      .notNull()
      .references(() => projects.projectId, { onDelete: 'restrict' }),
    revision: integer('revision').notNull(),
    supersedes: integer('supersedes'),
    state: projectState('state').notNull(),
    name: text('name').notNull(),
    summary: text('summary').notNull(),
    createdBy: text('created_by')
      .notNull()
      .references(() => actors.actorId, { onDelete: 'restrict' }),
    maintainerIds: jsonb('maintainer_ids').notNull().default([]),
    license: text('license').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: 'project_revisions_pkey',
      columns: [table.projectId, table.revision],
    }),
    check('project_revisions_revision_positive', sql`${table.revision} > 0`),
    check(
      'project_revisions_supersedes_previous',
      sql`(${table.revision} = 1 AND ${table.supersedes} IS NULL) OR (${table.revision} > 1 AND ${table.supersedes} = ${table.revision} - 1)`,
    ),
  ],
);
