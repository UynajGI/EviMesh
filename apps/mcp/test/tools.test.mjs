import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { callTool, writeToolNames, MAX_EVIDENCE_BYTES } from "../src/tools.mjs";
import { createFakeClient } from "./helpers.mjs";

function answerDocument() {
  return {
    schema: "srp.answer.v1",
    answer_id: "answer_018f0f4a-5c00-4000-8000-000000000001",
    project_id: "project_018f0f4a-5c00-4000-8000-000000000001",
    revision: 1,
    supersedes_revision: null,
    state: "draft",
    title: "A reproducible synthesis",
    synthesis: "The observed effect follows under the declared assumptions.",
    limitations: [],
    question_ref: { kind: "question", id: "question_018f0f4a-5c00-4000-8000-000000000001", revision: 1 },
    additional_inputs: [],
    created_at: "2026-08-30T06:00:00.000Z",
    created_by: "agent_01",
  };
}

function claimDocument() {
  return {
    schema: "srp.claim.v1",
    claim_id: "claim_018f0f4a-5c00-4000-8000-000000000001",
    revision: 1,
    state: "hypothesis",
    statement: "A falsifiable statement.",
    scope: ["Declared scope"],
    assumptions: [],
    falsification: ["A contradicting observation"],
    created_at: "2026-08-06T00:00:00.000Z",
    created_by: "agent_01",
  };
}

function challengeDocument() {
  return {
    schema: "srp.challenge.v1",
    challenge_id: "challenge_018f0f4a-5c00-4000-8000-000000000001",
    revision: 1,
    state: "open",
    target_claim_revision_id: "claim-1@2",
    reason: "The method omits a required control.",
    impact: { type: "method", severity: "major", summary: "Missing control" },
    created_at: "2026-08-06T00:00:00.000Z",
    created_by: "agent_01",
  };
}

function verificationDocument() {
  return {
    schema: "srp.verification-receipt.v1",
    claim_revision_id: "claim-1@2",
    contract_revision_id: "contract-1@1",
    outcome: "supports",
    verification_types: ["reproduction"],
    context_mode: "blind",
    saw_expected_outputs: false,
    implementation_relation: "independent",
    data_relation: "same_input",
    model_family: "none",
    findings: [],
  };
}

function externalEnvelope(prepared) {
  return {
    schema: "srp.client-signature-envelope.v1",
    event_type: prepared.eventType,
    payload: prepared.payload,
    nonce: prepared.nonce,
    signing_bytes_hash: prepared.signingBytesHash,
    signature: { algorithm: "Ed25519", key_id: "human-key", value: "external-signature" },
  };
}

test("write tools refuse without consent and summarize the planned action", async () => {
  const result = await callTool({ client: createFakeClient(), name: "start_attempt", args: { taskId: "task-1", mode: "blind" } });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.error, "consent_required");
  assert.equal(result.structuredContent.tool, "start_attempt");
  assert.equal(result.structuredContent.summary.taskId, "task-1");
});

test("formal mutation tools without a signed server flow fail closed after consent", async () => {
  const networkCalls = [];
  const client = createFakeClient({
    tasks: { context: async (...args) => { networkCalls.push(["context", ...args]); } },
    attempts: {
      start: async (...args) => { networkCalls.push(["start", ...args]); },
      recordTrace: async (...args) => { networkCalls.push(["trace", ...args]); },
    },
    artifacts: {
      uploadPlan: async (...args) => { networkCalls.push(["plan", ...args]); },
      upload: async (...args) => { networkCalls.push(["upload", ...args]); },
    },
    evidence: { create: async (...args) => { networkCalls.push(["evidence", ...args]); } },
  });
  const calls = [
    ["start_attempt", { taskId: "task-1", confirm: true }],
    ["record_trace", { attemptId: "attempt-1", eventType: "attempt.progress", payload: {}, confirm: true }],
    ["attach_evidence", { contentBase64: Buffer.from("data").toString("base64"), mediaType: "text/plain", confirm: true }],
    ["record_run", { taskId: "task_0193f2c8-5c00-4000-8000-000000000001", contextBundleId: "context-1", sourceCode: "git:abc123", container: `oci:python@sha256:${"a".repeat(64)}`, command: "python", environment: { runtime: "python" }, hardware: { cpu: "x86_64" }, confirm: true }],
  ];
  for (const [name, args] of calls) {
    const result = await callTool({ client, name, args });
    assert.equal(result.isError, true, name);
    assert.equal(result.structuredContent.error, "MCP_SIGNED_MUTATION_UNAVAILABLE", name);
  }
  assert.deepEqual(networkCalls, []);
});

