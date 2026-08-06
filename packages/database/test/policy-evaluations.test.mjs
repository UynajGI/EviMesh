import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { policyEvaluations } from '../src/policy-evaluations.mjs';

test('policy_evaluations retain an immutable input summary and exact policy revision', () => {
  const columns = getTableColumns(policyEvaluations);
  assert.deepEqual(Object.entries(columns).map(([key, value]) => [key, value.name]), [['evaluationId', 'evaluation_id'], ['claimId', 'claim_id'], ['policyId', 'policy_id'], ['policyRevision', 'policy_revision'], ['inputSummary', 'input_summary'], ['result', 'result'], ['createdAt', 'created_at']]);
  assert.equal(columns.evaluationId.primary, true);
  assert.equal(columns.inputSummary.notNull, true);
  assert.equal(getTableConfig(policyEvaluations).foreignKeys.length, 2);
});
