import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { mergeProposals } from '../src/merge-proposals.mjs';

test('merge_proposals lock candidate Claim and Policy revisions', () => {
  const columns = getTableColumns(mergeProposals);
  const config = getTableConfig(mergeProposals);

  for (const [property, name] of [
    ['proposalId', 'proposal_id'],
    ['claimId', 'claim_id'],
    ['claimRevision', 'claim_revision'],
    ['policyId', 'policy_id'],
    ['policyRevision', 'policy_revision'],
    ['status', 'status'],
    ['evaluation', 'evaluation'],
    ['createdBy', 'created_by'],
    ['createdAt', 'created_at'],
    ['updatedAt', 'updated_at'],
    ['deletedAt', 'deleted_at'],
  ]) {
    assert.equal(columns[property].name, name);
  }

  assert.equal(columns.proposalId.primary, true);
  assert.equal(columns.evaluation.hasDefault, true);
  assert.equal(config.foreignKeys.length, 3);
  assert.equal(config.checks.length, 2);
});
