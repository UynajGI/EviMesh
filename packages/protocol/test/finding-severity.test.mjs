import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertFindingSeverity,
  FINDING_SEVERITIES,
  findingSeveritySemantics,
  isFindingSeverity,
} from '../src/finding-severity.mjs';

test('defines Finding severity levels and their blocking semantics', () => {
  assert.deepEqual(FINDING_SEVERITIES, ['critical', 'major', 'warning', 'note']);
  assert.equal(Object.isFrozen(FINDING_SEVERITIES), true);
  assert.match(findingSeveritySemantics('critical'), /blocks acceptance/);
  assert.match(findingSeveritySemantics('major'), /material issue/);
  assert.match(findingSeveritySemantics('warning'), /non-blocking/);
  assert.match(findingSeveritySemantics('note'), /informational/);
  FINDING_SEVERITIES.forEach((severity) => assert.equal(assertFindingSeverity(severity), severity));
});

test('rejects unsupported Finding severity levels', () => {
  assert.equal(isFindingSeverity('error'), false);
  assert.throws(() => assertFindingSeverity('error'), /unsupported finding severity/);
  assert.throws(() => findingSeveritySemantics(null), /unsupported finding severity/);
});
