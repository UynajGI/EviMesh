import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { projectRevisions } from './project-revisions.mjs';
import { projects } from './projects.mjs';

export const frontierSnapshots = pgTable(
  'frontier_snapshots',
  {
    snapshotId: text('snapshot_id').primaryKey(),
    projectId: text('project_id').notNull(),
    sequence: integer('sequence').notNull(),
    previousSequence: integer('previous_sequence'),
    projectRevision: integer('project_revision').notNull(),
    checkpoint: jsonb('checkpoint').notNull(),
    createdBy: text('created_by').notNull().references(() => actors.actorId, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('frontier_snapshots_project_sequence_idx').on(table.projectId, table.sequence),
    foreignKey({
      name: 'frontier_snapshots_project_fk',
      columns: [table.projectId],
      foreignColumns: [projects.projectId],
    }).onDelete('restrict'),
    foreignKey({
      name: 'frontier_snapshots_project_revision_fk',
      columns: [table.projectId, table.projectRevision],
      foreignColumns: [projectRevisions.projectId, projectRevisions.revision],
    }).onDelete('restrict'),
    foreignKey({
      name: 'frontier_snapshots_previous_fk',
      columns: [table.projectId, table.previousSequence],
      foreignColumns: [table.projectId, table.sequence],
    }).onDelete('restrict'),
    check('frontier_snapshots_sequence_positive', sql`${table.sequence} > 0`),
    check('frontier_snapshots_project_revision_positive', sql`${table.projectRevision} > 0`),
    check(
      'frontier_snapshots_previous_contiguous',
      sql`(${table.sequence} = 1 AND ${table.previousSequence} IS NULL) OR (${table.sequence} > 1 AND ${table.previousSequence} = ${table.sequence} - 1)`,
    ),
  ],
);
