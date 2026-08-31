import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/index.mjs";
import { canonicalJson, rawHash } from "../../../packages/protocol/src/hash.mjs";
import { generateEd25519KeyPair } from "../../../packages/signatures/src/ed25519.mjs";
import { signEd25519Payload } from "../../../packages/signatures/src/client-signature.mjs";

const KERNEL_CUTOVER = { researchGraphRollout: { writeMode: "kernel", cutoverReady: true } };

async function envelope({ eventType, payload, nonce, keyId, privateKey }) {
  const signingBytes = canonicalJson({ event_type: eventType, payload, nonce });
  return {
    schema: "srp.client-signature-envelope.v1",
    event_type: eventType,
    payload,
    nonce,
    signing_bytes_hash: `sha256:${rawHash(signingBytes)}`,
    signature: { algorithm: "Ed25519", key_id: keyId, value: await signEd25519Payload({ signingBytes: new TextEncoder().encode(signingBytes), privateKey }) },
  };
}

function repositoryFor(keyPair, keyId) {
  const persisted = { events: [], nodes: [], revisions: [], typed: [], edges: [] };
  const repository = {
    persisted,
    findIdentity: async () => ({ actorId: "human-1" }),
    getActor: async (actorId) => ({ actorId, actorType: "human" }),
    findActiveSigningKey: async () => ({ keyId, actorId: "human-1", algorithm: "Ed25519", publicKey: keyPair.public_key }),
    claimSignatureNonce: async () => true,
    withTransaction: async (callback) => callback(repository),
    allocateResearchCommitRank: async () => 10,
    getResearchNode: async () => null,
    getResearchNodeRevision: async (ref) => ref.kind === "answer" && ref.id === "answer-1" ? null : ({ commitRank: 2, batchRank: 1 }),
    insertResearchNode: async (value) => { persisted.nodes.push(value); return value; },
    insertResearchNodeRevision: async (value) => { persisted.revisions.push(value); return value; },
    insertResearchEdge: async (value) => { persisted.edges.push(value); return value; },
    insertAnswerRevision: async (value) => { persisted.typed.push(value); return value; },
    appendResearchEvent: async (value) => { persisted.events.push(value); return value; },
  };
  return repository;
}

test("prepare and submit require a human external signature and preserve agent attribution", async () => {
  const keyPair = await generateEd25519KeyPair();
  const keyId = "human-key";
  const repository = repositoryFor(keyPair, keyId);
  const app = createApp({
    ...KERNEL_CUTOVER,
    repository,
    authenticate: async () => ({ sub: "human-subject" }),
    typedResearchRoleResolver: async () => "contributor",
    typedResearchEventFactory: async ({ eventType, payload }) => ({ eventId: "event-answer-1", eventType, payload }),
  });
  const input = {
    answerId: "answer-1", projectId: "project-1", state: "draft", draftedByActorId: "agent-1",
    title: "Synthesis", synthesis: "A bounded synthesis.", limitations: [],
    questionRef: { kind: "question", id: "question-1", revision: 2 }, additionalInputs: [],
    nonce: "0123456789abcdef",
  };
  const prepare = await app.fetch(new Request("https://api.example.test/answers/prepare", { method: "POST", headers: { authorization: "Bearer token", "content-type": "application/json" }, body: JSON.stringify(input) }), {});
  assert.equal(prepare.status, 200, await prepare.clone().text());
  const prepared = await prepare.json();
  assert.equal(prepared.payload.incomingEdges[0].type, "answers");
  const signatureEnvelope = await envelope({ eventType: prepared.eventType, payload: prepared.payload, nonce: prepared.nonce, keyId, privateKey: keyPair.private_key });
  const submitBody = { ...input, nonce: undefined, signatureEnvelope };
  const submit = await app.fetch(new Request("https://api.example.test/answers", { method: "POST", headers: { authorization: "Bearer token", "content-type": "application/json" }, body: JSON.stringify(submitBody) }), {});
  assert.equal(submit.status, 201, await submit.clone().text());
  const created = await submit.json();
  assert.equal(created.node.nodeKind, "answer");
  assert.equal(repository.persisted.edges[0].edgeType, "answers");
  assert.equal(repository.persisted.events[0].payload.signer_actor_id, "human-1");
  assert.equal(repository.persisted.events[0].payload.drafted_by_actor_id, "agent-1");
  assert.equal(repository.persisted.events[0].payload.publisher_signature_envelope.signature.key_id, keyId);
});

