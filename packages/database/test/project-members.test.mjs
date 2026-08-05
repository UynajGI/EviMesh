import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { projectMembers } from '../src/project-members.mjs';

test('project_members provides a composite project/actor permission projection', () => {
  const columns = getTableColumns(projectMembers);
  const config = getTableConfig(projectMembers);

  assert.equal(columns.projectId.name, 'project_id');
  assert.equal(columns.projectId.notNull, true);
  assert.equal(columns.actorId.name, 'actor_id');
  assert.equal(columns.actorId.notNull, true);
  assert.equal(columns.role.name, 'role');
  assert.equal(columns.role.notNull, true);
  assert.equal(columns.role.hasDefault, true);
  assert.equal(columns.createdAt.name, 'created_at');
  assert.equal(columns.updatedAt.name, 'updated_at');
  assert.equal(columns.deletedAt.name, 'deleted_at');
  assert.equal(config.primaryKeys[0].name, 'project_members_pkey');
  assert.deepEqual(
    config.primaryKeys[0].columns.map((column) => column.name),
    ['project_id', 'actor_id'],
  );
});
