import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { taskDependencies, taskDependencyType } from '../src/task-dependencies.mjs';

test('M3-58 task_dependencies reject self-referential depends_on edges', () => {
  const columns = getTableColumns(taskDependencies);
  const config = getTableConfig(taskDependencies);

  assert.deepEqual(taskDependencyType.enumValues, ['depends_on']);
  assert.equal(columns.sourceTaskId.name, 'source_task_id');
  assert.equal(columns.targetTaskId.name, 'target_task_id');
  assert.equal(columns.dependencyType.name, 'dependency_type');
  assert.equal(columns.dependencyType.hasDefault, true);
  assert.equal(columns.createdBy.name, 'created_by');
  assert.equal(columns.createdAt.name, 'created_at');
  assert.equal(columns.updatedAt.name, 'updated_at');
  assert.equal(columns.deletedAt.name, 'deleted_at');
  assert.equal(config.primaryKeys[0].name, 'task_dependencies_pkey');
  assert.deepEqual(config.primaryKeys[0].columns.map((column) => column.name), ['source_task_id', 'target_task_id']);
  assert.equal(config.checks.length, 1);
  assert.equal(config.checks[0].name, 'task_dependencies_no_self_reference');
  assert.equal(config.foreignKeys.length, 3);
});
