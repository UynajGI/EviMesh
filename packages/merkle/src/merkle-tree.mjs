import { canonicalJson, rawHash } from '../../protocol/src/hash.mjs';

const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;

export class MerkleTreeError extends Error {
  constructor(message, code = 'MERKLE_TREE_INVALID') {
    super(message);
    this.name = 'MerkleTreeError';
    this.code = code;
  }
}

function normalizedHash(value, field) {
  if (typeof value !== 'string' || !HASH_PATTERN.test(value)) {
    throw new MerkleTreeError(`${field} must be a lowercase sha256 digest`);
  }
  return value;
}

/** Hash an ordered pair of child digests under the Merkle-node domain separator. */
export function hashMerkleNode(left, right) {
  left = normalizedHash(left, 'left hash');
  right = normalizedHash(right, 'right hash');
  return `sha256:${rawHash(canonicalJson({ schema: 'evimesh.merkle-node.v1', left, right }))}`;
}

/** Build an ordered binary Merkle tree, duplicating the final node at odd-width levels. */
export function buildMerkleTree(leafHashes) {
  if (!Array.isArray(leafHashes) || leafHashes.length === 0) {
    throw new MerkleTreeError('leaf hashes must be a non-empty array');
  }
  const leaves = leafHashes.map((hash, index) => normalizedHash(hash, `leaf hash ${index}`));
  const levels = [[...leaves]];
  while (levels.at(-1).length > 1) {
    const current = levels.at(-1);
    const next = [];
    for (let index = 0; index < current.length; index += 2) {
      next.push(hashMerkleNode(current[index], current[index + 1] ?? current[index]));
    }
    levels.push(next);
  }
  return Object.freeze({
    leafHashes: Object.freeze([...leaves]),
    levels: Object.freeze(levels.map((level) => Object.freeze([...level]))),
    root: levels.at(-1)[0],
  });
}
