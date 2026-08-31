import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RESEARCH_GRAPH_BACKFILL_CHECKPOINT_SCHEMA,
  RESEARCH_GRAPH_BACKFILL_PHASES,
  RESEARCH_GRAPH_BACKFILL_PLAN_SCHEMA,
  RESEARCH_GRAPH_BACKFILL_SOURCES,
} from '../src/research-graph-backfill.mjs';

test('publishes the fixed backfill source, phase, checkpoint, and plan vocabulary', () => {
  assert.deepEqual(RESEARCH_GRAPH_BACKFILL_SOURCES, [
    'research_node', 'claim_relation', 'evidence_claim_link', 'challenge_revision', 'challenge_impact',
    'task_dependency', 'run_input', 'run_output',
  ]);
  assert.deepEqual(RESEARCH_GRAPH_BACKFILL_PHASES, ['scanning', 'applying', 'blocked', 'complete']);
  assert.equal(RESEARCH_GRAPH_BACKFILL_CHECKPOINT_SCHEMA, 'evimesh.research-graph-backfill-checkpoint.v1');
  assert.equal(RESEARCH_GRAPH_BACKFILL_PLAN_SCHEMA, 'evimesh.research-graph-backfill-plan.v1');
});
