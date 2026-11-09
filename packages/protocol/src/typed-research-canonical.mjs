import { canonicalJson } from './hash.mjs';
import { assertResearchEdge } from './research-graph.mjs';

export const TYPED_RESEARCH_GRAPH_VERSION = 'research-graph.v1';

function requiredText(value, field) {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    throw new TypeError(`${field} must be a non-empty string without surrounding whitespace`);
  }
  return value;
}

function frozenJson(value, field) {
  let clone;
  try {
    clone = JSON.parse(canonicalJson(value));
  } catch (error) {
    throw new TypeError(`${field} must be JSON-compatible: ${error.message}`);
  }
  const freeze = (entry) => {
    if (entry && typeof entry === 'object') {
      for (const child of Object.values(entry)) freeze(child);
      Object.freeze(entry);
    }
    return entry;
  };
  return freeze(clone);
}

/**
 * Build the single payload a human signs for a typed research-node mutation.
 * Database ranks are deliberately absent: allocation happens only after the
 * immutable content, attribution, and complete incoming edge set are signed.
 */
export function createTypedResearchCanonicalPayload({
  schema,
  entityType,
  graphVersion = TYPED_RESEARCH_GRAPH_VERSION,
  producerActorId,
  draftedByActorId,
  publisherActorId,
  signerActorId = publisherActorId,
  node,
  incomingEdges,
} = {}) {
  schema = requiredText(schema, 'typed research schema');
  entityType = requiredText(entityType, 'typed research entity type');
  graphVersion = requiredText(graphVersion, 'research graph version');
  producerActorId = requiredText(producerActorId, 'producer actor id');
  draftedByActorId = requiredText(draftedByActorId, 'drafting actor id');
  publisherActorId = requiredText(publisherActorId, 'publisher actor id');
  signerActorId = requiredText(signerActorId, 'signer actor id');
  if (signerActorId !== publisherActorId) {
    throw new TypeError('signer actor id must match publisher actor id');
  }
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    throw new TypeError('typed research node must be an object');
  }
  if (!Array.isArray(incomingEdges)) {
    throw new TypeError('typed research incoming edges must be an array');
  }
  const normalizedEdges = incomingEdges.map((edge, index) => {
    try {
      const normalized = assertResearchEdge(edge);
      return { type: normalized.type, source: normalized.source, target: normalized.target };
    } catch (error) {
      throw new TypeError(`typed research incoming edge ${index} is invalid: ${error.message}`);
    }
  });
  const edgeKeys = normalizedEdges.map((edge) => canonicalJson(edge));
  if (new Set(edgeKeys).size !== edgeKeys.length) {
    throw new TypeError('typed research incoming edges must be unique');
  }

  return frozenJson({
    schema,
    entityType,
    graphVersion,
    producerActorId,
    draftedByActorId,
    publisherActorId,
    signerActorId,
    node,
    incomingEdges: normalizedEdges,
  }, 'typed research canonical payload');
}
