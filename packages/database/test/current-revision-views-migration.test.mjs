import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const migrationPath = fileURLToPath(new URL('../drizzle/0058_current_revision_views.sql', import.meta.url));
const views = [
  ['current_project_revisions', 'project_revisions', 'project_id'],
  ['current_question_revisions', 'question_revisions', 'question_id'],
  ['current_task_revisions', 'task_revisions', 'task_id'],
  ['current_claim_revisions', 'claim_revisions', 'claim_id'],
];

test('M3-61 migration exposes the latest revision for core objects', async () => {
  const migration = await readFile(migrationPath, 'utf8');

  for (const [view, table, objectId] of views) {
    assert.match(migration, new RegExp(`CREATE VIEW ${view} AS`));
    assert.match(migration, new RegExp(`FROM ${table} AS revision`));
    assert.match(migration, new RegExp(`SELECT ${objectId}, MAX\\(revision\\)`));
    assert.match(migration, new RegExp(`GROUP BY ${objectId}`));
  }
});
