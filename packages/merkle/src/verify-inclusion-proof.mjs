import { hashMerkleNode } from './merkle-tree.mjs';

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;

function validHash(value) {
  return typeof value === 'string' && HASH_PATTERN.test(value);
}

/** Return whether a versioned, ordered inclusion proof reconstructs its asserted root. */
export function verifyMerkleInclusionProof(proof) {
  if (!proof || typeof proof !== 'object' || Array.isArray(proof)
    || proof.schema !== 'evimesh.merkle-inclusion-proof.v1'
    || !Number.isInteger(proof.leafIndex) || proof.leafIndex < 0
    || !validHash(proof.leafHash) || !validHash(proof.root) || !Array.isArray(proof.path)) {
    return false;
  }
  try {
    let index = proof.leafIndex;
    const reconstructed = proof.path.reduce((hash, step) => {
      if (!step || typeof step !== 'object' || !validHash(step.hash) || !['left', 'right'].includes(step.position)) {
        throw new TypeError('invalid proof step');
      }
      const expectedPosition = index % 2 === 0 ? 'right' : 'left';
      if (step.position !== expectedPosition) throw new TypeError('proof direction does not match leaf index');
      index = Math.floor(index / 2);
      return expectedPosition === 'left' ? hashMerkleNode(step.hash, hash) : hashMerkleNode(hash, step.hash);
    }, proof.leafHash);
    return reconstructed === proof.root;
  } catch {
    return false;
  }
}
