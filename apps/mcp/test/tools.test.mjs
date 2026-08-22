import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { callTool } from "../src/tools.mjs";
import { createFakeClient } from "./helpers.mjs";

function identityEnv(t) {
  const dir = mkdtempSync(join(tmpdir(), "evimesh-mcp-"));
  t.after(() => {});
  return { ...process.env, EVIMESH_CONFIG_DIR: dir };
}

test("write tools refuse without consent and summarize the planned action", async () => {
  const client = createFakeClient();
  const result = await callTool({ client, name: "start_attempt", args: { taskId: "task-1", mode: "blind" } });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.error, "consent_required");
  assert.equal(result.structuredContent.tool, "start_attempt");
  assert.equal(result.structuredContent.summary.taskId, "task-1");
});

test("every write tool enforces the consent gate", async () => {
  const client = createFakeClient();
  const writeCalls = {
    start_attempt: { taskId: "task-1" },
    record_trace: { attemptId: "attempt-1", eventType: "attempt.progress", payload: {} },
    create_claim: { statement: "s", scope: ["s"], falsification: ["f"] },
    attach_evidence: { contentBase64: Buffer.from("data").toString("base64"), mediaType: "text/plain" },
    record_run: { taskId: "task_0193f2c8-5c00-4000-8000-000000000001", contextBundleId: "context-1", sourceCode: "git:abc123", container: `oci:python@sha256:${"a".repeat(64)}`, command: "python", environment: { runtime: "python" }, hardware: { cpu: "x86_64" } },
    publish_submission: { document: { schema: "srp.claim.v1", claim_id: "claim_018f0f4a-5c00-4000-8000-000000000001", revision: 1, state: "hypothesis", statement: "s", scope: ["s"], assumptions: [], falsification: ["f"], created_at: "2026-08-06T00:00:00.000Z", created_by: "actor_01" } },
    submit_verification: { document: { schema: "srp.verification-receipt.v1", claim_revision_id: "claim-1@2", contract_revision_id: "contract-1@1", outcome: "supports", verification_types: ["reproduction"], context_mode: "blind", saw_expected_outputs: false, implementation_relation: "independent", data_relation: "same_input", model_family: "none", findings: [] }, runId: "run-1" },
    submit_challenge: { document: { schema: "srp.challenge.v1", challenge_id: "challenge_018f0f4a-5c00-4000-8000-000000000001", revision: 1, state: "open", target_claim_revision_id: "claim-1@2", reason: "r", impact: { type: "method", severity: "major", summary: "s" }, created_at: "2026-08-06T00:00:00.000Z", created_by: "actor_01" } },
  };
  for (const [name, args] of Object.entries(writeCalls)) {
    const result = await callTool({ client, name, args });
    assert.equal(result.isError, true, `${name} must require consent`);
    assert.equal(result.structuredContent.error, "consent_required", `${name} must return consent_required`);
  }
});

test("start_attempt executes with consent", async () => {
  const client = createFakeClient();
  const result = await callTool({ client, name: "start_attempt", args: { taskId: "task-1", mode: "blind", confirm: true } });
  assert.equal(result.isError, false);
  assert.equal(result.structuredContent.taskId, "task-1");
  assert.equal(result.structuredContent.contextBundleId, "context-task-1");
  assert.ok(result.structuredContent.attemptId.startsWith("attempt_"));
});

test("search_open_tasks passes filters through", async () => {
  const seen = [];
  const client = createFakeClient({
    tasks: { list: async (params) => { seen.push(params); return { items: [{ taskId: "task-1" }], nextCursor: null }; } },
  });
  const result = await callTool({ client, name: "search_open_tasks", args: { tag: "cpu-only", limit: 5 } });
  assert.equal(result.isError, false);
  assert.equal(seen[0].tag, "cpu-only");
  assert.equal(seen[0].limit, 5);
  assert.equal(result.structuredContent.tasks.length, 1);
});

