import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertRevisionSequence,
  createRevision,
  isRevision,
  nextRevision,
} from '../src/revision.mjs';

test('revision one starts a lineage without superseding another revision', () => {
  const revision = createRevision({ revision: 1 });

  assert.deepEqual(revision, { revision: 1, supersedes: null });
  assert.equal(Object.isFrozen(revision), true);
  assert.equal(isRevision(revision), true);
});

test('next revision is append-only and supersedes the previous revision', () => {
  const first = createRevision({ revision: 1 });
  const second = nextRevision(first);
  const third = nextRevision(second);

  assert.deepEqual(second, { revision: 2, supersedes: 1 });
  assert.deepEqual(third, { revision: 3, supersedes: 2 });
  assert.equal(assertRevisionSequence([first, second, third]), true);
});

test('rejects in-place overwrite and invalid revision links', () => {
  assert.throws(() => createRevision({ revision: 0 }), /positive integer/);
  assert.throws(() => createRevision({ revision: 1, supersedes: 0 }), /cannot supersede/);
  assert.throws(() => createRevision({ revision: 2 }), /immediately preceding/);
  assert.throws(() => createRevision({ revision: 3, supersedes: 1 }), /immediately preceding/);
  assert.throws(() => assertRevisionSequence([
    createRevision({ revision: 1 }),
    { revision: 3, supersedes: 2 },
  ]), /contiguous and append-only/);
  assert.equal(isRevision({ revision: 2, supersedes: 4 }), false);
});
