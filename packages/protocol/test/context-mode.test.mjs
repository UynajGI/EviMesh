import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertContextMode,
  contextModeSemantics,
  CONTEXT_MODES,
  isContextMode,
} from '../src/context-mode.mjs';

test('defines the four ContextBundle modes', () => {
  assert.deepEqual(CONTEXT_MODES, ['frontier', 'full_trace', 'adversarial', 'blind']);
  assert.equal(Object.isFrozen(CONTEXT_MODES), true);
  assert.match(contextModeSemantics('frontier'), /fixed Frontier snapshot/);
  assert.match(contextModeSemantics('full_trace'), /trace and provenance/);
  assert.match(contextModeSemantics('adversarial'), /challenges/);
  assert.match(contextModeSemantics('blind'), /hide expected outputs/);
  CONTEXT_MODES.forEach((mode) => assert.equal(assertContextMode(mode), mode));
});

test('rejects unsupported ContextBundle modes', () => {
  assert.equal(isContextMode('minimal'), false);
  assert.throws(() => assertContextMode('minimal'), /unsupported context mode/);
  assert.throws(() => contextModeSemantics(undefined), /unsupported context mode/);
});
