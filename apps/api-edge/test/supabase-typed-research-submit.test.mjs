import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";

import { canonicalJson, rawHash } from "../../../packages/protocol/src/hash.mjs";
import { prepareTypedResearchSubmission } from "../src/typed-research-prepare.mjs";
import {
  createSupabaseTypedResearchSubmitAdapter,
  createSupabaseTypedResearchSubmitFromEnv,
  SupabaseTypedResearchSubmitError,
} from "../src/supabase-typed-research-submit.mjs";
import {
  buildHostedTypedResearchEventPayload,
  createHostedTypedResearchSubmitter,
} from "../src/typed-research-hosted.mjs";

const AGENT_ID = "actor-agent";
const HUMAN_ID = "actor-human";
const HUMAN_KEY_ID = "human-key-1";
const PLATFORM_KEY_ID = "platform-key-1";
const NONCE = "typed-research-nonce-0001";
const EVENT_ID = "018f0f4a-5c00-7000-8000-000000000001";
const RECEIPT_ID = "018f0f4a-5c00-7000-8000-000000000002";

function keyPair(keyId) {
  const pair = generateKeyPairSync("ed25519");
  return Object.freeze({
    keyId,
    publicKey: pair.publicKey.export({ format: "der", type: "spki" }).toString("base64url"),
    privateKey: pair.privateKey,
  });
}

const HUMAN_KEY = keyPair(HUMAN_KEY_ID);
const PLATFORM_KEY = keyPair(PLATFORM_KEY_ID);

const ANSWER_INPUT = Object.freeze({
  answerId: "answer-1",
  projectId: "project-1",
  revision: 1,
  supersedesRevision: null,
  state: "published",
  title: "A reproducible answer",
  synthesis: "The signed evidence supports this bounded answer.",
  limitations: ["One cohort"],
  questionRef: { kind: "question", id: "question-1", revision: 1 },
  additionalInputs: [{ kind: "dataset", id: "dataset-1", revision: 1 }],
});

function signedEnvelope({ kind = "answer", input = ANSWER_INPUT, publisherActorId = HUMAN_ID, key = HUMAN_KEY, nonce = NONCE } = {}) {
  const prepared = prepareTypedResearchSubmission({
    kind,
    input,
    producerActorId: AGENT_ID,
    publisherActorId,
    nonce,
  });
  return Object.freeze({
    schema: "srp.client-signature-envelope.v1",
    event_type: prepared.eventType,
    payload: prepared.payload,
    nonce: prepared.nonce,
    signing_bytes_hash: prepared.signingBytesHash,
    signature: Object.freeze({
      algorithm: "Ed25519",
      key_id: key.keyId,
      value: sign(null, Buffer.from(prepared.signingBytes, "utf8"), key.privateKey).toString("base64url"),
    }),
  });
}

function platformEventFor(signatureEnvelope, { kind = "answer", input = ANSWER_INPUT, key = PLATFORM_KEY, mutatePayload = null } = {}) {
  const built = buildHostedTypedResearchEventPayload({
    kind,
    input,
    agentActorId: AGENT_ID,
    publisherActorId: HUMAN_ID,
    signatureEnvelope,
  });
  const payload = mutatePayload ? mutatePayload(structuredClone(built.eventPayload)) : built.eventPayload;
  const signingBytes = canonicalJson({ event_type: signatureEnvelope.event_type, payload, parents: [] });
  return Object.freeze({
    schema: "srp.event.v1",
    event_id: EVENT_ID,
    event_type: signatureEnvelope.event_type,
    payload,
    hash: `sha256:${rawHash(signingBytes)}`,
    signature: Object.freeze({
      algorithm: "Ed25519",
      key_id: key.keyId,
      value: sign(null, Buffer.from(signingBytes, "utf8"), key.privateKey).toString("base64url"),
    }),
    parents: Object.freeze([]),
    created_at: "2026-08-31T00:00:00.000Z",
  });
}

function receiptFor(envelope) {
  return Object.freeze({
    schema: "evimesh.typed-research-submit-result.v1",
    receiptId: RECEIPT_ID,
    eventId: EVENT_ID,
    node: Object.freeze({
      kind: "answer",
      id: envelope.payload.node.answerId,
      revision: envelope.payload.node.revision,
      projectId: envelope.payload.node.projectId,
    }),
    edgeIds: Object.freeze(["edge-1", "edge-2"]),
    canonicalContentHash: `sha256:${"a".repeat(64)}`,
    createdAt: "2026-08-31T00:00:00.000Z",
  });
}

