import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { runs } from '../src/runs.mjs';

test('runs persist the immutable Run Receipt execution boundary', () => {
  const columns = getTableColumns(runs);
  const config = getTableConfig(runs);

  for (const [property, name] of [
    ['runId', 'run_id'], ['taskId', 'task_id'], ['contextBundleId', 'context_bundle_id'],
    ['sourceCode', 'source_code'], ['container', 'container'], ['command', 'command'],
    ['args', 'args'], ['environment', 'environment'], ['hardware', 'hardware'],
    ['randomSeed', 'random_seed'], ['startedAt', 'started_at'], ['endedAt', 'ended_at'],
    ['networkAccess', 'network_access'], ['exitCode', 'exit_code'],
    ['actorId', 'actor_id'], ['signature', 'signature'],
  ]) assert.equal(columns[property].name, name);
  assert.equal(columns.args.hasDefault, true);
  assert.equal(config.primaryKeys.length, 0);
  assert.equal(config.checks.length, 1);
  assert.equal(config.foreignKeys.length, 2);
});