test("get_task_context returns the bundle and hash", async () => {
  const client = createFakeClient();
  const result = await callTool({ client, name: "get_task_context", args: { taskId: "task-1", mode: "frontier" } });
  assert.equal(result.isError, false);
  assert.equal(result.structuredContent.contextBundleId, "context-task-1");
  assert.match(result.structuredContent.contentHash, /^sha256:[0-9a-f]{64}$/);
});

test("create_claim and record_run bind drafts to the active signing identity without publishing", async (t) => {
  const env = identityEnv(t);
  const { generateIdentity } = await import("../../../packages/cli/src/identity.mjs");
  const identity = generateIdentity(env);
  const networkCalls = [];
  const client = createFakeClient({ http: { request: async (method, path) => { networkCalls.push({ method, path }); return path === "/auth/me" ? { actorId: "agent_01", actorType: "agent", signingKey: { keyId: identity.keyId, algorithm: identity.algorithm, publicKey: identity.publicKey } } : {}; } } });
  const claim = await callTool({ client, name: "create_claim", args: { statement: "s", scope: ["s"], falsification: ["f"], actorId: "human_01", confirm: true }, env });
  assert.equal(claim.isError, false);
  assert.equal(claim.structuredContent.draft.schema, "srp.claim.v1");
  assert.ok(claim.structuredContent.draft.claim_id.startsWith("claim_"));
  assert.equal(claim.structuredContent.draft.created_by, "agent_01");
  const run = await callTool({ client, name: "record_run", args: { taskId: "task_0193f2c8-5c00-4000-8000-000000000001", contextBundleId: "context-1", sourceCode: "git:abc123", container: `oci:python@sha256:${"a".repeat(64)}`, command: "python", environment: { runtime: "python" }, hardware: { cpu: "x86_64" }, inputArtifactRefs: ["artifact-z", "artifact-a@0002"], outputArtifactRefs: ["output-z", "output-a@2"], actorId: "human_01", signature: "forged", confirm: true }, env });
  assert.equal(run.isError, false);
  assert.equal(run.structuredContent.draft.schema, "srp.run.v1");
  assert.equal(run.structuredContent.draft.actor_id, "agent_01");
  assert.equal(run.structuredContent.draft.signing_key_id, identity.keyId);
  assert.deepEqual(run.structuredContent.draft.input_artifact_ids, ["artifact-a@2", "artifact-z@1"]);
  assert.deepEqual(run.structuredContent.draft.output_artifact_ids, ["output-a@2", "output-z@1"]);
  assert.notEqual(run.structuredContent.draft.signature, "forged");
  const { signature, ...unsignedRun } = run.structuredContent.draft;
  const { canonicalJson } = await import("../../../packages/protocol/src/hash.mjs");
  const { verifyEd25519Payload } = await import("../../../packages/signatures/src/server-verification.mjs");
  assert.equal(await verifyEd25519Payload({ signingBytes: new Uint8Array(Buffer.from(canonicalJson(unsignedRun), "utf8")), signature, publicKey: identity.publicKey }), true);
  assert.deepEqual(networkCalls, [{ method: "GET", path: "/auth/me" }, { method: "GET", path: "/auth/me" }], "draft tools may only resolve the authenticated actor");
});

test("record_run rejects a human authenticated actor", async (t) => {
  const env = identityEnv(t);
  const { generateIdentity } = await import("../../../packages/cli/src/identity.mjs");
  generateIdentity(env);
  const client = createFakeClient({ http: { request: async () => ({ actorId: "human_01", actorType: "human" }) } });
  const result = await callTool({ client, name: "record_run", args: { taskId: "task_0193f2c8-5c00-4000-8000-000000000001", contextBundleId: "context-1", sourceCode: "git:abc123", container: `oci:python@sha256:${"a".repeat(64)}`, command: "python", environment: { runtime: "python" }, hardware: { cpu: "x86_64" }, confirm: true }, env });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.error, "AGENT_ACTOR_REQUIRED");
});

