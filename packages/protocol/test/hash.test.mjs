import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalJson,
  createHashPair,
  rawHash,
  semanticHash,
} from '../src/hash.mjs';

test('raw_hash hashes the exact submitted bytes', () => {
  assert.equal(
    rawHash(new TextEncoder().encode('EviMesh')),
    '3ec4ae647008dd2dfdd12b332f4dab7c6683ad53e3dbd48201983fa6306c909d',
  );
  assert.notEqual(rawHash('EviMesh'), rawHash('evimesh'));
});

test('semantic_hash is stable across object key order', () => {
  const first = { title: 'Claim', authors: ['A'], metadata: { z: 2, a: 1 } };
  const second = { metadata: { a: 1, z: 2 }, authors: ['A'], title: 'Claim' };

  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(semanticHash(first), semanticHash(second));
  assert.notEqual(semanticHash(first), semanticHash({ ...first, title: 'Other' }));
});

test('hash pair keeps raw and semantic hashes distinct', () => {
  const pair = createHashPair({ raw: '{"b":2,"a":1}', semantic: { a: 1, b: 2 } });

  assert.deepEqual(Object.keys(pair), ['raw_hash', 'semantic_hash']);
  assert.notEqual(pair.raw_hash, pair.semantic_hash);
  assert.equal(Object.isFrozen(pair), true);
});

test('semantic hash rejects values without canonical JSON semantics', () => {
  assert.throws(() => semanticHash({ value: Number.NaN }), /non-finite/);
  assert.throws(() => semanticHash({ value: undefined }), /JSON-compatible/);
});
