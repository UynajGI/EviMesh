import { foreignKey, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { claims } from './claims.mjs';
import { verificationPolicyRevisions } from './verification-policy-revisions.mjs';

/** Append-only, policy-revision-pinned evaluation outcomes for a Claim. */
export const policyEvaluations = pgTable(
  'policy_evaluations',
  {
    evaluationId: text('evaluation_id').primaryKey(),
    claimId: text('claim_id').notNull().references(() => claims.claimId, { onDelete: 'restrict' }),
    policyId: text('policy_id').notNull(),
    policyRevision: integer('policy_revision').notNull(),
    inputSummary: jsonb('input_summary').notNull(),
    result: jsonb('result').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [foreignKey({ name: 'policy_evaluations_policy_revision_fk', columns: [table.policyId, table.policyRevision], foreignColumns: [verificationPolicyRevisions.policyId, verificationPolicyRevisions.revision] }).onDelete('restrict')],
);