function signingKeyRow({ actorId = HUMAN_ID, key = HUMAN_KEY } = {}) {
  return {
    key_id: key.keyId,
    actor_id: actorId,
    algorithm: "Ed25519",
    public_key: key.publicKey,
    revoked_at: null,
    deleted_at: null,
  };
}

function adapter({ fetchImpl, enabled = true, dependenciesReady = true, platformKeys = [PLATFORM_KEY] } = {}) {
  return createSupabaseTypedResearchSubmitAdapter({
    url: "https://project.supabase.co",
    serviceRoleKey: "sb_secret_test",
    fetchImpl,
    enabled,
    dependenciesReady,
    platformKeys,
  });
}

test("hosted submit stays fail-closed until the explicit env gate and dependencies are both ready", async () => {
  let calls = 0;
  const store = createSupabaseTypedResearchSubmitFromEnv({
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_SECRET_KEY: "sb_secret_test",
    EVIMESH_RESEARCH_SUBMIT_ENABLED: "false",
  }, {
    fetchImpl: async () => { calls += 1; return Response.json({}); },
    dependenciesReady: true,
    platformKeys: [PLATFORM_KEY],
  });
  assert.equal(store.ready, false);
  assert.equal(store.atomic, true);
  assert.equal(store.consumesNonceInTransaction, true);
  assert.equal(Object.hasOwn(store, "claimSignatureNonce"), false);
  await assert.rejects(
    store.executeTypedResearchSubmit({}),
    (error) => error.code === "TYPED_RESEARCH_SUBMIT_UNAVAILABLE" && error.status === 503,
  );
  assert.equal(calls, 0);

  const missingDependency = createSupabaseTypedResearchSubmitFromEnv({
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_SECRET_KEY: "sb_secret_test",
    EVIMESH_RESEARCH_SUBMIT_ENABLED: "true",
  }, { fetchImpl: async () => Response.json({}), dependenciesReady: false, platformKeys: [PLATFORM_KEY] });
  assert.equal(missingDependency.ready, false);
});

test("signing key lookup is exact for Human actor and key id and never selects secret columns", async () => {
  let request;
  const store = adapter({
    fetchImpl: async (url, options) => {
      request = { url: new URL(url), options };
      return Response.json([signingKeyRow()]);
    },
  });
  const key = await store.findActiveSigningKey(HUMAN_ID, HUMAN_KEY_ID);
  assert.equal(key.actorId, HUMAN_ID);
  assert.equal(key.keyId, HUMAN_KEY_ID);
  assert.equal(request.url.pathname, "/rest/v1/signing_keys");
  assert.equal(request.url.searchParams.get("actor_id"), `eq.${HUMAN_ID}`);
  assert.equal(request.url.searchParams.get("key_id"), `eq.${HUMAN_KEY_ID}`);
  assert.equal(request.url.searchParams.get("revoked_at"), "is.null");
  assert.equal(request.url.searchParams.get("deleted_at"), "is.null");
  assert.equal(request.url.searchParams.get("select"), "key_id,actor_id,algorithm,public_key,revoked_at,deleted_at");
  assert.equal(request.options.headers.apikey, "sb_secret_test");
  assert.equal(Object.hasOwn(request.options.headers, "authorization"), false);
});

