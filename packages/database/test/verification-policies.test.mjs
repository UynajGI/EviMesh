import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { verificationPolicies } from '../src/verification-policies.mjs';

test('verification_policies provide stable identity and lifecycle ownership', () => {
  const columns = getTableColumns(verificationPolicies);

  for (const [property, name] of [
    ['policyId', 'policy_id'],
    ['createdBy', 'created_by'],
    ['createdAt', 'created_at'],
    ['updatedAt', 'updated_at'],
    ['deletedAt', 'deleted_at'],
  ]) {
    assert.equal(columns[property].name, name);
  }

  assert.equal(columns.policyId.primary, true);
  assert.equal(columns.createdBy.notNull, true);
  assert.equal(columns.createdAt.hasDefault, true);
  assert.equal(columns.updatedAt.hasDefault, true);
});
