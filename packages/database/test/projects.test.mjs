import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { projectState, projects } from '../src/projects.mjs';

test('projects stores the stable M1 project revision projection', () => {
  const columns = getTableColumns(projects);

  assert.deepEqual(projectState.enumValues, ['draft', 'active', 'archived']);
  assert.equal(columns.projectId.name, 'project_id');
  assert.equal(columns.projectId.primary, true);
  assert.equal(columns.state.name, 'state');
  assert.equal(columns.state.notNull, true);
  assert.equal(columns.state.hasDefault, true);
  assert.equal(columns.name.name, 'name');
  assert.equal(columns.name.notNull, true);
  assert.equal(columns.summary.name, 'summary');
  assert.equal(columns.summary.notNull, true);
  assert.equal(columns.createdBy.name, 'created_by');
  assert.equal(columns.createdBy.notNull, true);
  assert.equal(columns.license.name, 'license');
  assert.equal(columns.license.notNull, true);
});
