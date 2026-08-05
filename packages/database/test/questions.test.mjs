import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { questionState, questions } from '../src/questions.mjs';

test('questions provide stable identity, project ownership, and M1 state', () => {
  const columns = getTableColumns(questions);

  assert.deepEqual(questionState.enumValues, [
    'draft',
    'proposed',
    'under_review',
    'admissible',
    'active',
    'resolved',
    'archived',
    'rejected',
  ]);
  assert.equal(columns.questionId.name, 'question_id');
  assert.equal(columns.questionId.primary, true);
  assert.equal(columns.projectId.name, 'project_id');
  assert.equal(columns.projectId.notNull, true);
  assert.equal(columns.state.name, 'state');
  assert.equal(columns.state.notNull, true);
  assert.equal(columns.state.hasDefault, true);
  assert.equal(columns.createdBy.name, 'created_by');
  assert.equal(columns.createdBy.notNull, true);
  assert.equal(columns.createdAt.name, 'created_at');
  assert.equal(columns.updatedAt.name, 'updated_at');
  assert.equal(columns.deletedAt.name, 'deleted_at');
});
