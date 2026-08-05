import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { attemptState, attempts } from '../src/attempts.mjs';

test('attempts provide independent Task/Actor execution records', () => {
  const columns = getTableColumns(attempts);

  assert.deepEqual(attemptState.enumValues, ['active', 'paused', 'submitted', 'abandoned']);
  assert.equal(columns.attemptId.name, 'attempt_id');
  assert.equal(columns.attemptId.primary, true);
  assert.equal(columns.taskId.name, 'task_id');
  assert.equal(columns.taskId.notNull, true);
  assert.equal(columns.actorId.name, 'actor_id');
  assert.equal(columns.actorId.notNull, true);
  assert.equal(columns.state.name, 'state');
  assert.equal(columns.state.hasDefault, true);
  assert.equal(columns.startedAt.name, 'started_at');
  assert.equal(columns.finishedAt.name, 'finished_at');
  assert.equal(columns.createdAt.name, 'created_at');
  assert.equal(columns.updatedAt.name, 'updated_at');
  assert.equal(columns.deletedAt.name, 'deleted_at');
});
