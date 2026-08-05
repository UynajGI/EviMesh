import { pgTable, text, unique } from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { createLifecycleColumns } from './conventions.mjs';

export const organizations = pgTable(
  'organizations',
  {
    organizationId: text('organization_id').primaryKey(),
    actorId: text('actor_id')
      .notNull()
      .references(() => actors.actorId, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    displayName: text('display_name').notNull(),
    description: text('description'),
    ...createLifecycleColumns(),
  },
  (table) => [
    unique('organizations_actor_id_unique').on(table.actorId),
    unique('organizations_slug_unique').on(table.slug),
  ],
);
