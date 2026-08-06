import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMerkleTree, hashMerkleNode, MerkleTreeError } from '../src/merkle-tree.mjs';

const leaves = [
  `sha256:${'a'.repeat(64)}`,
  `sha256:${'b'.repeat(64)}`,
  `sha256:${'c'.repeat(64)}`,
];

test('builds the expected deterministic root for the fixed three-leaf vector', () => {
  const tree = buildMerkleTree(leaves);
  assert.equal(tree.root, 'sha256:77e46b081630c15642ba4b29cf96e468d201b6a1162016c51c65bef9f218f7f6');
  assert.deepEqual(tree.levels.map((level) => level.length), [3, 2, 1]);
  assert.equal(tree.levels[1][1], hashMerkleNode(leaves[2], leaves[2]));
});

test('preserves order and rejects empty or malformed leaf vectors', () => {
  assert.notEqual(buildMerkleTree(leaves).root, buildMerkleTree([...leaves].reverse()).root);
  assert.throws(() => buildMerkleTree([]), MerkleTreeError);
  assert.throws(() => buildMerkleTree(['sha256:bad']), /leaf hash 0/);
});
