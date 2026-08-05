import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { claimRevisions } from './claim-revisions.mjs';
import { evidence } from './evidence.mjs';

export const evidenceClaimRelation = pgEnum('evidence_claim_relation', [
  'supports',
  'refutes',
  'qualifies',
  'reproduces',
]);

export const evidenceClaimLinks = pgTable(
  'evidence_claim_links',
  {
    evidenceId: text('evidence_id').notNull().references(() => evidence.evidenceId, { onDelete: 'restrict' }),
    claimId: text('claim_id').notNull(),
    claimRevision: integer('claim_revision').notNull(),
    relationType: evidenceClaimRelation('relation_type').notNull(),
    createdBy: text('created_by').notNull().references(() => actors.actorId, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: 'evidence_claim_links_pkey',
      columns: [table.evidenceId, table.claimId, table.claimRevision, table.relationType],
    }),
    foreignKey({
      name: 'evidence_claim_links_claim_revision_fk',
      columns: [table.claimId, table.claimRevision],
      foreignColumns: [claimRevisions.claimId, claimRevisions.revision],
    }).onDelete('restrict'),
    check('evidence_claim_links_revision_positive', sql`${table.claimRevision} > 0`),
  ],
);
