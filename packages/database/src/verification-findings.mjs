import { foreignKey, jsonb, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { verificationReceipts } from './verification-receipts.mjs';

export const findingSeverity = pgEnum('finding_severity', [
  'critical',
  'major',
  'warning',
  'note',
]);

export const verificationFindings = pgTable(
  'verification_findings',
  {
    findingId: text('finding_id').primaryKey(),
    receiptId: text('receipt_id').notNull(),
    severity: findingSeverity('severity').notNull(),
    code: text('code').notNull(),
    details: jsonb('details').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: 'verification_findings_receipt_fk',
      columns: [table.receiptId],
      foreignColumns: [verificationReceipts.receiptId],
    }).onDelete('restrict'),
  ],
);
