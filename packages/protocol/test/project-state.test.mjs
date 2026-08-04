import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertProjectState,
  assertProjectTransition,
  canTransitionProject,
  isProjectState,
  PROJECT_STATES,
  projectTransitionsFrom,
} from '../src/project-state.mjs';

test('defines the project lifecycle states and complete transition table', () => {
  assert.deepEqual(PROJECT_STATES, ['draft', 'active', 'archived']);
  assert.deepEqual(projectTransitionsFrom('draft'), ['active', 'archived']);
  assert.deepEqual(projectTransitionsFrom('active'), ['archived']);
  assert.deepEqual(projectTransitionsFrom('archived'), []);
  assert.equal(Object.isFrozen(PROJECT_STATES), true);
});

test('accepts only forward project transitions', () => {
  assert.equal(canTransitionProject('draft', 'active'), true);
  assert.equal(canTransitionProject('draft', 'archived'), true);
  assert.equal(canTransitionProject('active', 'archived'), true);
  assert.equal(canTransitionProject('active', 'draft'), false);
  assert.equal(canTransitionProject('archived', 'active'), false);
  assert.equal(assertProjectTransition('draft', 'active'), true);
});

test('rejects unknown states and illegal transitions', () => {
  PROJECT_STATES.forEach((state) => assert.equal(assertProjectState(state), state));
  assert.equal(isProjectState('completed'), false);
  assert.throws(() => assertProjectState('completed'), /unsupported project state/);
  assert.throws(() => projectTransitionsFrom('unknown'), /unsupported project state/);
  assert.throws(() => assertProjectTransition('active', 'draft'), /invalid project state transition/);
  assert.throws(() => assertProjectTransition('archived', 'archived'), /invalid project state transition/);
});
