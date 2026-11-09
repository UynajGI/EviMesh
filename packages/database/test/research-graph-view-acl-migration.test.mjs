import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(
  new URL('../drizzle/0084_graph_view_authenticated_read_only.sql', import.meta.url),
  'utf8',
);

const publicResearchViews = [
  'research_graph_nodes',
  'research_graph_edges',
  'research_answers',
  'research_rebuttals',
  'research_evaluations',
  'research_evaluation_bases',
  'research_datasets',
  'research_tools',
];

test('revokes every authenticated Graph view privilege before granting SELECT only', () => {
  const revokeStart = migration.indexOf('REVOKE ALL ON TABLE');
  const revokeEnd = migration.indexOf('FROM authenticated;', revokeStart);
  const grantStart = migration.indexOf('GRANT SELECT ON TABLE');
  const grantEnd = migration.indexOf('TO authenticated;', grantStart);

  assert.ok(revokeStart >= 0 && revokeEnd > revokeStart, 'authenticated REVOKE ALL must exist');
  assert.ok(grantStart > revokeEnd && grantEnd > grantStart, 'SELECT must be restored only after REVOKE ALL');

  const revoke = migration.slice(revokeStart, revokeEnd);
  const grant = migration.slice(grantStart, grantEnd);
  for (const view of publicResearchViews) {
    assert.match(revoke, new RegExp(`public\\.${view}\\b`));
    assert.match(grant, new RegExp(`public\\.${view}\\b`));
  }

  assert.doesNotMatch(migration, /GRANT\s+(?:ALL|INSERT|UPDATE|DELETE)[^;]*TO authenticated/i);
});

test('migration verifies effective authenticated privileges with has_table_privilege', () => {
  for (const view of publicResearchViews) {
    assert.match(migration, new RegExp(`'${view}'`));
  }
  assert.match(migration, /NOT has_table_privilege\([\s\S]*?'SELECT'[\s\S]*?\)/);
  for (const privilege of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
    assert.match(migration, new RegExp(`has_table_privilege\\([\\s\\S]*?'${privilege}'\\)`));
  }
});
