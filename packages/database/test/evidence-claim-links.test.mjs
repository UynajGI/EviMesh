import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { evidenceClaimLinks, evidenceClaimRelation } from '../src/evidence-claim-links.mjs';

test('evidence_claim_links bind typed Evidence to a concrete Claim revision', () => {
  const columns = getTableColumns(evidenceClaimLinks);
  const config = getTableConfig(evidenceClaimLinks);

  for (const [property, name] of [
    ['evidenceId', 'evidence_id'], ['claimId', 'claim_id'],
    ['claimRevision', 'claim_revision'], ['relationType', 'relation_type'],
    ['createdBy', 'created_by'], ['createdAt', 'created_at'],
  ]) assert.equal(columns[property].name, name);
  assert.equal(config.primaryKeys[0].name, 'evidence_claim_links_pkey');
  assert.deepEqual(config.primaryKeys[0].columns.map((column) => column.name), [
    'evidence_id', 'claim_id', 'claim_revision', 'relation_type',
  ]);
  assert.equal(config.foreignKeys.length, 3);
  assert.equal(config.checks.length, 1);
  assert.deepEqual(evidenceClaimRelation.enumValues, ['supports', 'refutes', 'qualifies', 'reproduces']);
});
