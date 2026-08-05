import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { claimRevisions } from './claim-revisions.mjs';
import { frontierSnapshots } from './frontier-snapshots.mjs';

export const frontierMembers = pgTable(
  'frontier_members',
  {
    snapshotId: text('snapshot_id').notNull(),
    claimId: text('claim_id').notNull(),
    claimRevision: integer('claim_revision').notNull(),
    membershipType: text('membership_type').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({
      name: 'frontier_members_pkey',
      columns: [table.snapshotId, table.claimId, table.claimRevision],
    }),
    foreignKey({
      name: 'frontier_members_snapshot_fk',
      columns: [table.snapshotId],
      foreignColumns: [frontierSnapshots.snapshotId],
    }).onDelete('restrict'),
    foreignKey({
      name: 'frontier_members_claim_revision_fk',
      columns: [table.claimId, table.claimRevision],
      foreignColumns: [claimRevisions.claimId, claimRevisions.revision],
    }).onDelete('restrict'),
    check('frontier_members_claim_revision_positive', sql`${table.claimRevision} > 0`),
  ],
);
