import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { verificationReceipts } from '../src/verification-receipts.mjs';

test('verification_receipts persist immutable verification boundary fields', () => {
  const columns = getTableColumns(verificationReceipts);
  const config = getTableConfig(verificationReceipts);

  for (const [property, name] of [
    ['receiptId', 'receipt_id'],
    ['runId', 'run_id'],
    ['duplicateOfReceiptId', 'duplicate_of_receipt_id'],
    ['claimId', 'claim_id'],
    ['claimRevision', 'claim_revision'],
    ['contractId', 'contract_id'],
    ['contractRevision', 'contract_revision'],
    ['outcome', 'outcome'],
    ['verificationTypes', 'verification_types'],
    ['contextMode', 'context_mode'],
    ['sawExpectedOutputs', 'saw_expected_outputs'],
    ['implementationRelation', 'implementation_relation'],
    ['dataRelation', 'data_relation'],
    ['modelFamily', 'model_family'],
    ['createdBy', 'created_by'],
    ['createdAt', 'created_at'],
  ]) {
    assert.equal(columns[property].name, name);
  }

  assert.equal(columns.receiptId.primary, true);
  assert.equal(columns.sawExpectedOutputs.notNull, true);
  assert.equal(columns.runId.notNull, true);
  assert.equal(config.foreignKeys.length, 5);
});
