import test from 'node:test';
import assert from 'node:assert/strict';
import { createMerkleInclusionProof } from '../src/inclusion-proof.mjs';
import { verifyMerkleInclusionProof } from '../src/verify-inclusion-proof.mjs';

const leaves = [
  `sha256:${'a'.repeat(64)}`,
  `sha256:${'b'.repeat(64)}`,
  `sha256:${'c'.repeat(64)}`,
];

test('verifies every generated inclusion proof', () => {
  for (let leafIndex = 0; leafIndex < leaves.length; leafIndex += 1) {
    assert.equal(verifyMerkleInclusionProof(createMerkleInclusionProof({ leafHashes: leaves, leafIndex })), true);
  }
});

test('rejects tampered leaves, indices, siblings, directions, roots, and malformed proof shapes', () => {
  const proof = createMerkleInclusionProof({ leafHashes: leaves, leafIndex: 1 });
  assert.equal(verifyMerkleInclusionProof({ ...proof, leafHash: leaves[0] }), false);
  assert.equal(verifyMerkleInclusionProof({ ...proof, leafIndex: 0 }), false);
  assert.equal(verifyMerkleInclusionProof({ ...proof, leafIndex: 5 }), false);
  assert.equal(verifyMerkleInclusionProof({ ...proof, root: leaves[0] }), false);
  assert.equal(verifyMerkleInclusionProof({ ...proof, path: [{ ...proof.path[0], hash: `sha256:${'f'.repeat(64)}` }, ...proof.path.slice(1)] }), false);
  assert.equal(verifyMerkleInclusionProof({ ...proof, path: [{ ...proof.path[0], position: 'right' }, ...proof.path.slice(1)] }), false);
  assert.equal(verifyMerkleInclusionProof({ ...proof, schema: 'evimesh.merkle-inclusion-proof.v2' }), false);
});