test("verifies both signatures then performs exactly one research mutation RPC with the complete signed envelope", async () => {
  const envelope = signedEnvelope();
  const platformEvent = platformEventFor(envelope);
  const requests = [];
  const store = adapter({
    fetchImpl: async (url, options = {}) => {
      requests.push({ url: String(url), options });
      if (String(url).includes("/signing_keys")) return Response.json([signingKeyRow()]);
      return Response.json(receiptFor(envelope), { status: 201 });
    },
  });
  const result = await store.executeTypedResearchSubmit({
    agentActorId: AGENT_ID,
    signatureEnvelope: envelope,
    platformEvent,
  });
  assert.equal(result.receiptId, RECEIPT_ID);
  const mutations = requests.filter((request) => request.options.method === "POST");
  assert.equal(mutations.length, 1);
  assert.equal(mutations[0].url, "https://project.supabase.co/rest/v1/rpc/execute_typed_research_submit");
  const body = JSON.parse(mutations[0].options.body);
  assert.deepEqual(Object.keys(body).sort(), ["p_agent_actor_id", "p_platform_event", "p_signature_envelope"]);
  assert.equal(body.p_agent_actor_id, AGENT_ID);
  assert.deepEqual(body.p_signature_envelope.payload.incomingEdges, envelope.payload.incomingEdges);
  assert.equal(body.p_signature_envelope.payload.publisherActorId, HUMAN_ID);
  assert.equal(body.p_signature_envelope.signature.key_id, HUMAN_KEY_ID);
  assert.equal(body.p_signature_envelope.nonce, NONCE);
  assert.deepEqual(body.p_platform_event.payload.incoming_edges, envelope.payload.incomingEdges);
  assert.equal(requests.some((request) => /signature_nonces|claimSignatureNonce/.test(request.url)), false);
});

test("rejects hash, Human key/signature, publisher, edge, and platform signature tampering before the RPC", async (t) => {
  const cases = [
    {
      name: "envelope hash",
      change: ({ envelope }) => {
        const changed = { ...envelope, signing_bytes_hash: `sha256:${"0".repeat(64)}` };
        return { envelope: changed, event: platformEventFor(changed) };
      },
      code: "CLIENT_SIGNATURE_HASH_MISMATCH",
    },
    {
      name: "Human signature",
      change: ({ envelope }) => {
        const changed = { ...envelope, signature: { ...envelope.signature, value: "AAAA" } };
        return { envelope: changed, event: platformEventFor(changed) };
      },
      code: "CLIENT_SIGNATURE_MISMATCH",
    },
    {
      name: "Human key id",
      change: ({ envelope }) => {
        const changed = { ...envelope, signature: { ...envelope.signature, key_id: "missing-key" } };
        return { envelope: changed, event: platformEventFor(changed) };
      },
      code: "CLIENT_SIGNATURE_KEY_NOT_FOUND",
    },
    {
      name: "publisher attribution",
      change: ({ envelope, event }) => ({ envelope: { ...envelope, payload: { ...envelope.payload, publisherActorId: "actor-other" } }, event }),
      code: "TYPED_RESEARCH_ATTRIBUTION_INVALID",
    },
    {
      name: "edge set",
      change: ({ envelope, event }) => ({ envelope, event: { ...event, payload: { ...event.payload, incoming_edges: [] } } }),
      code: "TYPED_RESEARCH_PLATFORM_EVENT_MISMATCH",
    },
    {
      name: "platform hash",
      change: ({ envelope, event }) => ({ envelope, event: { ...event, hash: `sha256:${"0".repeat(64)}` } }),
      code: "TYPED_RESEARCH_PLATFORM_EVENT_HASH_MISMATCH",
    },
    {
      name: "platform signature",
      change: ({ envelope, event }) => ({ envelope, event: { ...event, signature: { ...event.signature, value: "AAAA" } } }),
      code: "TYPED_RESEARCH_PLATFORM_SIGNATURE_INVALID",
    },
  ];

  for (const entry of cases) await t.test(entry.name, async () => {
    const originalEnvelope = signedEnvelope();
    const originalEvent = platformEventFor(originalEnvelope);
    const { envelope, event } = entry.change({ envelope: originalEnvelope, event: originalEvent });
    let rpcCalls = 0;
    const store = adapter({
      fetchImpl: async (url) => {
        if (String(url).includes("/rpc/")) rpcCalls += 1;
        if (String(url).includes("/signing_keys")) {
          const requestedKey = new URL(url).searchParams.get("key_id");
          return Response.json(requestedKey?.includes(HUMAN_KEY_ID) ? [signingKeyRow()] : []);
        }
        return Response.json(receiptFor(originalEnvelope));
      },
    });
    await assert.rejects(
      store.executeTypedResearchSubmit({ agentActorId: AGENT_ID, signatureEnvelope: envelope, platformEvent: event }),
      (error) => error instanceof SupabaseTypedResearchSubmitError && error.code === entry.code,
    );
    assert.equal(rpcCalls, 0);
  });
});

