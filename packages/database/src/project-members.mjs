import { sql } from 'drizzle-orm';
import { check, index, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
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
    status: text('status').notNull().default('active'),
    invitedByActorId: text('invited_by_actor_id')
      .references(() => actors.actorId, { onDelete: 'restrict' }),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
    removedByActorId: text('removed_by_actor_id')
      .references(() => actors.actorId, { onDelete: 'restrict' }),
    removedAt: timestamp('removed_at', { withTimezone: true }),
    removalReason: text('removal_reason'),
    ...createLifecycleColumns(),
  },
  (table) => [
    primaryKey({
      name: 'project_members_pkey',
      columns: [table.projectId, table.actorId],
    }),
    index('project_members_actor_status_idx').on(table.actorId, table.status),
    check('project_members_role_allowed', sql`${table.role} in ('owner', 'maintainer', 'contributor', 'viewer')`),
    check('project_members_status_allowed', sql`${table.status} in ('active', 'removed')`),
    check(
      'project_members_lifecycle_shape',
      sql`(${table.status} = 'active' and ${table.removedByActorId} is null and ${table.removedAt} is null and ${table.removalReason} is null and ${table.deletedAt} is null) or (${table.status} = 'removed' and ${table.removedByActorId} is not null and ${table.removedAt} is not null and ${table.removalReason} is not null and char_length(${table.removalReason}) between 1 and 500 and ${table.deletedAt} is not null)`,
    ),
  ],
);
