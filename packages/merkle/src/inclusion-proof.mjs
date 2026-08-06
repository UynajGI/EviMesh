import { buildMerkleTree, MerkleTreeError } from './merkle-tree.mjs';

export class MerkleProofError extends Error {
  constructor(message, code = 'MERKLE_PROOF_INVALID') {
    super(message);
    this.name = 'MerkleProofError';
    this.code = code;
  }
}

/** Build the ordered sibling path needed to prove one leaf against its Merkle root. */
export function createMerkleInclusionProof({ leafHashes, leafIndex } = {}) {
  if (!Number.isInteger(leafIndex) || leafIndex < 0) {
    throw new MerkleProofError('leaf index must be a non-negative integer');
  }
  let tree;
  try {
    tree = buildMerkleTree(leafHashes);
  } catch (error) {
    if (error instanceof MerkleTreeError) throw new MerkleProofError(error.message, error.code);
    throw error;
  }
  if (leafIndex >= tree.leafHashes.length) {
    throw new MerkleProofError('leaf index is outside the tree', 'MERKLE_LEAF_NOT_FOUND');
  }
  let index = leafIndex;
  const path = [];
  for (const level of tree.levels.slice(0, -1)) {
    const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
    const actualSiblingIndex = siblingIndex < level.length ? siblingIndex : index;
    path.push(Object.freeze({
      position: actualSiblingIndex < index ? 'left' : 'right',
      hash: level[actualSiblingIndex],
    }));
    index = Math.floor(index / 2);
  }
  return Object.freeze({
    schema: 'evimesh.merkle-inclusion-proof.v1',
    leafIndex,
    leafHash: tree.leafHashes[leafIndex],
    root: tree.root,
    path: Object.freeze(path),
  });
}
