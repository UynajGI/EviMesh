import { foreignKey, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { createLifecycleColumns } from './conventions.mjs';
import { organizations } from './organizations.mjs';

export const organizationMembers = pgTable(
  'organization_members',
  {
    organizationId: text('organization_id')
      .notNull(),
    actorId: text('actor_id')
      .notNull(),
    role: text('role').notNull().default('member'),
    ...createLifecycleColumns(),
  },
  (table) => [primaryKey({
    name: 'organization_members_pkey',
    columns: [table.organizationId, table.actorId],
  }), foreignKey({
    name: 'organization_members_organization_fk',
    columns: [table.organizationId],
    foreignColumns: [organizations.organizationId],
    onDelete: 'cascade',
  }), foreignKey({
    name: 'organization_members_actor_fk',
    columns: [table.actorId],
    foreignColumns: [actors.actorId],
    onDelete: 'cascade',
  })],
);
