import { pgTable, text } from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { createLifecycleColumns } from './conventions.mjs';

export const actorProfiles = pgTable('actor_profiles', {
  actorId: text('actor_id')
    .primaryKey()
    .references(() => actors.actorId, { onDelete: 'cascade' }),
  displayName: text('display_name'),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  ...createLifecycleColumns(),
});