test("all externally submitted MCP research mutations reject confirm without an envelope", async () => {
  const calls = [
    ["publish_submission", { document: claimDocument(), confirm: true }],
    ["submit_verification", { document: verificationDocument(), runId: "run-1", confirm: true }],
    ["submit_challenge", { document: challengeDocument(), confirm: true }],
    ["submit_typed_research_submission", { kind: "answer", document: answerDocument(), confirm: true }],
  ];
  for (const [name, args] of calls) {
    const result = await callTool({ client: createFakeClient(), name, args });
    assert.equal(result.isError, true, name);
    assert.equal(result.structuredContent.error, "RESEARCH_PUBLISHER_SIGNATURE_REQUIRED", name);
  }
  assert.deepEqual(new Set(writeToolNames()), new Set([
    "submit_typed_research_submission", "start_attempt", "record_trace", "create_claim",
    "attach_evidence", "record_run", "publish_submission", "submit_verification", "submit_challenge",
  ]));
});

test("create_claim is a local attributed draft and never reads a signing identity", async () => {
  const networkCalls = [];
  const client = createFakeClient({ http: { request: async (method, path) => {
    networkCalls.push({ method, path });
    return { actorId: "agent_01", actorType: "agent" };
  } } });
  const result = await callTool({ client, name: "create_claim", args: { statement: "s", scope: ["s"], falsification: ["f"], confirm: true }, env: {} });
  assert.equal(result.isError, false);
  assert.equal(result.structuredContent.draft.created_by, "agent_01");
  assert.deepEqual(networkCalls, [{ method: "GET", path: "/auth/me" }]);
});

test("search_open_tasks passes filters through", async () => {
  const seen = [];
  const client = createFakeClient({ tasks: { list: async (params) => { seen.push(params); return { items: [{ taskId: "task-1" }], nextCursor: null }; } } });
  const result = await callTool({ client, name: "search_open_tasks", args: { tag: "cpu-only", limit: 5 } });
  assert.equal(result.isError, false);
  assert.equal(seen[0].tag, "cpu-only");
  assert.equal(result.structuredContent.tasks.length, 1);
});

test("inspect_research_neighborhood passes bounded graph filters through", async () => {
  const seen = [];
  const client = createFakeClient({ researchGraph: { neighborhood: async (kind, id, options) => { seen.push({ kind, id, options }); return { schemaVersion: "research-neighborhood.v1", nodes: [], edges: [], truncated: false }; } } });
  const result = await callTool({ client, name: "inspect_research_neighborhood", args: { kind: "question", id: "question-1", revision: 2, direction: "downstream", depth: 3, kinds: ["question", "answer"], edgeTypes: ["answers"] } });
  assert.equal(result.isError, false);
  assert.deepEqual(seen[0], { kind: "question", id: "question-1", options: { revision: 2, direction: "downstream", depth: 3, kinds: ["question", "answer"], edgeTypes: ["answers"], cursor: undefined } });
});

test("typed MCP draft and prepare pass revision lineage without accessing signer material", async () => {
  const seen = [];
  const client = createFakeClient({ answers: {
    prepare: async (input) => { seen.push(input); return { eventType: "answer.revised", payload: input, nonce: input.nonce, signingBytesHash: `sha256:${"a".repeat(64)}` }; },
  } });
  const document = { ...answerDocument(), revision: 2, supersedes_revision: 1 };
  const draft = await callTool({ client, name: "draft_typed_research_node", args: { kind: "answer", document }, env: {} });
  assert.equal(draft.isError, false);
  const prepared = await callTool({ client, name: "prepare_typed_research_submission", args: { kind: "answer", document, publisherActorId: "human_01", nonce: "0123456789abcdef" }, env: {} });
  assert.equal(prepared.isError, false);
  assert.equal(seen[0].revision, 2);
  assert.equal(seen[0].supersedesRevision, 1);
  assert.equal(seen[0].publisherActorId, "human_01");
});

