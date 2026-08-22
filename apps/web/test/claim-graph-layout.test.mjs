import test from 'node:test';
import assert from 'node:assert/strict';
import { claimLayoutEndpoints } from '../lib/claim-graph-layout.mjs';

test('upstream layout places larger depth before smaller depth without changing protocol endpoints', () => {
  const edge = { source: 'claim-root', target: 'claim-prior' };
  assert.deepEqual(claimLayoutEndpoints({ ...edge, sourceDepth: 0, targetDepth: 2, direction: 'upstream' }), {
    layoutSource: 'claim-prior', layoutTarget: 'claim-root',
  });
  assert.deepEqual(edge, { source: 'claim-root', target: 'claim-prior' });
});

test('downstream layout places smaller depth before larger depth', () => {
  assert.deepEqual(claimLayoutEndpoints({ source: 'claim-root', target: 'claim-later', sourceDepth: 0, targetDepth: 2, direction: 'downstream' }), {
    layoutSource: 'claim-root', layoutTarget: 'claim-later',
  });
});

test('equal-depth layout uses a stable id fallback', () => {
  assert.deepEqual(claimLayoutEndpoints({ source: 'claim-z', target: 'claim-a', sourceDepth: 1, targetDepth: 1, direction: 'upstream' }), {
    layoutSource: 'claim-a', layoutTarget: 'claim-z',
  });
});
