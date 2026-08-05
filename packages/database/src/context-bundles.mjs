import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { frontierSnapshots } from './frontier-snapshots.mjs';
import { contextMode, taskRevisions } from './task-revisions.mjs';

export const contextBundles = pgTable(
  'context_bundles',
  {
    contextBundleId: text('context_bundle_id').primaryKey(),
    taskId: text('task_id').notNull(),
    taskRevision: integer('task_revision').notNull(),
    frontierSnapshotId: text('frontier_snapshot_id'),
    mode: contextMode('mode').notNull(),
    manifest: jsonb('manifest').notNull(),
    contentHash: text('content_hash').notNull(),
    storageUri: text('storage_uri').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'context_bundles_task_revision_fk',
      columns: [table.taskId, table.taskRevision],
      foreignColumns: [taskRevisions.taskId, taskRevisions.revision],
    }).onDelete('restrict'),
    foreignKey({
      name: 'context_bundles_frontier_snapshot_fk',
      columns: [table.frontierSnapshotId],
      foreignColumns: [frontierSnapshots.snapshotId],
    }).onDelete('restrict'),
    check('context_bundles_task_revision_positive', sql`${table.taskRevision} > 0`),
    check('context_bundles_content_hash_nonempty', sql`${table.contentHash} <> ''`),
    check('context_bundles_storage_uri_nonempty', sql`${table.storageUri} <> ''`),
  ],
);
