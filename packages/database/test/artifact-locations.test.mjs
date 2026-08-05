import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { artifactLocations } from '../src/artifact-locations.mjs';

test('artifact_locations append immutable URI records to a stable Artifact', () => {
  const columns = getTableColumns(artifactLocations);
  const config = getTableConfig(artifactLocations);

  for (const [property, name] of [
    ['locationId', 'location_id'], ['artifactId', 'artifact_id'], ['locationType', 'location_type'],
    ['uri', 'uri'], ['createdBy', 'created_by'], ['createdAt', 'created_at'],
  ]) assert.equal(columns[property].name, name);
  assert.equal(config.primaryKeys.length, 0);
  assert.equal(config.uniqueConstraints[0].name, 'artifact_locations_artifact_uri_unique');
  assert.deepEqual(config.uniqueConstraints[0].columns.map((column) => column.name), ['artifact_id', 'uri']);
  assert.equal(config.checks.length, 1);
});
