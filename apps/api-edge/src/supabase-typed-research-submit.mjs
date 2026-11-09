import { canonicalJson, rawHash } from "../../../packages/protocol/src/hash.mjs";
import { verifyEd25519Payload } from "../../../packages/signatures/src/server-verification.mjs";

const RPC_NAME = "execute_typed_research_submit";
const RESULT_SCHEMA = "evimesh.typed-research-submit-result.v1";
const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const BAD_REQUEST_CODES = new Set([
  "RESEARCH_GRAPH_DUAL_WRITE_EVENT_INVALID",
  "RESEARCH_GRAPH_DUAL_WRITE_EVENT_MISMATCH",
  "RESEARCH_GRAPH_DUAL_WRITE_EVENT_PARENT_INVALID",
  "TYPED_RESEARCH_ATTRIBUTION_INVALID",
  "TYPED_RESEARCH_EDGE_SET_INVALID",
  "TYPED_RESEARCH_EDGE_SET_MISMATCH",
  "TYPED_RESEARCH_ENVELOPE_INVALID",
  "TYPED_RESEARCH_GRAPH_VERSION_INVALID",
  "TYPED_RESEARCH_KIND_INVALID",
  "TYPED_RESEARCH_PAYLOAD_INVALID",
  "TYPED_RESEARCH_PLATFORM_EVENT_INVALID",
  "TYPED_RESEARCH_PLATFORM_EVENT_MISMATCH",
  "TYPED_RESEARCH_REVISION_INVALID",
]);

const FORBIDDEN_CODES = new Set([
  "TYPED_RESEARCH_AGENT_INVALID",
  "TYPED_RESEARCH_PROJECT_INVALID",
  "TYPED_RESEARCH_PROJECT_ROLE_FORBIDDEN",
  "TYPED_RESEARCH_PUBLISHER_INVALID",
  "TYPED_RESEARCH_PUBLISHER_OWNERSHIP_MISMATCH",
  "TYPED_RESEARCH_SIGNING_KEY_INVALID",
]);

const CONFLICT_CODES = new Set([
  "RESEARCH_GRAPH_DUAL_WRITE_EVENT_CONFLICT",
  "TYPED_RESEARCH_DANGLING_SOURCE",
  "TYPED_RESEARCH_NODE_EXISTS",
  "TYPED_RESEARCH_NODE_IDENTITY_MISMATCH",
  "TYPED_RESEARCH_REPLAY_CONFLICT",
  "TYPED_RESEARCH_REVISION_RACE",
  "TYPED_RESEARCH_SIGNATURE_REPLAYED",
  "TYPED_RESEARCH_TARGET_REVISION_EXISTS",
]);

const UNAVAILABLE_CODES = new Set([
  "TYPED_RESEARCH_MIGRATION_INCOMPLETE",
  "TYPED_RESEARCH_SERVICE_ROLE_REQUIRED",
]);

export class SupabaseTypedResearchSubmitError extends Error {
  constructor(message, code = "TYPED_RESEARCH_SUBMIT_INVALID", status = 400) {
    super(message);
    this.name = "SupabaseTypedResearchSubmitError";
    this.code = code;
    this.status = status;
  }
}

function requiredText(value, field) {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    throw new SupabaseTypedResearchSubmitError(`${field} must be a non-empty canonical string`);
  }
  return value;
}

function cloneJson(value, field) {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    throw new SupabaseTypedResearchSubmitError(`${field} must be JSON-compatible: ${error.message}`);
  }
}

function canonicalEqual(left, right) {
  try {
    return canonicalJson(left) === canonicalJson(right);
  } catch {
    return false;
  }
}

function serviceHeaders(serviceCredential, extra = {}) {
  const headers = { ...extra, apikey: serviceCredential };
  // Opaque sb_secret_* credentials are gateway API keys, not bearer JWTs.
  if (!serviceCredential.startsWith("sb_secret_")) headers.authorization = `Bearer ${serviceCredential}`;
  return headers;
}

