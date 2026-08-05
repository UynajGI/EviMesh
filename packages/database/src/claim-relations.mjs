import { pgEnum, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';
import { actors } from './actors.mjs';
import { claims } from './claims.mjs';
import { createLifecycleColumns } from './conventions.mjs';

export const claimRelationType = pgEnum('claim_relation_type', [
  'depends_on',
  'supports',
  'refutes',
  'qualifies',
  'reproduces',
  'extends',
  'supersedes',
  'contradicts',
  'derived_from',
  'uses_method',
  'uses_dataset',
  'implements',
  'verifies',
  'challenges',
]);

export const claimRelations = pgTable(
  'claim_relations',
  {
    sourceClaimId: text('source_claim_id').notNull().references(() => claims.claimId, { onDelete: 'restrict' }),
    targetClaimId: text('target_claim_id').notNull().references(() => claims.claimId, { onDelete: 'restrict' }),
    relationType: claimRelationType('relation_type').notNull(),
    createdBy: text('created_by').notNull().references(() => actors.actorId, { onDelete: 'restrict' }),
    ...createLifecycleColumns(),
  },
  (table) => [
    primaryKey({
      name: 'claim_relations_pkey',
      columns: [table.sourceClaimId, table.targetClaimId, table.relationType],
    }),
  ],
);
