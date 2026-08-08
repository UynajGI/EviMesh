import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { merkleCheckpoints } from './merkle-checkpoints.mjs';

export const witnessReceipts = pgTable(
  'witness_receipts',
  {
    witnessReceiptId: text('witness_receipt_id').primaryKey(),
    checkpointId: text('checkpoint_id').notNull(),
    witnessId: text('witness_id').notNull(),
    publicKey: text('public_key').notNull(),
    signature: text('signature').notNull(),
    signedAt: timestamp('signed_at', { withTimezone: true }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'witness_receipts_checkpoint_fk',
      columns: [table.checkpointId],
      foreignColumns: [merkleCheckpoints.checkpointId],
    }).onDelete('cascade'),
    check('witness_receipts_witness_id_nonempty', sql`length(${table.witnessId}) > 0`),
  ],
);
