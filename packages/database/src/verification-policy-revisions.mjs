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
} from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { verificationPolicies } from './verification-policies.mjs';

export const verificationPolicyRevisions = pgTable(
  'verification_policy_revisions',
  {
    policyId: text('policy_id').notNull(),
    revision: integer('revision').notNull(),
    supersedes: integer('supersedes'),
    requirements: jsonb('requirements').notNull(),
    outcomes: jsonb('outcomes').notNull(),
    createdBy: text('created_by').notNull().references(() => actors.actorId, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: 'verification_policy_revisions_pkey', columns: [table.policyId, table.revision] }),
    foreignKey({
      name: 'verification_policy_revisions_policy_fk',
      columns: [table.policyId],
      foreignColumns: [verificationPolicies.policyId],
    }).onDelete('restrict'),
    check('verification_policy_revisions_revision_positive', sql`${table.revision} > 0`),
    check(
      'verification_policy_revisions_supersedes_previous',
      sql`(${table.revision} = 1 AND ${table.supersedes} IS NULL) OR (${table.revision} > 1 AND ${table.supersedes} = ${table.revision} - 1)`,
    ),
  ],
);
