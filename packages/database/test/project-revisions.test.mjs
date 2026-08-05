import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { projectRevisions } from '../src/project-revisions.mjs';

test('project_revisions is an append-only composite-key projection', () => {
  const columns = getTableColumns(projectRevisions);
  const config = getTableConfig(projectRevisions);

  assert.equal(columns.projectId.name, 'project_id');
  assert.equal(columns.revision.name, 'revision');
  assert.equal(columns.revision.notNull, true);
  assert.equal(columns.supersedes.name, 'supersedes');
  assert.equal(columns.state.name, 'state');
  assert.equal(columns.name.name, 'name');
  assert.equal(columns.summary.name, 'summary');
  assert.equal(columns.createdBy.name, 'created_by');
  assert.equal(columns.maintainerIds.name, 'maintainer_ids');
  assert.equal(columns.license.name, 'license');
  assert.equal(columns.createdAt.name, 'created_at');
  assert.equal(columns.createdAt.notNull, true);
  assert.equal(config.primaryKeys[0].name, 'project_revisions_pkey');
  assert.deepEqual(
    config.primaryKeys[0].columns.map((column) => column.name),
    ['project_id', 'revision'],
  );
  assert.equal(config.checks.length, 2);
});
