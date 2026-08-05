import { sql } from 'drizzle-orm';
import { check, foreignKey, integer, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import { artifactRevisions } from './artifact-revisions.mjs';
import { runs } from './runs.mjs';

export const runOutputs = pgTable(
  'run_outputs',
  {
    runId: text('run_id').notNull().references(() => runs.runId, { onDelete: 'restrict' }),
    artifactId: text('artifact_id').notNull(),
    artifactRevision: integer('artifact_revision').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: 'run_outputs_pkey', columns: [table.runId, table.artifactId, table.artifactRevision] }),
    foreignKey({
      name: 'run_outputs_artifact_revision_fk',
      columns: [table.artifactId, table.artifactRevision],
      foreignColumns: [artifactRevisions.artifactId, artifactRevisions.revision],
    }).onDelete('restrict'),
    check('run_outputs_revision_positive', sql`${table.artifactRevision} > 0`),
  ],
);
