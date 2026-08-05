import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { contractRiskLevel, researchContractRevisions } from '../src/research-contract-revisions.mjs';

test('research_contract_revisions preserve immutable contract content', () => {
  const columns = getTableColumns(researchContractRevisions);
  const config = getTableConfig(researchContractRevisions);

  assert.deepEqual(contractRiskLevel.enumValues, ['open', 'moderated', 'restricted', 'prohibited']);
  assert.equal(columns.contractId.name, 'contract_id');
  assert.equal(columns.revision.name, 'revision');
  assert.equal(columns.revision.notNull, true);
  assert.equal(columns.supersedes.name, 'supersedes');
  assert.equal(columns.problem.name, 'problem');
  assert.equal(columns.definitions.name, 'definitions');
  assert.equal(columns.background.name, 'background');
  assert.equal(columns.scope.name, 'scope');
  assert.equal(columns.exclusions.name, 'exclusions');
  assert.equal(columns.progressCriteria.name, 'progress_criteria');
  assert.equal(columns.acceptableEvidence.name, 'acceptable_evidence');
  assert.equal(columns.falsification.name, 'falsification');
  assert.equal(columns.license.name, 'license');
  assert.equal(columns.riskLevel.name, 'risk_level');
  assert.equal(columns.maintainerIds.name, 'maintainer_ids');
  assert.equal(columns.createdBy.name, 'created_by');
  assert.equal(columns.createdAt.name, 'created_at');
  assert.equal(config.primaryKeys[0].name, 'research_contract_revisions_pkey');
  assert.deepEqual(config.primaryKeys[0].columns.map((column) => column.name), ['contract_id', 'revision']);
  assert.equal(config.checks.length, 2);
});