function explicitEnabled(value) {
  return value === true || value === "true";
}

function platformKeyMap(platformKeys) {
  const entries = Array.isArray(platformKeys)
    ? platformKeys
    : platformKeys?.activeKey
      ? [platformKeys.activeKey, ...(platformKeys.retiredKeys ?? [])]
      : [];
  const keys = new Map();
  for (const entry of entries) {
    const keyId = entry?.keyId ?? entry?.key_id;
    const publicKey = entry?.publicKey ?? entry?.public_key;
    if (typeof keyId !== "string" || !keyId.trim() || typeof publicKey !== "string" || !publicKey.trim()) continue;
    if (keys.has(keyId.trim())) {
      throw new SupabaseTypedResearchSubmitError("platform signing key IDs must be unique", "TYPED_RESEARCH_PLATFORM_KEY_UNAVAILABLE", 503);
    }
    keys.set(keyId.trim(), Object.freeze({ keyId: keyId.trim(), publicKey: publicKey.trim() }));
  }
  return keys;
}

function bracketFailure(payload) {
  const message = typeof payload?.message === "string" ? payload.message : "";
  const match = /^\[([A-Z0-9_]+)\]\s*(.*)$/.exec(message);
  if (!match) return null;
  const code = match[1];
  const detail = match[2] || "typed research submission was rejected";
  if (BAD_REQUEST_CODES.has(code)) return new SupabaseTypedResearchSubmitError(detail, code, 400);
  if (FORBIDDEN_CODES.has(code)) return new SupabaseTypedResearchSubmitError(detail, code, 403);
  if (CONFLICT_CODES.has(code)) return new SupabaseTypedResearchSubmitError(detail, code, 409);
  if (UNAVAILABLE_CODES.has(code)) return new SupabaseTypedResearchSubmitError("typed research submission is not available", code, 503);
  // A new database guard must fail closed until the adapter assigns it an
  // intentional public status. Do not silently reinterpret it as success.
  if (code.startsWith("TYPED_RESEARCH_")) {
    return new SupabaseTypedResearchSubmitError("typed research submission conflicted with current state", "TYPED_RESEARCH_SUBMIT_CONFLICT", 409);
  }
  return null;
}

function transportFailure(payload, responseStatus) {
  const guarded = bracketFailure(payload);
  if (guarded) return guarded;
  const databaseCode = typeof payload?.code === "string" ? payload.code : "";
  if (databaseCode === "42501" || databaseCode === "42883" || databaseCode === "PGRST202"
      || databaseCode.startsWith("08") || /^PGRST00[0-3]$/.test(databaseCode)) {
    return new SupabaseTypedResearchSubmitError(
      "typed research submission dependency is unavailable",
      "TYPED_RESEARCH_SUBMIT_UNAVAILABLE",
      503,
    );
  }
  if (responseStatus === 409) {
    return new SupabaseTypedResearchSubmitError(
      "typed research submission conflicted with current state",
      "TYPED_RESEARCH_SUBMIT_CONFLICT",
      409,
    );
  }
  if (responseStatus >= 500 || responseStatus === 401 || responseStatus === 403 || responseStatus === 404 || responseStatus === 429) {
    return new SupabaseTypedResearchSubmitError(
      "typed research submission dependency is unavailable",
      "TYPED_RESEARCH_SUBMIT_UNAVAILABLE",
      503,
    );
  }
  return new SupabaseTypedResearchSubmitError(
    "typed research submission was rejected",
    "TYPED_RESEARCH_SUBMIT_REJECTED",
    400,
  );
}