test("record_run rejects a local signing key that is not registered to the active agent", async (t) => {
  const env = identityEnv(t);
  const { generateIdentity } = await import("../../../packages/cli/src/identity.mjs");
  const identity = generateIdentity(env);
  const client = createFakeClient({ http: { request: async () => ({ actorId: "agent_01", actorType: "agent", signingKey: { keyId: "key-other", algorithm: identity.algorithm, publicKey: identity.publicKey } }) } });
  const result = await callTool({ client, name: "record_run", args: { taskId: "task_0193f2c8-5c00-4000-8000-000000000001", contextBundleId: "context-1", sourceCode: "git:abc123", container: `oci:python@sha256:${"a".repeat(64)}`, command: "python", environment: { runtime: "python" }, hardware: { cpu: "x86_64" }, confirm: true }, env });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.error, "AGENT_SIGNING_KEY_MISMATCH");
});

test("record_run rejects malformed artifact refs before signing", async (t) => {
  const env = identityEnv(t);
  const { generateIdentity } = await import("../../../packages/cli/src/identity.mjs");
  const identity = generateIdentity(env);
  const client = createFakeClient({ http: { request: async () => ({ actorId: "agent_01", actorType: "agent", signingKey: { keyId: identity.keyId, algorithm: identity.algorithm, publicKey: identity.publicKey } }) } });
  for (const artifactRef of ["", "artifact@", "artifact@0", "artifact@1@2", " artifact@1"]) {
    const result = await callTool({ client, name: "record_run", args: { taskId: "task_0193f2c8-5c00-4000-8000-000000000001", contextBundleId: "context-1", sourceCode: "git:abc123", container: `oci:python@sha256:${"a".repeat(64)}`, command: "python", environment: { runtime: "python" }, hardware: { cpu: "x86_64" }, inputArtifactRefs: [artifactRef], confirm: true }, env });
    assert.equal(result.isError, true, artifactRef);
    assert.equal(result.structuredContent.error, "RUN_ARTIFACT_REF_INVALID", artifactRef);
  }
});

test("record_run rejects non-canonical signed text before signing", async (t) => {
  const env = identityEnv(t);
  const { generateIdentity } = await import("../../../packages/cli/src/identity.mjs");
  const identity = generateIdentity(env);
  const client = createFakeClient({ http: { request: async () => ({ actorId: "agent_01", actorType: "agent", signingKey: { keyId: identity.keyId, algorithm: identity.algorithm, publicKey: identity.publicKey } }) } });
  for (const [invalidText, expectedCode] of [
    [{ sourceCode: " git:abc123" }, "RUN_TEXT_INVALID"],
    [{ sourceCode: "" }, "MCP_TOOL_INVALID"],
    [{ command: "python " }, "RUN_TEXT_INVALID"],
    [{ command: " " }, "MCP_TOOL_INVALID"],
  ]) {
    const result = await callTool({ client, name: "record_run", args: { taskId: "task_0193f2c8-5c00-4000-8000-000000000001", contextBundleId: "context-1", sourceCode: "git:abc123", container: `oci:python@sha256:${"a".repeat(64)}`, command: "python", environment: { runtime: "python" }, hardware: { cpu: "x86_64" }, ...invalidText, confirm: true }, env });
    assert.equal(result.isError, true, JSON.stringify(invalidText));
    assert.equal(result.structuredContent.error, expectedCode, JSON.stringify(invalidText));
  }
});

