import test from 'node:test';
import assert from 'node:assert/strict';
import { exportContributionProv, ProvExportError } from '../src/prov-export.mjs';

const statements = [{ statementId: 'contribution_1', actorId: 'actor_1', role: 'contributor', description: 'Processed the input dataset.' }];
const edges = [
  { statementId: 'contribution_1', edgeType: 'used', objectType: 'artifact', objectId: 'dataset_1', objectRevision: 1 },
  { statementId: 'contribution_1', edgeType: 'produced', objectType: 'artifact', objectId: 'report_1', objectRevision: 2 },
];

test('maps an example contribution graph to W3C PROV Entity, Activity, and Agent relations', () => {
  const prov = exportContributionProv({ statements, edges });
  assert.equal(prov['@context'], 'https://www.w3.org/ns/prov.jsonld');
  assert.deepEqual(prov.agent['agent:actor_1'], { 'prov:type': 'prov:Agent' });
  assert.equal(prov.activity['activity:contribution_1']['prov:type'], 'evimesh:ContributionStatement');
  assert.equal(prov.entity['entity:artifact:dataset_1:1']['evimesh:revision'], 1);
  assert.equal(prov.used['used:contribution_1:entity:artifact:dataset_1:1']['prov:activity'], 'activity:contribution_1');
  assert.equal(prov.wasGeneratedBy['generated:contribution_1:entity:artifact:report_1:2']['prov:entity'], 'entity:artifact:report_1:2');
});

test('rejects dangling, duplicate, and malformed contribution graphs', () => {
  assert.throws(() => exportContributionProv({ statements: [statements[0], statements[0]], edges }), ProvExportError);
  assert.throws(() => exportContributionProv({ statements, edges: [{ ...edges[0], statementId: 'missing' }] }), /known contribution/);
  assert.throws(() => exportContributionProv({ statements, edges: [{ ...edges[0], edgeType: 'derived' }] }), /used or produced/);
});
