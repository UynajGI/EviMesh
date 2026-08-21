import { sql } from 'drizzle-orm';
import { check, index, pgEnum, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';

/*
 * Engagement interactions (owner direction 2026-08-21): personal
 * navigation signals that feed recommendations. Constitutional boundary:
 * these are PRIVATE — counts are never rendered as public popularity,
 * scores, or rankings; recommendation output is navigation, not verdict.
 */
export const interactionKind = pgEnum('interaction_kind', [
  'helpful', // 点赞 equivalent: a private mark, no public count anywhere
  'favorite', // 收藏: personal bookmark
  'watch', // subscribe to an object's changes
  'view', // implicit signal synced from local visit history
]);

export const engagementInteractions = pgTable('engagement_interactions', {
  interactionId: text('interaction_id').primaryKey(),
  actorId: text('actor_id')
    .notNull()
    .references(() => actors.actorId, { onDelete: 'cascade' }),
  objectType: text('object_type').notNull(),
  objectId: text('object_id').notNull(),
  kind: interactionKind('kind').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('engagement_interactions_unique').on(table.actorId, table.objectType, table.objectId, table.kind),
  index('engagement_interactions_object_idx').on(table.objectType, table.objectId),
  index('engagement_interactions_actor_idx').on(table.actorId, table.kind),
  check('engagement_interactions_object_type_nonempty', sql`${table.objectType} <> ''`),
  check('engagement_interactions_object_id_nonempty', sql`${table.objectId} <> ''`),
]);
