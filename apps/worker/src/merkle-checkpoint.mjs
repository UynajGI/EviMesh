import { hashResearchEventLeaf } from '../../../packages/merkle/src/research-event-leaf.mjs';
import { buildMerkleTree } from '../../../packages/merkle/src/merkle-tree.mjs';

export class MerkleCheckpointError extends Error {
  constructor(message, code = 'MERKLE_CHECKPOINT_INVALID', status = 400) {
    super(message);
    this.name = 'MerkleCheckpointError';
    this.code = code;
    this.status = status;
  }
}

function requiredText(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new MerkleCheckpointError(`${field} event id must be a non-empty string`);
  }
  return value.trim();
}

function normalizeEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    throw new MerkleCheckpointError('research event range contains an invalid event', 'MERKLE_CHECKPOINT_RANGE_INVALID', 409);
  }
  if (event.schema === 'srp.event.v1') return event;
  return {
    schema: 'srp.event.v1',
    event_id: event.eventId,
    event_type: event.eventType,
    payload: event.payload,
    hash: event.hash,
    signature: event.signature,
    parents: event.parents,
  };
}

function assertContiguousRange(events, { firstEventId, lastEventId }) {
  if (!Array.isArray(events) || events.length === 0) {
    throw new MerkleCheckpointError('research event range is empty', 'MERKLE_CHECKPOINT_RANGE_EMPTY', 404);
  }
  const eventIds = events.map((event) => event?.eventId ?? event?.event_id);
  if (eventIds[0] !== firstEventId || eventIds.at(-1) !== lastEventId || eventIds.some((eventId) => typeof eventId !== 'string' || eventId.length === 0) || new Set(eventIds).size !== eventIds.length) {
    throw new MerkleCheckpointError('research event range is not contiguous', 'MERKLE_CHECKPOINT_RANGE_INCOMPLETE', 409);
  }
}

/** Build an unsigned checkpoint candidate for one inclusive, repository-defined Event range. */
export async function createMerkleCheckpoint({ repository, firstEventId, lastEventId } = {}) {
  if (!repository || typeof repository.listResearchEventRange !== 'function') {
    throw new MerkleCheckpointError('repository listResearchEventRange is required');
  }
  firstEventId = requiredText(firstEventId, 'first');
  lastEventId = requiredText(lastEventId, 'last');
  const events = await repository.listResearchEventRange({ firstEventId, lastEventId });
  assertContiguousRange(events, { firstEventId, lastEventId });

  let leafHashes;
  try {
    leafHashes = events.map((event) => hashResearchEventLeaf(normalizeEvent(event)));
  } catch (error) {
    throw new MerkleCheckpointError(`research event range cannot form Merkle leaves: ${error.message}`, 'MERKLE_CHECKPOINT_EVENT_INVALID', 409);
  }
  const tree = buildMerkleTree(leafHashes);
  return Object.freeze({
    schema: 'evimesh.merkle-checkpoint.v1',
    firstEventId,
    lastEventId,
    eventCount: events.length,
    rootHash: tree.root,
  });
}
