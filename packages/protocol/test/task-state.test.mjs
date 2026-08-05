import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertTaskState,
  assertTaskTransition,
  canTransitionTask,
  isTaskState,
  TASK_STATES,
  taskTransitionsFrom,
} from '../src/task-state.mjs';

test('defines the task lifecycle and recovery paths', () => {
  assert.deepEqual(TASK_STATES, [
    'draft', 'open', 'active', 'blocked',
    'verification_requested', 'completed', 'cancelled',
  ]);
  assert.deepEqual(taskTransitionsFrom('draft'), ['open', 'cancelled']);
  assert.deepEqual(taskTransitionsFrom('active'), [
    'blocked', 'verification_requested', 'completed', 'cancelled',
  ]);
  assert.deepEqual(taskTransitionsFrom('blocked'), ['active', 'cancelled']);
  assert.deepEqual(taskTransitionsFrom('verification_requested'), ['active', 'completed', 'cancelled']);
  assert.deepEqual(taskTransitionsFrom('completed'), []);
  assert.deepEqual(taskTransitionsFrom('cancelled'), []);
  assert.equal(Object.isFrozen(TASK_STATES), true);
});

test('accepts documented task transitions and rejects reopening terminals', () => {
  assert.equal(canTransitionTask('draft', 'open'), true);
  assert.equal(canTransitionTask('open', 'active'), true);
  assert.equal(canTransitionTask('active', 'blocked'), true);
  assert.equal(canTransitionTask('blocked', 'active'), true);
  assert.equal(canTransitionTask('active', 'verification_requested'), true);
  assert.equal(canTransitionTask('verification_requested', 'completed'), true);
  assert.equal(canTransitionTask('completed', 'active'), false);
  assert.equal(canTransitionTask('cancelled', 'open'), false);
  assert.equal(assertTaskTransition('blocked', 'active'), true);
});

test('rejects unknown task states and illegal transitions', () => {
  TASK_STATES.forEach((state) => assert.equal(assertTaskState(state), state));
  assert.equal(isTaskState('paused'), false);
  assert.throws(() => assertTaskState('paused'), /unsupported task state/);
  assert.throws(() => assertTaskTransition('draft', 'active'), /invalid task state transition/);
  assert.throws(() => assertTaskTransition('completed', 'active'), /invalid task state transition/);
});
