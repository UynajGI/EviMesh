import { pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { createLifecycleColumns } from './conventions.mjs';

export const identities = pgTable(
  'identities',
  {
    identityId: uuid('identity_id').defaultRandom().primaryKey(),
    actorId: text('actor_id')
      .notNull()
      .references(() => actors.actorId, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    subject: text('subject').notNull(),
    email: text('email'),
    ...createLifecycleColumns(),
  },
  (table) => [unique('identities_provider_subject_unique').on(table.provider, table.subject)],
);
