import { canonicalJson, rawHash } from '../../protocol/src/hash.mjs';

export class MerkleLeafError extends Error {
  constructor(message, code = 'MERKLE_LEAF_INVALID') {
    super(message);
    this.name = 'MerkleLeafError';
    this.code = code;
  }
}

function requiredText(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new MerkleLeafError(`${field} must be a non-empty string`);
  }
  return value;
}

/** Encode the complete signed formal Event with a Merkle-specific domain separator. */
export function encodeResearchEventLeaf(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    throw new MerkleLeafError('research event must be an object');
  }
  if (event.schema !== 'srp.event.v1') throw new MerkleLeafError('research event schema must be srp.event.v1');
  requiredText(event.event_id, 'event id');
  requiredText(event.event_type, 'event type');
  requiredText(event.hash, 'event hash');
  if (!event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) throw new MerkleLeafError('event payload must be an object');
  if (!event.signature || typeof event.signature !== 'object' || Array.isArray(event.signature)) throw new MerkleLeafError('event signature must be an object');
  if (!Array.isArray(event.parents)) throw new MerkleLeafError('event parents must be an array');
  return canonicalJson({
    schema: 'evimesh.merkle-leaf.v1',
    event: {
      event_id: event.event_id,
      event_type: event.event_type,
      payload: event.payload,
      hash: event.hash,
      signature: event.signature,
      parents: event.parents,
    },
  });
}

/** Hash the canonical leaf encoding for use by the Merkle tree. */
export function hashResearchEventLeaf(event) {
  return `sha256:${rawHash(encodeResearchEventLeaf(event))}`;
}
