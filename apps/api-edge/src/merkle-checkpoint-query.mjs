export class MerkleCheckpointQueryError extends Error {
  constructor(message, code = 'MERKLE_CHECKPOINT_QUERY_INVALID', status = 400) {
    super(message);
    this.name = 'MerkleCheckpointQueryError';
    this.code = code;
    this.status = status;
  }
}

function requiredText(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new MerkleCheckpointQueryError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function parseSignature(value) {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      throw new MerkleCheckpointQueryError('checkpoint signature is invalid', 'MERKLE_CHECKPOINT_RESULT_INVALID', 500);
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || value.algorithm !== 'Ed25519' || typeof value.keyId !== 'string' || value.keyId.length === 0
    || typeof value.value !== 'string' || value.value.length === 0) {
    throw new MerkleCheckpointQueryError('checkpoint signature is invalid', 'MERKLE_CHECKPOINT_RESULT_INVALID', 500);
  }
  return { algorithm: value.algorithm, keyId: value.keyId, value: value.value };
}

function normalizeCheckpoint(checkpoint) {
  if (!checkpoint || typeof checkpoint !== 'object' || Array.isArray(checkpoint)) {
    throw new MerkleCheckpointQueryError('checkpoint result is invalid', 'MERKLE_CHECKPOINT_RESULT_INVALID', 500);
  }
  const checkpointId = requiredText(checkpoint.checkpointId, 'checkpoint id');
  const firstEventId = requiredText(checkpoint.firstEventId, 'first event id');
  const lastEventId = requiredText(checkpoint.lastEventId, 'last event id');
  if (!Number.isInteger(checkpoint.eventCount) || checkpoint.eventCount < 1) {
    throw new MerkleCheckpointQueryError('checkpoint event count is invalid', 'MERKLE_CHECKPOINT_RESULT_INVALID', 500);
  }
  if (typeof checkpoint.rootHash !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(checkpoint.rootHash)) {
    throw new MerkleCheckpointQueryError('checkpoint root hash is invalid', 'MERKLE_CHECKPOINT_RESULT_INVALID', 500);
  }
  return Object.freeze({
    checkpointId,
    schema: 'evimesh.merkle-checkpoint.v1',
    firstEventId,
    lastEventId,
    eventCount: checkpoint.eventCount,
    rootHash: checkpoint.rootHash,
    signature: parseSignature(checkpoint.signature),
  });
}

/** Return the published checkpoint root, inclusive Event range, and platform signature. */
export async function getMerkleCheckpoint({ repository, checkpointId } = {}) {
  if (!repository || typeof repository.getMerkleCheckpoint !== 'function') {
    throw new MerkleCheckpointQueryError('repository getMerkleCheckpoint is required');
  }
  checkpointId = requiredText(checkpointId, 'checkpoint id');
  const checkpoint = await repository.getMerkleCheckpoint(checkpointId);
  if (!checkpoint) throw new MerkleCheckpointQueryError('checkpoint not found', 'MERKLE_CHECKPOINT_NOT_FOUND', 404);
  return normalizeCheckpoint(checkpoint);
}
