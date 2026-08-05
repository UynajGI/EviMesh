import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertDependencyAddition,
  assertDependencyGraph,
  canAddDependency,
} from '../src/dependency-graph.mjs';

test('accepts a valid acyclic dependency graph', () => {
  const edges = [
    { source: 'claim_b', target: 'claim_a' },
    { source: 'claim_c', target: 'claim_b' },
  ];

  assert.equal(assertDependencyGraph(edges), true);
  assert.equal(canAddDependency(edges, 'claim_d', 'claim_c'), true);
  assert.equal(assertDependencyAddition(edges, 'claim_d', 'claim_c'), true);
});

test('rejects self-dependencies and direct or indirect cycles', () => {
  const edges = [
    { type: 'depends_on', source: 'claim_b', target: 'claim_a' },
    { type: 'depends_on', source: 'claim_c', target: 'claim_b' },
  ];

  assert.equal(canAddDependency(edges, 'claim_a', 'claim_c'), false);
  assert.throws(() => assertDependencyAddition(edges, 'claim_a', 'claim_c'), /cycle/);
  assert.equal(canAddDependency(edges, 'claim_a', 'claim_a'), false);
  assert.throws(() => assertDependencyGraph([{ source: 'claim_a', target: 'claim_a' }]), /itself/);
  assert.throws(() => assertDependencyGraph([
    { source: 'claim_a', target: 'claim_b' },
    { source: 'claim_b', target: 'claim_a' },
  ]), /acyclic/);
});

test('rejects malformed or non-dependency edges', () => {
  assert.throws(() => assertDependencyGraph([{ type: 'supports', source: 'a', target: 'b' }]), /only depends_on/);
  assert.throws(() => assertDependencyGraph([{ source: '', target: 'b' }]), /source/);
  assert.throws(() => canAddDependency([], '', 'b'), /source/);
  assert.equal(canAddDependency([{ source: 'a', target: 'b' }], 'c', 'd'), true);
});
