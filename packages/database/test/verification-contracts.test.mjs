import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { verificationContracts } from '../src/verification-contracts.mjs';

test('verification_contracts provide stable identity and lifecycle ownership', () => {
  const columns = getTableColumns(verificationContracts);

  for (const [property, name] of [
    ['contractId', 'contract_id'], ['createdBy', 'created_by'],
    ['createdAt', 'created_at'], ['updatedAt', 'updated_at'], ['deletedAt', 'deleted_at'],
  ]) assert.equal(columns[property].name, name);
  assert.equal(columns.contractId.primary, true);
  assert.equal(columns.createdBy.notNull, true);
});
