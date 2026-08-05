import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { claimState, claims } from '../src/claims.mjs';

test('claims provide stable identity, optional Question scope, and M1 state', () => {
  const columns = getTableColumns(claims);

  assert.deepEqual(claimState.enumValues, [
    'hypothesis', 'candidate', 'under_verification', 'provisionally_accepted',
    'accepted', 'contested', 'refuted', 'superseded', 'retracted', 'dependency_tainted',
  ]);
  assert.equal(columns.claimId.name, 'claim_id');
  assert.equal(columns.claimId.primary, true);
  assert.equal(columns.questionId.name, 'question_id');
  assert.equal(columns.questionId.notNull, false);
  assert.equal(columns.state.name, 'state');
  assert.equal(columns.state.hasDefault, true);
  assert.equal(columns.createdBy.name, 'created_by');
  assert.equal(columns.createdAt.name, 'created_at');
  assert.equal(columns.updatedAt.name, 'updated_at');
  assert.equal(columns.deletedAt.name, 'deleted_at');
});