test("record_run preserves its authenticated agent binding through publication", async (t) => {
  const env = identityEnv(t);
  const { generateIdentity } = await import("../../../packages/cli/src/identity.mjs");
  const identity = generateIdentity(env);
  const posts = [];
  const client = createFakeClient({ http: { request: async (method, path, { body } = {}) => {
    if (path === "/auth/me") return { actorId: "agent_01", actorType: "agent", signingKey: { keyId: identity.keyId, algorithm: identity.algorithm, publicKey: identity.publicKey } };
    posts.push({ method, path, body });
    return { ok: true };
  } } });
  const recorded = await callTool({ client, name: "record_run", args: { taskId: "task_0193f2c8-5c00-4000-8000-000000000001", contextBundleId: "context-1", sourceCode: "git:abc123", container: `oci:python@sha256:${"a".repeat(64)}`, command: "python", environment: { runtime: "python" }, hardware: { cpu: "x86_64" }, confirm: true }, env });
  const edited = {
    ...recorded.structuredContent.draft,
    source_code: "git:def456",
    input_artifact_ids: ["artifact-z", "artifact-a@0002"],
    output_artifact_ids: ["output-z", "output-a@2"],
    started_at: "2026-08-06T08:00:00+08:00",
    ended_at: "2026-08-06T00:00:00.1Z",
  };
  const published = await callTool({ client, name: "publish_submission", args: { document: edited, confirm: true }, env });
  assert.equal(published.isError, false, JSON.stringify(published.structuredContent));
  assert.equal(posts.length, 1);
  assert.equal(posts[0].path, "/runs");
  assert.equal(posts[0].body.actorId, "agent_01");
  assert.equal(posts[0].body.signingKeyId, identity.keyId);
  assert.equal(posts[0].body.signatureEnvelope.signature.key_id, identity.keyId);
  assert.equal(posts[0].body.sourceCode, "git:def456");
  assert.equal(posts[0].body.startedAt, "2026-08-06T00:00:00.000Z");
  assert.equal(posts[0].body.endedAt, "2026-08-06T00:00:00.100Z");
  assert.deepEqual(posts[0].body.inputs, [
    { artifactId: "artifact-a", artifactRevision: 2 },
    { artifactId: "artifact-z", artifactRevision: 1 },
  ]);
  assert.deepEqual(posts[0].body.outputs, [
    { artifactId: "output-a", artifactRevision: 2 },
    { artifactId: "output-z", artifactRevision: 1 },
  ]);
  assert.notEqual(posts[0].body.signature, recorded.structuredContent.draft.signature);
  const unsignedEdited = {
    ...edited,
    input_artifact_ids: ["artifact-a@2", "artifact-z@1"],
    output_artifact_ids: ["output-a@2", "output-z@1"],
    started_at: "2026-08-06T00:00:00.000Z",
    ended_at: "2026-08-06T00:00:00.100Z",
  };
  delete unsignedEdited.signature;
  const { canonicalJson } = await import("../../../packages/protocol/src/hash.mjs");
  const { verifyEd25519Payload } = await import("../../../packages/signatures/src/server-verification.mjs");
  assert.equal(await verifyEd25519Payload({ signingBytes: new Uint8Array(Buffer.from(canonicalJson(unsignedEdited), "utf8")), signature: posts[0].body.signature, publicKey: identity.publicKey }), true);
  assert.equal(posts[0].body.signatureEnvelope.payload.actorId, "agent_01");
  const malformed = await callTool({ client, name: "publish_submission", args: { document: { ...edited, input_artifact_ids: ["artifact@1@2"] }, confirm: true }, env });
  assert.equal(malformed.isError, true);
  assert.equal(malformed.structuredContent.error, "RUN_ARTIFACT_REF_INVALID");
  for (const startedAt of [null, 0, "2026-08-06", "2026-08-06T00:00:00", " 2026-08-06T00:00:00Z ", "2026-02-31T00:00:00Z"]) {
    const invalidTimestamp = await callTool({ client, name: "publish_submission", args: { document: { ...edited, started_at: startedAt }, confirm: true }, env });
    assert.equal(invalidTimestamp.isError, true, JSON.stringify(startedAt));
    assert.equal(invalidTimestamp.structuredContent.error, "RUN_TIMESTAMP_INVALID", JSON.stringify(startedAt));
  }
  for (const invalidText of [{ source_code: " git:def456" }, { command: "python " }, { command: " " }]) {
    const rejected = await callTool({ client, name: "publish_submission", args: { document: { ...edited, ...invalidText }, confirm: true }, env });
    assert.equal(rejected.isError, true, JSON.stringify(invalidText));
    assert.equal(rejected.structuredContent.error, "RUN_TEXT_INVALID", JSON.stringify(invalidText));
  }
  assert.equal(posts.length, 1);
});

