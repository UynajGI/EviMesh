import {
  boolean,
  foreignKey,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { claimRevisions } from './claim-revisions.mjs';
import { verificationContractRevisions } from './verification-contract-revisions.mjs';
import { runs } from './runs.mjs';

export const verificationOutcome = pgEnum('verification_outcome', [
  'supports',
  'refutes',
  'qualifies',
  'inconclusive',
]);

export const verificationReceipts = pgTable(
  'verification_receipts',
  {
    receiptId: text('receipt_id').primaryKey(),
    runId: text('run_id').notNull().references(() => runs.runId, { onDelete: 'restrict' }),
    duplicateOfReceiptId: text('duplicate_of_receipt_id'),
    claimId: text('claim_id').notNull(),
    claimRevision: integer('claim_revision').notNull(),
    contractId: text('contract_id').notNull(),
    contractRevision: integer('contract_revision').notNull(),
    outcome: verificationOutcome('outcome').notNull(),
    verificationTypes: jsonb('verification_types').notNull(),
    contextMode: text('context_mode').notNull(),
    sawExpectedOutputs: boolean('saw_expected_outputs').notNull(),
    implementationRelation: text('implementation_relation').notNull(),
    dataRelation: text('data_relation').notNull(),
    modelFamily: text('model_family').notNull(),
    createdBy: text('created_by').notNull().references(() => actors.actorId, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'verification_receipts_claim_revision_fk',
      columns: [table.claimId, table.claimRevision],
      foreignColumns: [claimRevisions.claimId, claimRevisions.revision],
    }).onDelete('restrict'),
    foreignKey({
      name: 'verification_receipts_contract_revision_fk',
      columns: [table.contractId, table.contractRevision],
      foreignColumns: [verificationContractRevisions.contractId, verificationContractRevisions.revision],
    }).onDelete('restrict'),
    foreignKey({
      name: 'verification_receipts_duplicate_of_receipt_fk',
      columns: [table.duplicateOfReceiptId],
      foreignColumns: [table.receiptId],
    }).onDelete('restrict'),
  ],
);
