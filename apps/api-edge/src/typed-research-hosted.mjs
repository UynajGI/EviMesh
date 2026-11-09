import { canonicalJson, rawHash } from "../../../packages/protocol/src/hash.mjs";
import { canonicalTypedResearchSubmission } from "./typed-research-prepare.mjs";
import { SupabaseTypedResearchSubmitError } from "./supabase-typed-research-submit.mjs";

function cloneJson(value, field) {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    throw new SupabaseTypedResearchSubmitError(`${field} must be JSON-compatible: ${error.message}`);
  }
}

function sameJson(left, right) {
  try {
    return canonicalJson(left) === canonicalJson(right);
  } catch {
    return false;
  }
}

function requiredText(value, field) {
  if (typeof value !== "string" || !value || value.trim() !== value) {
    throw new SupabaseTypedResearchSubmitError(`${field} must be a non-empty canonical string`);
  }
  return value;
}

/**
 * Build the rank-free platform Event payload from the same canonical document
 * the Human signed. No database rank or mutable relation can be introduced
 * between prepare and the atomic RPC.
 */
export function buildHostedTypedResearchEventPayload({
  kind,
  input,
  agentActorId,
  publisherActorId,
  signatureEnvelope,
} = {}) {
  agentActorId = requiredText(agentActorId, "producing Agent actor id");
  publisherActorId = requiredText(publisherActorId, "Human publisher actor id");
  const canonical = canonicalTypedResearchSubmission({
    kind,
    input,
    producerActorId: agentActorId,
    publisherActorId,
  });
  if (!signatureEnvelope || typeof signatureEnvelope !== "object" || Array.isArray(signatureEnvelope)
      || signatureEnvelope.event_type !== canonical.definition.eventType
      || !sameJson(signatureEnvelope.payload, canonical.payload)) {
    throw new SupabaseTypedResearchSubmitError(
      "signature envelope does not match the canonical typed research submission",
      "CLIENT_SIGNATURE_PAYLOAD_MISMATCH",
      400,
    );
  }
  const envelope = cloneJson(signatureEnvelope, "signature envelope");
  const node = canonical.payload.node;
  const idField = canonical.definition.idField;
  const signingKeyId = requiredText(envelope.signature?.key_id, "Human signing key id");
  const eventPayload = Object.freeze({
    entity_type: kind,
    entity_id: node[idField],
    project_id: node.projectId,
    revision: node.revision,
    supersedes_revision: node.supersedesRevision,
    actor_id: agentActorId,
    producer_actor_id: agentActorId,
    drafted_by_actor_id: agentActorId,
    publisher_actor_id: publisherActorId,
    signer_actor_id: publisherActorId,
    signing_key_id: signingKeyId,
    nonce: envelope.nonce,
    publisher_signature_envelope: envelope,
    graph_version: canonical.payload.graphVersion,
    canonical_content_hash: `sha256:${rawHash(canonicalJson(canonical.payload))}`,
    typed_document: cloneJson(node, "typed research document"),
    incoming_edges: cloneJson(canonical.payload.incomingEdges, "typed research incoming edges"),
    // Question/Claim events also carry the legacy typed key so existing
    // activity filters (payload->>claim_id, payload->>question_id) see them.
    ...(kind === "question" || kind === "claim" ? { [`${kind}_id`]: node[idField] } : {}),
  });
  return Object.freeze({ canonical, signatureEnvelope: envelope, eventPayload });
}

/**
 * Hosted typed research submit path. The platform factory creates a signed
 * ResearchEvent, then the adapter re-verifies both Human and platform
 * signatures before issuing the one atomic PostgREST mutation RPC.
 */
export function createHostedTypedResearchSubmitter({ adapter, platformEventFactory } = {}) {
  const ready = adapter?.ready === true
    && adapter?.atomic === true
    && adapter?.consumesNonceInTransaction === true
    && typeof adapter?.executeTypedResearchSubmit === "function"
    && typeof platformEventFactory === "function";

  async function submit({ kind, input, agentActorId, publisherActorId, signatureEnvelope } = {}) {
    if (!ready) {
      throw new SupabaseTypedResearchSubmitError(
        "hosted typed research submission dependencies are not ready",
        "TYPED_RESEARCH_SUBMIT_UNAVAILABLE",
        503,
      );
    }
    const prepared = buildHostedTypedResearchEventPayload({
      kind,
      input,
      agentActorId,
      publisherActorId,
      signatureEnvelope,
    });
    const platformEvent = await platformEventFactory({
      eventType: prepared.canonical.definition.eventType,
      payload: prepared.eventPayload,
    });
    return adapter.executeTypedResearchSubmit({
      agentActorId,
      signatureEnvelope: prepared.signatureEnvelope,
      platformEvent,
    });
  }

  return Object.freeze({ ready, submit });
}
