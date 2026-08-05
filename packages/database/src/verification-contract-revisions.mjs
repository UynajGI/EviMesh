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
import { verificationContracts } from './verification-contracts.mjs';

export const verificationContractRevisions = pgTable(
  'verification_contract_revisions',
  {
    contractId: text('contract_id').notNull(),
    revision: integer('revision').notNull(),
    supersedes: integer('supersedes'),
    requirements: jsonb('requirements').notNull(),
    verificationTypes: jsonb('verification_types').notNull().default([]),
    contextModes: jsonb('context_modes').notNull().default([]),
    createdBy: text('created_by').notNull().references(() => actors.actorId, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ name: 'verification_contract_revisions_pkey', columns: [table.contractId, table.revision] }),
    foreignKey({
      name: 'verification_contract_revisions_contract_fk',
      columns: [table.contractId],
      foreignColumns: [verificationContracts.contractId],
    }).onDelete('restrict'),
    check('verification_contract_revisions_revision_positive', sql`${table.revision} > 0`),
    check(
      'verification_contract_revisions_supersedes_previous',
      sql`(${table.revision} = 1 AND ${table.supersedes} IS NULL) OR (${table.revision} > 1 AND ${table.supersedes} = ${table.revision} - 1)`,
    ),
  ],
);
