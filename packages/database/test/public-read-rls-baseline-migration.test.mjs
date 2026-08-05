import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const migrationPath = fileURLToPath(new URL('../drizzle/0063_public_read_rls_baseline.sql', import.meta.url));

const publicTables = [
  'projects', 'project_revisions', 'questions', 'question_revisions',
  'research_contracts', 'research_contract_revisions', 'tasks', 'task_revisions',
  'task_dependencies', 'claims', 'claim_revisions', 'claim_relations',
  'artifacts', 'artifact_revisions', 'artifact_locations', 'evidence',
  'evidence_claim_links', 'verification_contracts', 'verification_contract_revisions',
  'verification_policies', 'verification_policy_revisions', 'verification_receipts',
  'verification_findings', 'challenges', 'challenge_revisions', 'challenge_impacts',
  'frontier_snapshots', 'frontier_members', 'runs', 'run_inputs', 'run_outputs',
  'contribution_statements', 'contribution_edges', 'research_events', 'research_event_parents',
];

test('M3-66 migration grants anonymous read-only access to public research objects', async () => {
  const migration = await readFile(migrationPath, 'utf8');

  for (const table of publicTables) {
    assert.match(migration, new RegExp(`'${table}'`));
  }
  assert.match(migration, /rolname = 'anon'/);
  assert.match(migration, /CREATE POLICY %I ON %I FOR SELECT TO anon USING \(true\)/);
  assert.match(migration, /public_read_' \|\| table_name/);
  assert.doesNotMatch(migration, /FOR (?:INSERT|UPDATE|DELETE|ALL) TO anon/);
});