test("typed MCP submit relays only an externally supplied envelope", async () => {
  const submits = [];
  const client = createFakeClient({ answers: { submit: async (input) => { submits.push(input); return { node: { nodeKind: "answer" } }; } } });
  const signatureEnvelope = { schema: "srp.client-signature-envelope.v1", event_type: "answer.created", payload: {}, nonce: "0123456789abcdef", signing_bytes_hash: `sha256:${"b".repeat(64)}`, signature: { algorithm: "Ed25519", key_id: "human-key", value: "external-signature" } };
  const gated = await callTool({ client, name: "submit_typed_research_submission", args: { kind: "answer", document: answerDocument(), signatureEnvelope } });
  assert.equal(gated.structuredContent.error, "consent_required");
  const submitted = await callTool({ client, name: "submit_typed_research_submission", args: { kind: "answer", document: answerDocument(), signatureEnvelope, confirm: true } });
  assert.equal(submitted.isError, false);
  assert.equal(submits[0].signatureEnvelope.signature.key_id, "human-key");
});

test("legacy prepare returns exact canonical bytes and publish only relays the matching envelope", async () => {
  const requests = [];
  const client = createFakeClient({ http: { request: async (method, path, { body } = {}) => { requests.push({ method, path, body }); return { ok: true }; } } });
  const preparedResult = await callTool({ client, name: "prepare_submission", args: { document: claimDocument(), nonce: "0123456789abcdef" } });
  assert.equal(preparedResult.isError, false);
  const prepared = preparedResult.structuredContent.prepared;
  assert.equal(prepared.route, "/claims");
  assert.equal(prepared.eventType, "claim.created");
  const signatureEnvelope = externalEnvelope(prepared);
  const gated = await callTool({ client, name: "publish_submission", args: { document: claimDocument(), signatureEnvelope } });
  assert.equal(gated.structuredContent.error, "consent_required");
  const published = await callTool({ client, name: "publish_submission", args: { document: claimDocument(), signatureEnvelope, confirm: true } });
  assert.equal(published.isError, false, JSON.stringify(published.structuredContent));
  assert.equal(requests.length, 1);
  assert.equal(requests[0].path, "/claims");
  assert.equal(requests[0].body.signatureEnvelope, signatureEnvelope);
  const tampered = await callTool({ client, name: "publish_submission", args: { document: { ...claimDocument(), statement: "tampered" }, signatureEnvelope, confirm: true } });
  assert.equal(tampered.structuredContent.error, "CLIENT_SIGNATURE_PAYLOAD_MISMATCH");
  assert.equal(requests.length, 1);
});

test("verification prepare and submit preserve the exact externally signed identifiers", async () => {
  const submissions = [];
  const client = createFakeClient({ verifications: { submit: async (input) => { submissions.push(input); return { receipt: { receiptId: input.receiptId } }; } } });
  const preparedResult = await callTool({ client, name: "prepare_submission", args: { document: verificationDocument(), runId: "run-1", nonce: "0123456789abcdef" } });
  const prepared = preparedResult.structuredContent.prepared;
  const signatureEnvelope = externalEnvelope(prepared);
  const result = await callTool({ client, name: "submit_verification", args: { document: verificationDocument(), runId: "run-1", signatureEnvelope, confirm: true } });
  assert.equal(result.isError, false, JSON.stringify(result.structuredContent));
  assert.equal(result.structuredContent.receiptId, prepared.payload.receiptId);
  assert.equal(submissions[0].contributionStatementId, prepared.payload.contributionStatementId);
  assert.equal(submissions[0].signatureEnvelope, signatureEnvelope);
});

