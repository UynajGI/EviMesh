import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertFrontierChain,
  createFrontierSnapshot,
  nextFrontier,
} from '../src/frontier.mjs';

test('creates an immutable genesis frontier snapshot', () => {
  const frontier = createFrontierSnapshot({ number: 1, revision: 1, members: ['claim_a'] });

  assert.deepEqual(frontier, {
    number: 1,
    previous: null,
    revision: 1,
    members: ['claim_a'],
  });
  assert.equal(Object.isFrozen(frontier), true);
  assert.equal(Object.isFrozen(frontier.members), true);
});

test('creates only append-only frontier snapshots with previous references', () => {
  const first = createFrontierSnapshot({ number: 1, revision: 1 });
  const second = nextFrontier(first, { revision: 2, members: ['claim_a'] });
  const third = nextFrontier(second, { revision: 3, members: ['claim_a', 'claim_b'] });

  assert.deepEqual(second.previous, 1);
  assert.deepEqual(third.previous, 2);
  assert.equal(assertFrontierChain([first, second, third]), true);
});

test('rejects overwriting, skipped snapshots, and invalid genesis references', () => {
  assert.throws(() => createFrontierSnapshot({ number: 0, revision: 1 }), /positive integer/);
  assert.throws(() => createFrontierSnapshot({ number: 1, previous: 0, revision: 1 }), /genesis/);
  assert.throws(() => createFrontierSnapshot({ number: 3, previous: 1, revision: 3 }), /immediately previous/);
  assert.throws(() => nextFrontier({ number: 1 }), /positive integer/);
  assert.throws(() => assertFrontierChain([
    createFrontierSnapshot({ number: 1, revision: 1 }),
    { number: 3, previous: 2, revision: 3 },
  ]), /contiguous and append-only/);
});