test("attach_evidence hashes content and uploads after consent", async () => {
  const uploads = [];
  const client = createFakeClient({
    artifacts: {
      uploadPlan: async (input) => ({ key: `k/${input.artifactId}`, url: "https://r2.example.test/signed", mediaType: input.mediaType }),
      upload: async (plan, bytes) => { uploads.push({ plan, size: bytes.length }); return { uploaded: true }; },
    },
  });
  const contentBase64 = Buffer.from("evidence payload").toString("base64");
  const preview = await callTool({ client, name: "attach_evidence", args: { contentBase64, mediaType: "text/plain" } });
  assert.equal(preview.structuredContent.error, "consent_required");
  assert.match(preview.structuredContent.summary.rawHash, /^sha256:[0-9a-f]{64}$/);
  const result = await callTool({ client, name: "attach_evidence", args: { contentBase64, mediaType: "text/plain", confirm: true } });
  assert.equal(result.isError, false);
  assert.equal(result.structuredContent.sizeBytes, 16);
  assert.equal(uploads.length, 1);
});

test("attach_evidence rejects invalid base64 and oversized content", async () => {
  const client = createFakeClient();
  const invalid = await callTool({ client, name: "attach_evidence", args: { contentBase64: "not base64!", mediaType: "text/plain" } });
  assert.equal(invalid.isError, true);
  assert.equal(invalid.structuredContent.error, "MCP_TOOL_INVALID");
  assert.match(invalid.structuredContent.message, /valid base64/);
  const { MAX_EVIDENCE_BYTES } = await import("../src/tools.mjs");
  const big = Buffer.alloc(MAX_EVIDENCE_BYTES + 1).toString("base64");
  const oversized = await callTool({ client, name: "attach_evidence", args: { contentBase64: big, mediaType: "application/octet-stream" } });
  assert.equal(oversized.isError, true);
  assert.match(oversized.structuredContent.message, /exceeds/);
});

test("validate_submission returns structured findings", async () => {
  const client = createFakeClient();
  const validDoc = { schema: "srp.claim.v1", claim_id: "claim_018f0f4a-5c00-4000-8000-000000000001", revision: 1, state: "hypothesis", statement: "s", scope: ["s"], assumptions: [], falsification: ["f"], created_at: "2026-08-06T00:00:00.000Z", created_by: "actor_01" };
  const valid = await callTool({ client, name: "validate_submission", args: { document: validDoc } });
  assert.equal(valid.isError, false);
  assert.equal(valid.structuredContent.valid, true);
  const invalid = await callTool({ client, name: "validate_submission", args: { document: { schema: "srp.claim.v1", claim_id: "nope" } } });
  assert.equal(invalid.isError, false);
  assert.equal(invalid.structuredContent.valid, false);
  assert.ok(invalid.structuredContent.findings.length > 0);
});

test("publish_submission signs and posts only after consent", async () => {
  const dir = mkdtempSync(join(tmpdir(), "evimesh-mcp-"));
  const env = { ...process.env, EVIMESH_CONFIG_DIR: dir };
  const { generateIdentity } = await import("../../../packages/cli/src/identity.mjs");
  generateIdentity(env);
  const requests = [];
  const client = createFakeClient({ http: { request: async (method, path, { body }) => { requests.push({ method, path, body }); return { ok: true }; } } });
  const document = { schema: "srp.claim.v1", claim_id: "claim_018f0f4a-5c00-4000-8000-000000000001", revision: 1, state: "hypothesis", statement: "s", scope: ["s"], assumptions: [], falsification: ["f"], created_at: "2026-08-06T00:00:00.000Z", created_by: "actor_01" };
  const gated = await callTool({ client, name: "publish_submission", args: { document }, env });
  assert.equal(gated.structuredContent.error, "consent_required");
  assert.equal(requests.length, 0);
  const result = await callTool({ client, name: "publish_submission", args: { document, confirm: true }, env });
  assert.equal(result.isError, false, JSON.stringify(result.structuredContent));
  assert.equal(requests.length, 1);
  assert.equal(requests[0].path, "/claims");
  assert.ok(requests[0].body.signatureEnvelope);
  assert.equal(requests[0].body.signatureEnvelope.event_type, "claim.created");
});