test("maps database guards and PostgREST failures to stable public errors", async (t) => {
  const envelope = signedEnvelope();
  const platformEvent = platformEventFor(envelope);
  const cases = [
    ["[TYPED_RESEARCH_PAYLOAD_INVALID] malformed payload", "TYPED_RESEARCH_PAYLOAD_INVALID", 400, "P0001", 400],
    ["[TYPED_RESEARCH_PROJECT_ROLE_FORBIDDEN] contributor role required", "TYPED_RESEARCH_PROJECT_ROLE_FORBIDDEN", 403, "P0001", 400],
    ["[TYPED_RESEARCH_REPLAY_CONFLICT] nonce differs", "TYPED_RESEARCH_REPLAY_CONFLICT", 409, "P0001", 400],
    ["[TYPED_RESEARCH_MIGRATION_INCOMPLETE] install 0088", "TYPED_RESEARCH_MIGRATION_INCOMPLETE", 503, "P0001", 400],
    ["[RESEARCH_GRAPH_DUAL_WRITE_EVENT_CONFLICT] event id differs", "RESEARCH_GRAPH_DUAL_WRITE_EVENT_CONFLICT", 409, "P0001", 400],
    ["Could not find the function", "TYPED_RESEARCH_SUBMIT_UNAVAILABLE", 503, "PGRST202", 404],
    ["unknown P0001", "TYPED_RESEARCH_SUBMIT_REJECTED", 400, "P0001", 400],
  ];
  for (const [message, expectedCode, expectedStatus, databaseCode, responseStatus] of cases) await t.test(expectedCode, async () => {
    const store = adapter({
      fetchImpl: async (url) => String(url).includes("/signing_keys")
        ? Response.json([signingKeyRow()])
        : Response.json({ code: databaseCode, message }, { status: responseStatus }),
    });
    await assert.rejects(
      store.executeTypedResearchSubmit({ agentActorId: AGENT_ID, signatureEnvelope: envelope, platformEvent }),
      (error) => error.code === expectedCode && error.status === expectedStatus,
    );
  });
});

test("rejects malformed RPC receipts instead of treating partial persistence as success", async () => {
  const envelope = signedEnvelope();
  const store = adapter({
    fetchImpl: async (url) => String(url).includes("/signing_keys")
      ? Response.json([signingKeyRow()])
      : Response.json({ schema: "evimesh.typed-research-submit-result.v1", receiptId: RECEIPT_ID }),
  });
  await assert.rejects(
    store.executeTypedResearchSubmit({ agentActorId: AGENT_ID, signatureEnvelope: envelope, platformEvent: platformEventFor(envelope) }),
    (error) => error.code === "TYPED_RESEARCH_SUBMIT_INVALID_RESULT" && error.status === 502,
  );
});

test("hosted submitter derives the entire rank-free Event payload from the signed canonical document", async () => {
  const envelope = signedEnvelope();
  let eventFactoryInput;
  let rpcInput;
  const fakeAdapter = Object.freeze({
    ready: true,
    atomic: true,
    consumesNonceInTransaction: true,
    async executeTypedResearchSubmit(input) { rpcInput = input; return receiptFor(envelope); },
  });
  const submitter = createHostedTypedResearchSubmitter({
    adapter: fakeAdapter,
    platformEventFactory: async ({ eventType, payload }) => {
      eventFactoryInput = { eventType, payload };
      return platformEventFor(envelope);
    },
  });
  const result = await submitter.submit({
    kind: "answer",
    input: ANSWER_INPUT,
    agentActorId: AGENT_ID,
    publisherActorId: HUMAN_ID,
    signatureEnvelope: envelope,
  });
  assert.equal(result.receiptId, RECEIPT_ID);
  assert.equal(eventFactoryInput.eventType, "answer.created");
  assert.equal(eventFactoryInput.payload.actor_id, AGENT_ID);
  assert.equal(eventFactoryInput.payload.publisher_actor_id, HUMAN_ID);
  assert.equal(eventFactoryInput.payload.signing_key_id, HUMAN_KEY_ID);
  assert.equal(eventFactoryInput.payload.nonce, NONCE);
  assert.deepEqual(eventFactoryInput.payload.incoming_edges, envelope.payload.incomingEdges);
  assert.equal(Object.hasOwn(eventFactoryInput.payload, "commit_rank"), false);
  assert.equal(Object.hasOwn(eventFactoryInput.payload, "batch_rank"), false);
  assert.equal(rpcInput.agentActorId, AGENT_ID);
});