test("challenge submit relays a matching external envelope", async () => {
  const submissions = [];
  const client = createFakeClient({ challenges: { create: async (input) => { submissions.push(input); return { challenge: { challengeId: input.challengeId } }; } } });
  const preparedResult = await callTool({ client, name: "prepare_submission", args: { document: challengeDocument(), nonce: "0123456789abcdef" } });
  const signatureEnvelope = externalEnvelope(preparedResult.structuredContent.prepared);
  const result = await callTool({ client, name: "submit_challenge", args: { document: challengeDocument(), signatureEnvelope, confirm: true } });
  assert.equal(result.isError, false);
  assert.equal(submissions[0].signatureEnvelope, signatureEnvelope);
});

test("MCP signer implementation contains no local identity or signing primitive", () => {
  const source = readFileSync(new URL("../src/tools.mjs", import.meta.url), "utf8");
  for (const forbidden of ["privateKey", "loadIdentity", "signSubmission", "signEd25519"]) assert.equal(source.includes(forbidden), false, forbidden);
});

test("attach_evidence rejects invalid base64 and oversized content before its fail-closed boundary", async () => {
  const invalid = await callTool({ client: createFakeClient(), name: "attach_evidence", args: { contentBase64: "not base64!", mediaType: "text/plain" } });
  assert.equal(invalid.isError, true);
  assert.match(invalid.structuredContent.message, /valid base64/);
  const big = Buffer.alloc(MAX_EVIDENCE_BYTES + 1).toString("base64");
  const oversized = await callTool({ client: createFakeClient(), name: "attach_evidence", args: { contentBase64: big, mediaType: "application/octet-stream" } });
  assert.equal(oversized.isError, true);
  assert.match(oversized.structuredContent.message, /exceeds/);
});

test("validate_submission returns structured findings", async () => {
  const valid = await callTool({ client: createFakeClient(), name: "validate_submission", args: { document: claimDocument() } });
  assert.equal(valid.structuredContent.valid, true);
  const invalid = await callTool({ client: createFakeClient(), name: "validate_submission", args: { document: { schema: "srp.claim.v1", claim_id: "nope" } } });
  assert.equal(invalid.structuredContent.valid, false);
  assert.ok(invalid.structuredContent.findings.length > 0);
});

test("get_task_context returns the immutable bundle and hash", async () => {
  const result = await callTool({ client: createFakeClient(), name: "get_task_context", args: { taskId: "task-1", mode: "frontier" } });
  assert.equal(result.isError, false);
  assert.equal(result.structuredContent.contextBundleId, "context-task-1");
  assert.match(result.structuredContent.contentHash, /^sha256:[0-9a-f]{64}$/);
});

test("verify_inclusion_proof validates proofs and binds events", async () => {
  const { buildMerkleTree } = await import("../../../packages/merkle/src/merkle-tree.mjs");
  const { hashResearchEventLeaf } = await import("../../../packages/merkle/src/research-event-leaf.mjs");
  const { createMerkleInclusionProof } = await import("../../../packages/merkle/src/inclusion-proof.mjs");
  const events = ["event-1", "event-2"].map((eventId, index) => ({ schema: "srp.event.v1", event_id: eventId, event_type: "claim.created", payload: { claim_id: "claim-1" }, hash: `sha256:${String(index).repeat(64)}`, signature: { algorithm: "Ed25519", value: "sig" }, parents: [] }));
  const leafHashes = events.map((event) => hashResearchEventLeaf(event));
  const proof = createMerkleInclusionProof({ leafHashes, leafIndex: 1 });
  assert.equal(buildMerkleTree(leafHashes).root, proof.root);
  const good = await callTool({ client: createFakeClient(), name: "verify_inclusion_proof", args: { proof, event: events[1] } });
  assert.deepEqual(good.structuredContent, { valid: true, reason: null });
  const mismatch = await callTool({ client: createFakeClient(), name: "verify_inclusion_proof", args: { proof, event: events[0] } });
  assert.equal(mismatch.structuredContent.valid, false);
});

test("inspect_provenance remains read-only", async () => {
  const result = await callTool({ client: createFakeClient(), name: "inspect_provenance", args: { objectType: "claim", objectId: "claim-1", revision: 2 } });
  assert.equal(result.isError, false);
  assert.equal(result.structuredContent.provenance.object.revision, 2);
});
