import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  foreignKey,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { frontierSnapshots } from './frontier-snapshots.mjs';

export const mirrorReceipts = pgTable(
  'mirror_receipts',
  {
    mirrorReceiptId: text('mirror_receipt_id').primaryKey(),
    frontierSnapshotId: text('frontier_snapshot_id').notNull(),
    provider: text('provider').notNull(),
    releaseUrl: text('release_url').notNull(),
    assetSha256: text('asset_sha256').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }),
    mirroredAt: timestamp('mirrored_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'mirror_receipts_frontier_snapshot_fk',
      columns: [table.frontierSnapshotId],
      foreignColumns: [frontierSnapshots.snapshotId],
    }).onDelete('cascade'),
    check('mirror_receipts_asset_sha256_format', sql`${table.assetSha256} ~* '^[0-9a-f]{64}$'`),
  ],
);