function assertEnvelopeBindings(agentActorId, envelope, platformEvent) {
  agentActorId = requiredText(agentActorId, "Agent actor id");
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)
      || envelope.schema !== "srp.client-signature-envelope.v1"
      || typeof envelope.payload !== "object" || envelope.payload === null || Array.isArray(envelope.payload)
      || typeof envelope.signature !== "object" || envelope.signature === null || Array.isArray(envelope.signature)) {
    throw new SupabaseTypedResearchSubmitError("complete client signature envelope is required", "TYPED_RESEARCH_ENVELOPE_INVALID");
  }
  const publisherActorId = requiredText(envelope.payload.publisherActorId, "Human publisher actor id");
  const keyId = requiredText(envelope.signature.key_id, "Human signing key id");
  if (envelope.payload.producerActorId !== agentActorId || envelope.payload.draftedByActorId !== agentActorId
      || envelope.payload.signerActorId !== publisherActorId) {
    throw new SupabaseTypedResearchSubmitError(
      "signature envelope does not bind the producing Agent and Human publisher",
      "TYPED_RESEARCH_ATTRIBUTION_INVALID",
    );
  }
  if (envelope.signature.algorithm !== "Ed25519" || typeof envelope.signature.value !== "string" || !envelope.signature.value) {
    throw new SupabaseTypedResearchSubmitError("complete Ed25519 signature is required", "TYPED_RESEARCH_ENVELOPE_INVALID");
  }
  if (typeof envelope.nonce !== "string" || !NONCE_PATTERN.test(envelope.nonce)
      || typeof envelope.signing_bytes_hash !== "string" || !HASH_PATTERN.test(envelope.signing_bytes_hash)
      || !Array.isArray(envelope.payload.incomingEdges)) {
    throw new SupabaseTypedResearchSubmitError("signature envelope nonce, hash, or incoming edges are invalid", "TYPED_RESEARCH_ENVELOPE_INVALID");
  }
  const platformEventType = platformEvent?.event_type ?? platformEvent?.eventType;
  if (!platformEvent || typeof platformEvent !== "object" || Array.isArray(platformEvent)
      || platformEventType !== envelope.event_type
      || typeof platformEvent.payload !== "object" || platformEvent.payload === null || Array.isArray(platformEvent.payload)
      || typeof platformEvent.signature !== "object" || platformEvent.signature === null || Array.isArray(platformEvent.signature)
      || !Array.isArray(platformEvent.parents)) {
    throw new SupabaseTypedResearchSubmitError("complete platform-signed ResearchEvent is required", "TYPED_RESEARCH_PLATFORM_EVENT_INVALID");
  }
  const eventPayload = platformEvent.payload;
  if (eventPayload.actor_id !== agentActorId || eventPayload.producer_actor_id !== agentActorId
      || eventPayload.drafted_by_actor_id !== agentActorId || eventPayload.publisher_actor_id !== publisherActorId
      || eventPayload.signer_actor_id !== publisherActorId || eventPayload.signing_key_id !== keyId
      || eventPayload.nonce !== envelope.nonce || eventPayload.graph_version !== envelope.payload.graphVersion
      || !canonicalEqual(eventPayload.publisher_signature_envelope, envelope)
      || !canonicalEqual(eventPayload.typed_document, envelope.payload.node)
      || !canonicalEqual(eventPayload.incoming_edges, envelope.payload.incomingEdges)
      || Object.hasOwn(eventPayload, "commit_rank") || Object.hasOwn(eventPayload, "batch_rank")) {
    throw new SupabaseTypedResearchSubmitError(
      "platform event does not bind the signed attribution, document, nonce, key, and complete edge set",
      "TYPED_RESEARCH_PLATFORM_EVENT_MISMATCH",
    );
  }
  if (!HASH_PATTERN.test(eventPayload.canonical_content_hash ?? "")) {
    throw new SupabaseTypedResearchSubmitError("platform event canonical content hash is invalid", "TYPED_RESEARCH_PLATFORM_EVENT_INVALID");
  }
  return Object.freeze({ agentActorId, publisherActorId, keyId });
}

function signingBytesForEnvelope(envelope) {
  return canonicalJson({
    event_type: envelope.event_type,
    payload: envelope.payload,
    nonce: envelope.nonce,
  });
}

