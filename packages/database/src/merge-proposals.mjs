import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  text,
} from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { claimRevisions } from './claim-revisions.mjs';
import { createLifecycleColumns } from './conventions.mjs';
import { verificationPolicyRevisions } from './verification-policy-revisions.mjs';

export const mergeProposals = pgTable(
  'merge_proposals',
  {
    proposalId: text('proposal_id').primaryKey(),
    claimId: text('claim_id').notNull(),
    claimRevision: integer('claim_revision').notNull(),
    policyId: text('policy_id').notNull(),
    policyRevision: integer('policy_revision').notNull(),
    status: text('status').notNull(),
    evaluation: jsonb('evaluation').notNull().default({}),
    createdBy: text('created_by').notNull().references(() => actors.actorId, { onDelete: 'restrict' }),
    ...createLifecycleColumns(),
  },
  (table) => [
    foreignKey({
      name: 'merge_proposals_claim_revision_fk',
      columns: [table.claimId, table.claimRevision],
      foreignColumns: [claimRevisions.claimId, claimRevisions.revision],
    }).onDelete('restrict'),
    foreignKey({
      name: 'merge_proposals_policy_revision_fk',
      columns: [table.policyId, table.policyRevision],
      foreignColumns: [verificationPolicyRevisions.policyId, verificationPolicyRevisions.revision],
    }).onDelete('restrict'),
    check('merge_proposals_claim_revision_positive', sql`${table.claimRevision} > 0`),
    check('merge_proposals_policy_revision_positive', sql`${table.policyRevision} > 0`),
  ],
);
