import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { researchContracts } from './research-contracts.mjs';

export const contractRiskLevel = pgEnum('contract_risk_level', [
  'open',
  'moderated',
  'restricted',
  'prohibited',
]);

export const researchContractRevisions = pgTable(
  'research_contract_revisions',
  {
    contractId: text('contract_id')
      .notNull(),
    revision: integer('revision').notNull(),
    supersedes: integer('supersedes'),
    problem: text('problem').notNull(),
    definitions: jsonb('definitions').notNull(),
    background: text('background').notNull(),
    scope: jsonb('scope').notNull(),
    exclusions: jsonb('exclusions').notNull().default([]),
    progressCriteria: jsonb('progress_criteria').notNull(),
    acceptableEvidence: jsonb('acceptable_evidence').notNull(),
    falsification: jsonb('falsification').notNull(),
    license: text('license').notNull(),
    riskLevel: contractRiskLevel('risk_level').notNull(),
    maintainerIds: jsonb('maintainer_ids').notNull(),
    createdBy: text('created_by')
      .notNull()
      .references(() => actors.actorId, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: 'research_contract_revisions_pkey',
      columns: [table.contractId, table.revision],
    }),
    check('research_contract_revisions_revision_positive', sql`${table.revision} > 0`),
    check(
      'research_contract_revisions_supersedes_previous',
      sql`(${table.revision} = 1 AND ${table.supersedes} IS NULL) OR (${table.revision} > 1 AND ${table.supersedes} = ${table.revision} - 1)`,
    ),
    foreignKey({
      name: 'research_contract_revisions_contract_fk',
      columns: [table.contractId],
      foreignColumns: [researchContracts.contractId],
      onDelete: 'restrict',
    }),
  ],
);
