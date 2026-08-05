import assert from 'node:assert/strict';
import test from 'node:test';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { getTableColumns } from 'drizzle-orm';
import { contributionEdgeType, contributionEdges } from '../src/contribution-edges.mjs';

test('contribution_edges distinguish produced and used object revisions', () => {
  const columns = getTableColumns(contributionEdges);
  assert.deepEqual(Object.keys(columns), [
    'statementId',
    'edgeType',
    'objectType',
    'objectId',
    'objectRevision',
  ]);
  assert.deepEqual(contributionEdgeType.enumValues, ['produced', 'used']);

  const config = getTableConfig(contributionEdges);
  assert.equal(config.primaryKeys[0].name, 'contribution_edges_pkey');
  assert.deepEqual(config.primaryKeys[0].columns.map((column) => column.name), [
    'statement_id',
    'edge_type',
    'object_type',
    'object_id',
    'object_revision',
  ]);
  assert.equal(config.foreignKeys.length, 1);
  assert.equal(config.checks.length, 3);
});
