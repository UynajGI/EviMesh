import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { artifactRevisions, artifactType } from '../src/artifact-revisions.mjs';

test('artifact_revisions preserve immutable content and contiguous versions', () => {
  const columns = getTableColumns(artifactRevisions);
  const config = getTableConfig(artifactRevisions);

  for (const [property, name] of [
    ['artifactId', 'artifact_id'], ['revision', 'revision'], ['supersedes', 'supersedes'],
    ['artifactType', 'artifact_type'], ['rawHash', 'raw_hash'], ['semanticHash', 'semantic_hash'],
    ['sizeBytes', 'size_bytes'], ['mediaType', 'media_type'], ['license', 'license'],
    ['description', 'description'], ['createdBy', 'created_by'], ['createdAt', 'created_at'],
  ]) assert.equal(columns[property].name, name);
  assert.equal(columns.sizeBytes.hasDefault, false);
  assert.equal(config.primaryKeys[0].name, 'artifact_revisions_pkey');
  assert.deepEqual(config.primaryKeys[0].columns.map((column) => column.name), ['artifact_id', 'revision']);
  assert.equal(config.checks.length, 5);
  assert.deepEqual(artifactType.enumValues, [
    'code', 'dataset', 'document', 'figure', 'proof',
    'notebook', 'container', 'model', 'report', 'other',
  ]);
});
