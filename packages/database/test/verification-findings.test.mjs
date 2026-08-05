import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { verificationFindings } from '../src/verification-findings.mjs';

test('verification_findings preserve typed severity and receipt linkage', () => {
  const columns = getTableColumns(verificationFindings);
  const config = getTableConfig(verificationFindings);

  for (const [property, name] of [
    ['findingId', 'finding_id'],
    ['receiptId', 'receipt_id'],
    ['severity', 'severity'],
    ['code', 'code'],
    ['details', 'details'],
    ['createdAt', 'created_at'],
  ]) {
    assert.equal(columns[property].name, name);
  }

  assert.equal(columns.findingId.primary, true);
  assert.equal(columns.details.hasDefault, true);
  assert.equal(config.foreignKeys.length, 1);
});
