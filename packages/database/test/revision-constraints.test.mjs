import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { schema } from '../src/schema.mjs';

const revisionTables = {
  projectRevisions: 'projectId',
  questionRevisions: 'questionId',
  researchContractRevisions: 'contractId',
  taskRevisions: 'taskId',
  claimRevisions: 'claimId',
  artifactRevisions: 'artifactId',
  verificationContractRevisions: 'contractId',
  verificationPolicyRevisions: 'policyId',
  challengeRevisions: 'challengeId',
};

test('M3-56 protects every revision with an object-and-revision composite primary key', () => {
  for (const [tableName, objectIdColumn] of Object.entries(revisionTables)) {
    const table = schema[tableName];
    const columns = getTableColumns(table);
    const primaryKeys = getTableConfig(table).primaryKeys;

    assert.ok(columns[objectIdColumn], `${tableName}.${objectIdColumn} must exist`);
    assert.ok(columns.revision, `${tableName}.revision must exist`);
    assert.equal(columns.revision.notNull, true, `${tableName}.revision must be required`);
    assert.deepEqual(
      primaryKeys.map((key) => key.columns.map((column) => column.name)),
      [[columns[objectIdColumn].name, columns.revision.name]],
      `${tableName} must reject duplicate object/revision pairs`,
    );
  }
});