test("publish_submission fails cleanly without an identity", async () => {
  const dir = mkdtempSync(join(tmpdir(), "evimesh-mcp-"));
  const env = { ...process.env, EVIMESH_CONFIG_DIR: dir };
  const client = createFakeClient();
  const document = { schema: "srp.claim.v1", claim_id: "claim_018f0f4a-5c00-4000-8000-000000000001", revision: 1, state: "hypothesis", statement: "s", scope: ["s"], assumptions: [], falsification: ["f"], created_at: "2026-08-06T00:00:00.000Z", created_by: "actor_01" };
  const result = await callTool({ client, name: "publish_submission", args: { document, confirm: true }, env });
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.error, "IDENTITY_MISSING");
});

test("verify_inclusion_proof validates proofs and binds events", async () => {
  const client = createFakeClient();
  const { buildMerkleTree } = await import("../../../packages/merkle/src/merkle-tree.mjs");
  const { hashResearchEventLeaf } = await import("../../../packages/merkle/src/research-event-leaf.mjs");
  const { createMerkleInclusionProof } = await import("../../../packages/merkle/src/inclusion-proof.mjs");
  const events = ["event-1", "event-2"].map((eventId, index) => ({
    schema: "srp.event.v1",
    event_id: eventId,
    event_type: "claim.created",
    payload: { claim_id: "claim-1" },
    hash: `sha256:${String(index).repeat(64)}`,
    signature: { algorithm: "Ed25519", value: "sig" },
    parents: [],
  }));
  const leafHashes = events.map((event) => hashResearchEventLeaf(event));
  const proof = createMerkleInclusionProof({ leafHashes, leafIndex: 1 });
  assert.equal(buildMerkleTree(leafHashes).root, proof.root);
  const good = await callTool({ client, name: "verify_inclusion_proof", args: { proof, event: events[1] } });
  assert.deepEqual(good.structuredContent, { valid: true, reason: null });
  const mismatch = await callTool({ client, name: "verify_inclusion_proof", args: { proof, event: events[0] } });
  assert.equal(mismatch.structuredContent.valid, false);
  const tampered = await callTool({ client, name: "verify_inclusion_proof", args: { proof: { ...proof, root: `sha256:${"f".repeat(64)}` } } });
  assert.equal(tampered.structuredContent.valid, false);
});

test("inspect_provenance and submit_verification work end to end", async () => {
  const dir = mkdtempSync(join(tmpdir(), "evimesh-mcp-"));
  const env = { ...process.env, EVIMESH_CONFIG_DIR: dir };
  const { generateIdentity } = await import("../../../packages/cli/src/identity.mjs");
  generateIdentity(env);
  const submissions = [];
  const client = createFakeClient({
    verifications: { submit: async (input) => { submissions.push(input); return { receipt: { receiptId: input.receiptId } }; } },
  });
  const provenance = await callTool({ client, name: "inspect_provenance", args: { objectType: "claim", objectId: "claim-1", revision: 2 } });
  assert.equal(provenance.isError, false);
  assert.equal(provenance.structuredContent.provenance.object.revision, 2);
  const document = { schema: "srp.verification-receipt.v1", claim_revision_id: "claim-1@2", contract_revision_id: "contract-1@1", outcome: "supports", verification_types: ["reproduction"], context_mode: "blind", saw_expected_outputs: false, implementation_relation: "independent", data_relation: "same_input", model_family: "none", findings: [] };
  const result = await callTool({ client, name: "submit_verification", args: { document, runId: "run-1", confirm: true }, env });
  assert.equal(result.isError, false, JSON.stringify(result.structuredContent));
  assert.ok(result.structuredContent.receiptId.startsWith("verification_"));
  assert.ok(submissions[0].signatureEnvelope);
});
