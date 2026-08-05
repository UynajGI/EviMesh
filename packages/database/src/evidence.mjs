import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { artifactRevisions } from './artifact-revisions.mjs';
import { runs } from './runs.mjs';

export const evidenceType = pgEnum('evidence_type', [
  'formal_proof',
  'numerical_result',
  'experimental_result',
  'dataset',
  'literature_support',
  'counterexample',
  'benchmark',
  'statistical_analysis',
  'code_test',
  'negative_result',
  'expert_assessment',
]);

export const evidence = pgTable(
  'evidence',
  {
    evidenceId: text('evidence_id').primaryKey(),
    evidenceType: evidenceType('evidence_type').notNull(),
    artifactId: text('artifact_id').notNull(),
    artifactRevision: integer('artifact_revision').notNull(),
    runId: text('run_id').references(() => runs.runId, { onDelete: 'restrict' }),
    createdBy: text('created_by').notNull().references(() => actors.actorId, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'evidence_artifact_revision_fk',
      columns: [table.artifactId, table.artifactRevision],
      foreignColumns: [artifactRevisions.artifactId, artifactRevisions.revision],
    }).onDelete('restrict'),
    check('evidence_artifact_revision_positive', sql`${table.artifactRevision} > 0`),
  ],
);
