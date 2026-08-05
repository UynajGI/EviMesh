import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { contextMode, taskRevisions } from '../src/task-revisions.mjs';

test('task_revisions preserve immutable Task content and context mode', () => {
  const columns = getTableColumns(taskRevisions);
  const config = getTableConfig(taskRevisions);

  assert.deepEqual(contextMode.enumValues, ['frontier', 'full_trace', 'adversarial', 'blind']);
  for (const [property, name] of [
    ['taskId', 'task_id'], ['revision', 'revision'], ['supersedes', 'supersedes'],
    ['state', 'state'], ['title', 'title'], ['description', 'description'],
    ['inputs', 'inputs'], ['outputs', 'outputs'], ['acceptance', 'acceptance'],
    ['contextMode', 'context_mode'], ['questionId', 'question_id'],
    ['createdBy', 'created_by'], ['createdAt', 'created_at'],
  ]) assert.equal(columns[property].name, name);
  assert.equal(config.primaryKeys[0].name, 'task_revisions_pkey');
  assert.deepEqual(config.primaryKeys[0].columns.map((column) => column.name), ['task_id', 'revision']);
  assert.equal(config.checks.length, 2);
});