function platformEventIdentity(platformEvent) {
  return Object.freeze({
    eventId: platformEvent.event_id ?? platformEvent.eventId,
    eventType: platformEvent.event_type ?? platformEvent.eventType,
  });
}

function signingBytesForPlatformEvent(platformEvent) {
  const { eventType } = platformEventIdentity(platformEvent);
  return canonicalJson({ event_type: eventType, payload: platformEvent.payload, parents: platformEvent.parents });
}

function normalizeSigningKey(payload, actorId, keyId) {
  if (!Array.isArray(payload)) {
    throw new SupabaseTypedResearchSubmitError("signing key lookup returned an invalid response", "TYPED_RESEARCH_SUBMIT_UNAVAILABLE", 503);
  }
  if (payload.length === 0) return null;
  if (payload.length !== 1) {
    throw new SupabaseTypedResearchSubmitError("signing key lookup was not unique", "TYPED_RESEARCH_SUBMIT_UNAVAILABLE", 503);
  }
  const row = payload[0];
  if (!row || row.actor_id !== actorId || row.key_id !== keyId || row.algorithm !== "Ed25519"
      || typeof row.public_key !== "string" || !row.public_key
      || row.revoked_at !== null || row.deleted_at !== null) {
    return null;
  }
  return Object.freeze({
    keyId: row.key_id,
    actorId: row.actor_id,
    algorithm: row.algorithm,
    publicKey: row.public_key,
    revokedAt: row.revoked_at,
    deletedAt: row.deleted_at,
    active: true,
  });
}

function normalizeResult(payload, envelope) {
  const value = Array.isArray(payload) ? payload[0] : payload;
  const signedNode = envelope.payload.node;
  const signedKind = envelope.payload.entityType;
  const idField = `${signedKind}Id`;
  if (!value || typeof value !== "object" || Array.isArray(value)
      || value.schema !== RESULT_SCHEMA || !UUID_PATTERN.test(value.receiptId ?? "")
      || typeof value.eventId !== "string" || !value.eventId
      || typeof value.node !== "object" || value.node === null || Array.isArray(value.node)
      || value.node.kind !== signedKind || value.node.id !== signedNode?.[idField]
      || value.node.revision !== signedNode?.revision || value.node.projectId !== signedNode?.projectId
      || !Array.isArray(value.edgeIds) || value.edgeIds.some((id) => typeof id !== "string" || !id)
      || new Set(value.edgeIds).size !== value.edgeIds.length
      || !HASH_PATTERN.test(value.canonicalContentHash ?? "")
      || typeof value.createdAt !== "string" || !Number.isFinite(Date.parse(value.createdAt))) {
    throw new SupabaseTypedResearchSubmitError(
      "typed research RPC returned an invalid receipt",
      "TYPED_RESEARCH_SUBMIT_INVALID_RESULT",
      502,
    );
  }
  return Object.freeze(cloneJson(value, "typed research receipt"));
}

/**
 * Service-only PostgREST adapter for the single transactional typed-submit RPC.
 * It deliberately exposes no nonce-claim method: nonce consumption belongs to
 * the same database transaction as Event, node, revision, subtype, and edges.
 */
