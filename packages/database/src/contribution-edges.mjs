import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  integer,
} from 'drizzle-orm/pg-core';
import { contributionStatements } from './contribution-statements.mjs';

export const contributionEdgeType = pgEnum('contribution_edge_type', ['produced', 'used']);

export const contributionEdges = pgTable(
  'contribution_edges',
  {
    statementId: text('statement_id').notNull(),
    edgeType: contributionEdgeType('edge_type').notNull(),
    objectType: text('object_type').notNull(),
    objectId: text('object_id').notNull(),
    objectRevision: integer('object_revision').notNull(),
  },
  (table) => [
    primaryKey({
      name: 'contribution_edges_pkey',
      columns: [table.statementId, table.edgeType, table.objectType, table.objectId, table.objectRevision],
    }),
    foreignKey({
      name: 'contribution_edges_statement_fk',
      columns: [table.statementId],
      foreignColumns: [contributionStatements.statementId],
    }).onDelete('restrict'),
    check('contribution_edges_object_type_nonempty', sql`${table.objectType} <> ''`),
    check('contribution_edges_object_id_nonempty', sql`${table.objectId} <> ''`),
    check('contribution_edges_object_revision_positive', sql`${table.objectRevision} > 0`),
  ],
);
