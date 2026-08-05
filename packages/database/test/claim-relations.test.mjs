import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { claimRelationType, claimRelations } from '../src/claim-relations.mjs';

test('claim_relations provide typed directed Claim edges', () => {
  const columns = getTableColumns(claimRelations);
  const config = getTableConfig(claimRelations);

  assert.deepEqual(claimRelationType.enumValues, [
    'depends_on', 'supports', 'refutes', 'qualifies', 'reproduces', 'extends',
    'supersedes', 'contradicts', 'derived_from', 'uses_method', 'uses_dataset',
    'implements', 'verifies', 'challenges',
  ]);
  assert.equal(columns.sourceClaimId.name, 'source_claim_id');
  assert.equal(columns.targetClaimId.name, 'target_claim_id');
  assert.equal(columns.relationType.name, 'relation_type');
  assert.equal(columns.createdBy.name, 'created_by');
  assert.equal(columns.createdAt.name, 'created_at');
  assert.equal(columns.updatedAt.name, 'updated_at');
  assert.equal(columns.deletedAt.name, 'deleted_at');
  assert.equal(config.primaryKeys[0].name, 'claim_relations_pkey');
  assert.deepEqual(config.primaryKeys[0].columns.map((column) => column.name), ['source_claim_id', 'target_claim_id', 'relation_type']);
});
