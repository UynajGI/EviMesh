import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { researchContracts } from '../src/research-contracts.mjs';

test('research_contracts provide stable identity and creator ownership', () => {
  const columns = getTableColumns(researchContracts);

  assert.equal(columns.contractId.name, 'contract_id');
  assert.equal(columns.contractId.primary, true);
  assert.equal(columns.createdBy.name, 'created_by');
  assert.equal(columns.createdBy.notNull, true);
  assert.equal(columns.createdAt.name, 'created_at');
  assert.equal(columns.updatedAt.name, 'updated_at');
  assert.equal(columns.deletedAt.name, 'deleted_at');
});
