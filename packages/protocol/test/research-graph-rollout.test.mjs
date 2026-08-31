import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RESEARCH_GRAPH_LEGACY_DUAL_WRITE_PARAMS,
  RESEARCH_GRAPH_LEGACY_DUAL_WRITE_RPC,
  RESEARCH_GRAPH_LEGACY_MUTATION_KINDS,
  RESEARCH_GRAPH_READ_MODES,
  RESEARCH_GRAPH_WRITE_MODES,
  resolveResearchGraphRollout,
} from '../src/research-graph-rollout.mjs';

test('defines explicit legacy, shadow, dual-write, and kernel rollout modes', () => {
  assert.deepEqual(RESEARCH_GRAPH_READ_MODES, ['legacy', 'shadow', 'kernel']);
  assert.deepEqual(RESEARCH_GRAPH_WRITE_MODES, ['legacy', 'dual_write', 'kernel']);
  assert.deepEqual(resolveResearchGraphRollout(), { readMode: 'legacy', writeMode: 'legacy' });
  assert.deepEqual(resolveResearchGraphRollout({ readMode: 'shadow', writeMode: 'dual_write' }), { readMode: 'shadow', writeMode: 'dual_write' });
});

test('publishes one explicit service RPC contract for the eight legacy mutation kinds', () => {
  assert.equal(RESEARCH_GRAPH_LEGACY_DUAL_WRITE_RPC, 'execute_research_graph_legacy_dual_write');
  assert.deepEqual(RESEARCH_GRAPH_LEGACY_DUAL_WRITE_PARAMS, [
    'p_mutation_kind', 'p_command', 'p_verified_events', 'p_expected_legacy',
  ]);
  assert.deepEqual(RESEARCH_GRAPH_LEGACY_MUTATION_KINDS, [
    'claim.create', 'claim.revise', 'claim.transition',
    'evidence.create', 'evidence.link',
    'verification_receipt.submit',
    'challenge.create', 'challenge.transition',
  ]);
});

test('rejects unknown modes and kernel reads over legacy-only writes', () => {
  assert.throws(() => resolveResearchGraphRollout({ readMode: 'new' }), /unsupported research graph read mode/);
  assert.throws(() => resolveResearchGraphRollout({ writeMode: 'mirror' }), /unsupported research graph write mode/);
  assert.throws(() => resolveResearchGraphRollout({ readMode: 'kernel', writeMode: 'legacy' }), /legacy-only writes/);
});
