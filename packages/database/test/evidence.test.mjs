import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { evidence, evidenceType } from '../src/evidence.mjs';

test('evidence records typed, immutable Artifact-backed research evidence', () => {
  const columns = getTableColumns(evidence);
  const config = getTableConfig(evidence);

  for (const [property, name] of [
    ['evidenceId', 'evidence_id'], ['evidenceType', 'evidence_type'],
    ['artifactId', 'artifact_id'], ['artifactRevision', 'artifact_revision'],
    ['runId', 'run_id'], ['createdBy', 'created_by'], ['createdAt', 'created_at'],
  ]) assert.equal(columns[property].name, name);
  assert.equal(columns.runId.notNull, false);
  assert.equal(config.primaryKeys.length, 0);
  assert.equal(config.foreignKeys.length, 3);
  assert.equal(config.checks.length, 1);
  assert.deepEqual(evidenceType.enumValues, [
    'formal_proof', 'numerical_result', 'experimental_result', 'dataset',
    'literature_support', 'counterexample', 'benchmark', 'statistical_analysis',
    'code_test', 'negative_result', 'expert_assessment',
  ]);
});
