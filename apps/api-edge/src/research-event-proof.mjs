import { createMerkleInclusionProof } from '../../../packages/merkle/src/inclusion-proof.mjs';
import { hashResearchEventLeaf } from '../../../packages/merkle/src/research-event-leaf.mjs';

export class ResearchEventProofError extends Error {
  constructor(message, code = 'RESEARCH_EVENT_PROOF_INVALID', status = 400) {
    super(message);
    this.name = 'ResearchEventProofError';
    this.code = code;
    this.status = status;
  }
}

function requiredText(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ResearchEventProofError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function formalEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) throw new TypeError('research event must be an object');
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

function checkpointRange(checkpoint) {
  if (!checkpoint || typeof checkpoint !== 'object' || Array.isArray(checkpoint)) {
    throw new ResearchEventProofError('checkpoint result is invalid', 'RESEARCH_EVENT_PROOF_RESULT_INVALID', 500);
  }
  const checkpointId = requiredText(checkpoint.checkpointId, 'checkpoint id');
  const firstEventId = requiredText(checkpoint.firstEventId, 'checkpoint first event id');
  const lastEventId = requiredText(checkpoint.lastEventId, 'checkpoint last event id');
  if (typeof checkpoint.rootHash !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(checkpoint.rootHash)) {
    throw new ResearchEventProofError('checkpoint root hash is invalid', 'RESEARCH_EVENT_PROOF_RESULT_INVALID', 500);
  }
  return { checkpointId, firstEventId, lastEventId, rootHash: checkpoint.rootHash };
}

/** Return a verifiable Merkle inclusion proof for an Event covered by a published checkpoint. */
export async function getResearchEventInclusionProof({ repository, eventId } = {}) {
  for (const method of ['getMerkleCheckpointForEvent', 'listResearchEventRange']) {
    if (!repository || typeof repository[method] !== 'function') {
      throw new ResearchEventProofError(`repository ${method} is required`);
    }
  }
  eventId = requiredText(eventId, 'event id');
  const checkpoint = await repository.getMerkleCheckpointForEvent(eventId);
  if (!checkpoint) throw new ResearchEventProofError('published checkpoint for event not found', 'RESEARCH_EVENT_CHECKPOINT_NOT_FOUND', 404);
  const range = checkpointRange(checkpoint);
  const events = await repository.listResearchEventRange({ firstEventId: range.firstEventId, lastEventId: range.lastEventId });
  if (!Array.isArray(events) || events.length === 0) {
    throw new ResearchEventProofError('checkpoint Event range is empty', 'RESEARCH_EVENT_PROOF_RESULT_INVALID', 500);
  }
  const leafIndex = events.findIndex((event) => (event?.eventId ?? event?.event_id) === eventId);
  if (leafIndex < 0) throw new ResearchEventProofError('event is outside its checkpoint range', 'RESEARCH_EVENT_PROOF_RESULT_INVALID', 500);
  try {
    const proof = createMerkleInclusionProof({ leafHashes: events.map((event) => hashResearchEventLeaf(formalEvent(event))), leafIndex });
    if (proof.root !== range.rootHash) {
      throw new ResearchEventProofError('checkpoint root does not match its Event range', 'RESEARCH_EVENT_PROOF_ROOT_MISMATCH', 500);
    }
    return Object.freeze({ checkpointId: range.checkpointId, proof });
  } catch (error) {
    if (error instanceof ResearchEventProofError) throw error;
    throw new ResearchEventProofError(`checkpoint Event range cannot form a proof: ${error.message}`, 'RESEARCH_EVENT_PROOF_RESULT_INVALID', 500);
  }
}
