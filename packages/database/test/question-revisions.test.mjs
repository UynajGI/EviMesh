import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { questionRevisions } from '../src/question-revisions.mjs';

test('question_revisions preserve immutable Question revisions and contract content', () => {
  const columns = getTableColumns(questionRevisions);
  const config = getTableConfig(questionRevisions);

  assert.equal(columns.questionId.name, 'question_id');
  assert.equal(columns.revision.name, 'revision');
  assert.equal(columns.revision.notNull, true);
  assert.equal(columns.supersedes.name, 'supersedes');
  assert.equal(columns.state.name, 'state');
  assert.equal(columns.title.name, 'title');
  assert.equal(columns.statement.name, 'statement');
  assert.equal(columns.researchContract.name, 'research_contract');
  assert.equal(columns.researchContract.notNull, true);
  assert.equal(columns.createdBy.name, 'created_by');
  assert.equal(columns.createdAt.name, 'created_at');
  assert.equal(columns.createdAt.notNull, true);
  assert.equal(config.primaryKeys[0].name, 'question_revisions_pkey');
  assert.deepEqual(
    config.primaryKeys[0].columns.map((column) => column.name),
    ['question_id', 'revision'],
  );
  assert.equal(config.checks.length, 2);
});