test("revision 2 signature binds the exact supersession lineage and rejects a genesis-body replay", async () => {
  const keyPair = await generateEd25519KeyPair();
  const keyId = "human-key";
  const repository = repositoryFor(keyPair, keyId);
  const app = createApp({
    ...KERNEL_CUTOVER,
    repository,
    authenticate: async () => ({ sub: "human-subject" }),
    typedResearchRoleResolver: async () => "contributor",
    typedResearchEventFactory: async ({ eventType, payload }) => ({ eventId: "event-answer-2", eventType, payload }),
  });
  const input = {
    answerId: "answer-1", projectId: "project-1", revision: 2, supersedesRevision: 1,
    state: "draft", title: "Revised synthesis", synthesis: "A bounded revision.", limitations: [],
    questionRef: { kind: "question", id: "question-1", revision: 2 }, additionalInputs: [],
    nonce: "0123456789abcdef",
  };
  const preparedResponse = await app.fetch(new Request("https://api.example.test/answers/prepare", {
    method: "POST", headers: { authorization: "Bearer token", "content-type": "application/json" }, body: JSON.stringify(input),
  }), {});
  assert.equal(preparedResponse.status, 200, await preparedResponse.clone().text());
  const prepared = await preparedResponse.json();
  assert.equal(prepared.eventType, "answer.revised");
  assert.equal(prepared.payload.node.revision, 2);
  assert.equal(prepared.payload.node.supersedesRevision, 1);
  assert.deepEqual(prepared.payload.incomingEdges[0], {
    type: "supersedes",
    source: { kind: "answer", id: "answer-1", revision: 1 },
    target: { kind: "answer", id: "answer-1", revision: 2 },
  });
  const signatureEnvelope = await envelope({ eventType: prepared.eventType, payload: prepared.payload, nonce: prepared.nonce, keyId, privateKey: keyPair.private_key });
  const response = await app.fetch(new Request("https://api.example.test/answers", {
    method: "POST", headers: { authorization: "Bearer token", "content-type": "application/json" },
    body: JSON.stringify({ ...input, revision: 1, supersedesRevision: null, nonce: undefined, signatureEnvelope }),
  }), {});
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "CLIENT_SIGNATURE_EVENT_TYPE_MISMATCH");
  assert.equal(repository.persisted.nodes.length, 0);
});

test("confirm true cannot replace a human signature envelope", async () => {
  const keyPair = await generateEd25519KeyPair();
  const repository = repositoryFor(keyPair, "human-key");
  const app = createApp({
    ...KERNEL_CUTOVER,
    repository,
    authenticate: async () => ({ sub: "human-subject" }),
    typedResearchRoleResolver: async () => "contributor",
    typedResearchEventFactory: async ({ eventType, payload }) => ({ eventId: "event-1", eventType, payload }),
  });
  const response = await app.fetch(new Request("https://api.example.test/answers", {
    method: "POST", headers: { authorization: "Bearer token", "content-type": "application/json" },
    body: JSON.stringify({ answerId: "answer-1", projectId: "project-1", title: "a", synthesis: "s", limitations: [], questionRef: { kind: "question", id: "question-1", revision: 1 }, additionalInputs: [], confirm: true }),
  }), {});
  assert.equal(response.status, 400);
  assert.equal((await response.json()).code, "RESEARCH_PUBLISHER_SIGNATURE_REQUIRED");
  assert.equal(repository.persisted.nodes.length, 0);
});

test("an authenticated Agent can prepare and relay but the envelope signer remains human", async () => {
  const keyPair = await generateEd25519KeyPair();
  const keyId = "human-key";
  const repository = repositoryFor(keyPair, keyId);
  repository.findIdentity = async () => ({ actorId: "agent-1" });
  repository.getActor = async (actorId) => ({ actorId, actorType: actorId === "human-1" ? "human" : "agent" });
  const app = createApp({
    ...KERNEL_CUTOVER,
    repository,
    authenticate: async () => ({ sub: "agent-subject" }),
    typedResearchRoleResolver: async () => "contributor",
    typedResearchEventFactory: async ({ eventType, payload }) => ({ eventId: "event-agent-answer", eventType, payload }),
  });
  const input = {
    answerId: "answer-1", projectId: "project-1", title: "Agent synthesis", synthesis: "Prepared by an attributed agent.",
    questionRef: { kind: "question", id: "question-1", revision: 1 }, additionalInputs: [], limitations: [],
    publisherActorId: "human-1", draftedByActorId: "forged-drafter", nonce: "0123456789abcdef",
  };
  const prepare = await app.fetch(new Request("https://api.example.test/answers/prepare", { method: "POST", headers: { authorization: "Bearer agent-token", "content-type": "application/json" }, body: JSON.stringify(input) }), {});
  assert.equal(prepare.status, 200, await prepare.clone().text());
  const prepared = await prepare.json();
  assert.equal(prepared.payload.publisherActorId, "human-1");
  assert.equal(prepared.payload.draftedByActorId, "agent-1", "server binds the authenticated Agent, not a client-supplied drafter");
  const signatureEnvelope = await envelope({ eventType: prepared.eventType, payload: prepared.payload, nonce: prepared.nonce, keyId, privateKey: keyPair.private_key });
  const submit = await app.fetch(new Request("https://api.example.test/answers", { method: "POST", headers: { authorization: "Bearer agent-token", "content-type": "application/json" }, body: JSON.stringify({ ...input, draftedByActorId: "agent-1", nonce: undefined, signatureEnvelope }) }), {});
  assert.equal(submit.status, 201, await submit.clone().text());
  assert.equal(repository.persisted.events[0].payload.signer_actor_id, "human-1");
  assert.equal(repository.persisted.events[0].payload.drafted_by_actor_id, "agent-1");
});

test("agents cannot become typed research publishers", async () => {
  const keyPair = await generateEd25519KeyPair();
  const repository = repositoryFor(keyPair, "agent-key");
  repository.getActor = async (actorId) => ({ actorId, actorType: "agent" });
  const app = createApp({ repository, authenticate: async () => ({ sub: "agent-subject" }) });
  const response = await app.fetch(new Request("https://api.example.test/tools/prepare", { method: "POST", headers: { authorization: "Bearer token", "content-type": "application/json" }, body: JSON.stringify({ publisherActorId: "agent-publisher", nonce: "0123456789abcdef" }) }), {});
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "RESEARCH_PUBLISHER_TYPE_INVALID");
});
