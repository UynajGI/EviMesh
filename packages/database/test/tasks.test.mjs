import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { taskState, tasks } from '../src/tasks.mjs';

test('tasks provide stable identity, optional Question scope, and M1 state', () => {
  const columns = getTableColumns(tasks);

  assert.deepEqual(taskState.enumValues, [
    'draft',
    'open',
    'active',
    'blocked',
    'verification_requested',
    'completed',
    'cancelled',
  ]);
  assert.equal(columns.taskId.name, 'task_id');
  assert.equal(columns.taskId.primary, true);
  assert.equal(columns.questionId.name, 'question_id');
  assert.equal(columns.questionId.notNull, false);
  assert.equal(columns.state.name, 'state');
  assert.equal(columns.state.notNull, true);
  assert.equal(columns.state.hasDefault, true);
  assert.equal(columns.createdBy.name, 'created_by');
  assert.equal(columns.createdBy.notNull, true);
  assert.equal(columns.createdAt.name, 'created_at');
  assert.equal(columns.updatedAt.name, 'updated_at');
  assert.equal(columns.deletedAt.name, 'deleted_at');
});
