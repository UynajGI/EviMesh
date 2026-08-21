import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';

/*
 * Recommendation cache (owner direction 2026-08-21): per-actor top-N items
 * written by the offline implicit-CF training job (Python, GitHub Actions,
 * direct Postgres connection). api-edge only reads rows for the requesting
 * actor. Constitutional boundary: the cache is navigation input for a
 * clearly labeled "For you" rail — it never feeds ordering of the main
 * chronological feed and never renders scores.
 */
export const recommendationCache = pgTable('recommendation_cache', {
  id: text('id').primaryKey(),
  actorId: text('actor_id')
    .notNull()
    .references(() => actors.actorId, { onDelete: 'cascade' }),
  objectType: text('object_type').notNull(),
  objectId: text('object_id').notNull(),
  rank: integer('rank').notNull(),
  /* Short human-readable trigger, e.g. "because you marked useful: <title>". */
  reason: text('reason'),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  /* Training engine identifier, e.g. "implicit-itemitem". */
  model: text('model').notNull().default('implicit-itemitem'),
}, (table) => [
  uniqueIndex('recommendation_cache_unique').on(table.actorId, table.objectType, table.objectId),
  index('recommendation_cache_actor_rank_idx').on(table.actorId, table.rank),
  check('recommendation_cache_object_type_nonempty', sql`${table.objectType} <> ''`),
  check('recommendation_cache_object_id_nonempty', sql`${table.objectId} <> ''`),
  check('recommendation_cache_rank_positive', sql`${table.rank} >= 1`),
]);