export function createSupabaseTypedResearchSubmitAdapter({
  url = null,
  serviceRoleKey = null,
  fetchImpl = fetch,
  enabled = false,
  dependenciesReady = false,
  platformKeys = [],
  resolvePlatformSigningKey = null,
} = {}) {
  const baseUrl = typeof url === "string" && url.trim() ? url.trim().replace(/\/$/, "") : null;
  const serviceCredential = typeof serviceRoleKey === "string" && serviceRoleKey.trim() ? serviceRoleKey.trim() : null;
  const staticPlatformKeys = platformKeyMap(platformKeys);
  const platformKeyResolver = typeof resolvePlatformSigningKey === "function"
    ? resolvePlatformSigningKey
    : staticPlatformKeys.size > 0
      ? async (keyId) => staticPlatformKeys.get(keyId) ?? null
      : null;
  const configured = baseUrl !== null && serviceCredential !== null && typeof fetchImpl === "function" && platformKeyResolver !== null;
  const gateEnabled = explicitEnabled(enabled);
  const dependencyGate = dependenciesReady === true;
  const ready = configured && gateEnabled && dependencyGate;

  function assertReady() {
    if (!ready) {
      throw new SupabaseTypedResearchSubmitError(
        "typed research submission dependencies or release gate are not ready",
        "TYPED_RESEARCH_SUBMIT_UNAVAILABLE",
        503,
      );
    }
  }

  async function findActiveSigningKey(actorId, keyId) {
    assertReady();
    actorId = requiredText(actorId, "Human publisher actor id");
    keyId = requiredText(keyId, "Human signing key id");
    const endpoint = new URL(`${baseUrl}/rest/v1/signing_keys`);
    endpoint.searchParams.set("select", "key_id,actor_id,algorithm,public_key,revoked_at,deleted_at");
    // Plain `eq.` filters take the value verbatim (URLSearchParams encodes it);
    // PostgREST only strips double quotes inside in.() lists and logic trees,
    // so quoting here would compare against `"key_..."` and never match.
    endpoint.searchParams.set("actor_id", `eq.${actorId}`);
    endpoint.searchParams.set("key_id", `eq.${keyId}`);
    endpoint.searchParams.set("revoked_at", "is.null");
    endpoint.searchParams.set("deleted_at", "is.null");
    endpoint.searchParams.set("limit", "2");
    let response;
    try {
      response = await fetchImpl(endpoint, {
        headers: serviceHeaders(serviceCredential, { accept: "application/json" }),
      });
    } catch {
      throw new SupabaseTypedResearchSubmitError("signing key lookup is unreachable", "TYPED_RESEARCH_SUBMIT_UNAVAILABLE", 503);
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw transportFailure(payload, response.status);
    return normalizeSigningKey(payload, actorId, keyId);
  }

  async function verifySubmissionCryptography(agentActorId, signatureEnvelope, platformEvent) {
    const bindings = assertEnvelopeBindings(agentActorId, signatureEnvelope, platformEvent);
    const envelopeSigningBytes = signingBytesForEnvelope(signatureEnvelope);
    const expectedEnvelopeHash = `sha256:${rawHash(envelopeSigningBytes)}`;
    if (signatureEnvelope.signing_bytes_hash !== expectedEnvelopeHash) {
      throw new SupabaseTypedResearchSubmitError(
        "signature envelope signing bytes hash mismatch",
        "CLIENT_SIGNATURE_HASH_MISMATCH",
        400,
      );
    }
    const humanKey = await findActiveSigningKey(bindings.publisherActorId, bindings.keyId);
    if (!humanKey) {
      throw new SupabaseTypedResearchSubmitError(
        "no matching active signing key for the Human publisher",
        "CLIENT_SIGNATURE_KEY_NOT_FOUND",
        400,
      );
    }
    const humanVerified = await verifyEd25519Payload({
      signingBytes: new TextEncoder().encode(envelopeSigningBytes),
      signature: signatureEnvelope.signature.value,
      publicKey: humanKey.publicKey,
    });
    if (humanVerified !== true) {
      throw new SupabaseTypedResearchSubmitError("Human publisher signature verification failed", "CLIENT_SIGNATURE_MISMATCH", 400);
    }

    const identity = platformEventIdentity(platformEvent);
    if (typeof identity.eventId !== "string" || !UUID_PATTERN.test(identity.eventId)
        || identity.eventType !== signatureEnvelope.event_type
        || !HASH_PATTERN.test(platformEvent.hash ?? "")
        || platformEvent.signature?.algorithm !== "Ed25519"
        || typeof platformEvent.signature?.key_id !== "string" || !platformEvent.signature.key_id.trim()
        || typeof platformEvent.signature?.value !== "string" || !platformEvent.signature.value) {
      throw new SupabaseTypedResearchSubmitError("platform ResearchEvent signature envelope is invalid", "TYPED_RESEARCH_PLATFORM_EVENT_INVALID", 503);
    }
    const platformSigningBytes = signingBytesForPlatformEvent(platformEvent);
    if (platformEvent.hash !== `sha256:${rawHash(platformSigningBytes)}`) {
      throw new SupabaseTypedResearchSubmitError("platform ResearchEvent hash mismatch", "TYPED_RESEARCH_PLATFORM_EVENT_HASH_MISMATCH", 503);
    }
    let resolvedPlatformKey;
    try {
      resolvedPlatformKey = await platformKeyResolver(platformEvent.signature.key_id.trim());
    } catch {
      throw new SupabaseTypedResearchSubmitError("platform signing key lookup is unavailable", "TYPED_RESEARCH_PLATFORM_KEY_UNAVAILABLE", 503);
    }
    const resolvedKeyId = resolvedPlatformKey?.keyId ?? resolvedPlatformKey?.key_id;
    const resolvedPublicKey = resolvedPlatformKey?.publicKey ?? resolvedPlatformKey?.public_key;
    if (resolvedKeyId !== platformEvent.signature.key_id.trim() || typeof resolvedPublicKey !== "string" || !resolvedPublicKey) {
      throw new SupabaseTypedResearchSubmitError("platform signing key is unavailable", "TYPED_RESEARCH_PLATFORM_KEY_UNAVAILABLE", 503);
    }
    const platformVerified = await verifyEd25519Payload({
      signingBytes: new TextEncoder().encode(platformSigningBytes),
      signature: platformEvent.signature.value,
      publicKey: resolvedPublicKey,
    });
    if (platformVerified !== true) {
      throw new SupabaseTypedResearchSubmitError("platform ResearchEvent signature verification failed", "TYPED_RESEARCH_PLATFORM_SIGNATURE_INVALID", 503);
    }
    return bindings;
  }

  async function executeTypedResearchSubmit({ agentActorId, signatureEnvelope, platformEvent } = {}) {
    assertReady();
    await verifySubmissionCryptography(agentActorId, signatureEnvelope, platformEvent);
    const envelope = cloneJson(signatureEnvelope, "signature envelope");
    const event = cloneJson(platformEvent, "platform event");
    let response;
    try {
      response = await fetchImpl(`${baseUrl}/rest/v1/rpc/${RPC_NAME}`, {
        method: "POST",
        headers: serviceHeaders(serviceCredential, { accept: "application/json", "content-type": "application/json" }),
        body: JSON.stringify({
          p_agent_actor_id: agentActorId,
          p_signature_envelope: envelope,
          p_platform_event: event,
        }),
      });
    } catch {
      throw new SupabaseTypedResearchSubmitError("typed research submit RPC is unreachable", "TYPED_RESEARCH_SUBMIT_UNAVAILABLE", 503);
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw transportFailure(payload, response.status);
    return normalizeResult(payload, envelope);
  }

  return Object.freeze({
    atomic: true,
    persistent: true,
    consumesNonceInTransaction: true,
    configured,
    enabled: gateEnabled,
    dependenciesReady: dependencyGate,
    ready,
    findActiveSigningKey,
    verifySubmissionCryptography,
    executeTypedResearchSubmit,
  });
}

export function createSupabaseTypedResearchSubmitFromEnv(env = {}, {
  fetchImpl = fetch,
  dependenciesReady = false,
  platformKeys = [],
  resolvePlatformSigningKey = null,
} = {}) {
  return createSupabaseTypedResearchSubmitAdapter({
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY,
    fetchImpl,
    enabled: env.EVIMESH_RESEARCH_SUBMIT_ENABLED === "true",
    dependenciesReady,
    platformKeys,
    resolvePlatformSigningKey,
  });
}

export const TYPED_RESEARCH_SUBMIT_RPC_NAME = RPC_NAME;
export const TYPED_RESEARCH_SUBMIT_RESULT_SCHEMA = RESULT_SCHEMA;
