import test from 'node:test';
import assert from 'node:assert/strict';
import { createMerkleInclusionProof, MerkleProofError } from '../src/inclusion-proof.mjs';
import { hashMerkleNode } from '../src/merkle-tree.mjs';

const leaves = [
  `sha256:${'a'.repeat(64)}`,
  `sha256:${'b'.repeat(64)}`,
  `sha256:${'c'.repeat(64)}`,
  `sha256:${'d'.repeat(64)}`,
  `sha256:${'e'.repeat(64)}`,
];

function reconstructRoot(proof) {
  return proof.path.reduce((hash, step) => step.position === 'left'
    ? hashMerkleNode(step.hash, hash)
    : hashMerkleNode(hash, step.hash), proof.leafHash);
}

test('generates a verifiable inclusion proof for every leaf, including odd-width levels', () => {
  for (let leafIndex = 0; leafIndex < leaves.length; leafIndex += 1) {
    const proof = createMerkleInclusionProof({ leafHashes: leaves, leafIndex });
    assert.equal(proof.schema, 'evimesh.merkle-inclusion-proof.v1');
    assert.equal(proof.leafHash, leaves[leafIndex]);
    assert.equal(reconstructRoot(proof), proof.root);
  }
});

test('rejects invalid and out-of-range leaf indexes', () => {
  assert.throws(() => createMerkleInclusionProof({ leafHashes: leaves, leafIndex: -1 }), MerkleProofError);
  assert.throws(() => createMerkleInclusionProof({ leafHashes: leaves, leafIndex: leaves.length }), (error) => error.code === 'MERKLE_LEAF_NOT_FOUND');
});
