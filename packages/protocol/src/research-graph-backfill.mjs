export const RESEARCH_GRAPH_BACKFILL_SOURCES = Object.freeze([
  'research_node',
  'claim_relation',
  'evidence_claim_link',
  'challenge_revision',
  'challenge_impact',
  'task_dependency',
  'run_input',
  'run_output',
]);

export const RESEARCH_GRAPH_BACKFILL_PHASES = Object.freeze([
  'scanning',
  'applying',
  'blocked',
  'complete',
]);

export const RESEARCH_GRAPH_BACKFILL_CHECKPOINT_SCHEMA = 'evimesh.research-graph-backfill-checkpoint.v1';
export const RESEARCH_GRAPH_BACKFILL_PLAN_SCHEMA = 'evimesh.research-graph-backfill-plan.v1';