test("hosted Event payload derivation preserves the exact signed motif for all five kinds and revision 2", () => {
  const cases = [
    ["answer", ANSWER_INPUT, "answerId"],
    ["answer", { ...ANSWER_INPUT, revision: 2, supersedesRevision: 1, synthesis: "A second immutable revision." }, "answerId"],
    ["rebuttal", {
      rebuttalId: "rebuttal-1", projectId: "project-1", revision: 1, supersedesRevision: null, state: "published",
      title: "A bounded rebuttal", argument: "The original inference exceeds the evidence.", scope: ["External validity"],
      targetRef: { kind: "claim", id: "claim-1", revision: 1 },
      basisRefs: [{ kind: "evidence", id: "evidence-1", revision: 1 }],
    }, "rebuttalId"],
    ["evaluation", {
      evaluationId: "evaluation-1", projectId: "project-1", revision: 1, supersedesRevision: null, state: "published",
      subjectRef: { kind: "claim", id: "claim-1", revision: 1 },
      basisRefs: [{ kind: "evidence", id: "evidence-1", revision: 1 }],
      stance: "qualifies", rationale: "The evidence supports a narrower claim.", method: "Independent review",
    }, "evaluationId"],
    ["dataset", {
      datasetId: "dataset-2", projectId: "project-1", revision: 1, supersedesRevision: null, state: "published",
      name: "Open observations", description: "Versioned observations.", version: "1.0.0", license: "CC-BY-4.0",
      schemaUri: "https://example.test/schema.json", provenance: "Deposited by the authors.",
      artifactRef: { kind: "artifact", id: "artifact-1", revision: 1 },
    }, "datasetId"],
    ["tool", {
      toolId: "tool-1", projectId: "project-1", revision: 1, supersedesRevision: null, state: "published",
      name: "Reproduction workflow", description: "Pinned executable workflow.", toolKind: "workflow", version: "1.0.0",
      runtime: "OCI", inputSchemaUri: null, outputSchemaUri: null, license: "Apache-2.0", provenance: "Source release 1.0.0.",
      artifactRef: { kind: "artifact", id: "artifact-2", revision: 1 },
    }, "toolId"],
  ];
  for (const [kind, input, idField] of cases) {
    const envelope = signedEnvelope({ kind, input, nonce: `${NONCE}-${kind}-${input.revision}` });
    const built = buildHostedTypedResearchEventPayload({
      kind,
      input,
      agentActorId: AGENT_ID,
      publisherActorId: HUMAN_ID,
      signatureEnvelope: envelope,
    });
    assert.equal(built.eventPayload.entity_type, kind);
    assert.equal(built.eventPayload.entity_id, input[idField]);
    assert.equal(built.eventPayload.revision, input.revision);
    assert.deepEqual(built.eventPayload.incoming_edges, envelope.payload.incomingEdges);
    assert.deepEqual(built.eventPayload.typed_document, envelope.payload.node);
    assert.equal(Object.hasOwn(built.eventPayload, "commit_rank"), false);
    if (input.revision === 2) assert.equal(built.eventPayload.incoming_edges[0].type, "supersedes");
  }
});

test("hosted submitter refuses a non-canonical signature envelope and missing event signer", async () => {
  const envelope = signedEnvelope();
  const fakeAdapter = Object.freeze({ ready: true, atomic: true, consumesNonceInTransaction: true, executeTypedResearchSubmit: async () => ({}) });
  const unavailable = createHostedTypedResearchSubmitter({ adapter: fakeAdapter });
  assert.equal(unavailable.ready, false);
  await assert.rejects(unavailable.submit({}), (error) => error.code === "TYPED_RESEARCH_SUBMIT_UNAVAILABLE");

  const submitter = createHostedTypedResearchSubmitter({ adapter: fakeAdapter, platformEventFactory: async () => ({}) });
  await assert.rejects(
    submitter.submit({
      kind: "answer",
      input: { ...ANSWER_INPUT, title: "Changed after signing" },
      agentActorId: AGENT_ID,
      publisherActorId: HUMAN_ID,
      signatureEnvelope: envelope,
    }),
    (error) => error.code === "CLIENT_SIGNATURE_PAYLOAD_MISMATCH",
  );
});
