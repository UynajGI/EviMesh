import test from "node:test";
import assert from "node:assert/strict";
import { createClient } from "../src/index.mjs";
import { buildMerkleTree } from "../../merkle/src/merkle-tree.mjs";
import { hashResearchEventLeaf } from "../../merkle/src/research-event-leaf.mjs";
import { createMerkleInclusionProof } from "../../merkle/src/inclusion-proof.mjs";

function recordingFetch(handler) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return handler(url, options);
  };
  return { calls, fetchImpl };
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => (name === "content-type" ? "application/json" : null) },
    text: async () => JSON.stringify(body),
  };
}

function setup(body = {}) {
  const { calls, fetchImpl } = recordingFetch(() => jsonResponse(200, body));
  return { calls, client: createClient({ baseUrl: "https://api.example.test", fetchImpl }) };
}

test("project client covers create, list, get, and revise with If-Match", async () => {
  const { calls, client } = setup({ project: { projectId: "project-1" } });
  await client.projects.create({ projectId: "project-1", name: "n", summary: "s", license: "CC-BY-4.0" });
  await client.projects.list({ state: "active", limit: 3 });
  await client.projects.get("project-1");
  await client.projects.revise("project-1", { name: "next" }, { ifMatch: 'W/"etag"' });
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[1].url, "https://api.example.test/projects?state=active&limit=3");
  assert.equal(calls[2].url, "https://api.example.test/projects/project-1");
  assert.equal(calls[3].url, "https://api.example.test/projects/project-1/revisions");
  assert.equal(calls[3].options.headers["if-match"], 'W/"etag"');
});

test("question and task clients call list, detail, transition, and lease routes", async () => {
  const { calls, client } = setup({});
  await client.questions.list({ state: "admissible" });
  await client.questions.get("question-1");
  await client.questions.transition("question-1", "active");
  await client.tasks.list({ status: "open", tag: "cpu-only" });
  await client.tasks.get("task-1");
  await client.tasks.context("task-1", "blind");
  await client.tasks.acquireLease("task-1", { leaseDurationMs: 60000 });
  await client.tasks.releaseLease("task-1");
  assert.equal(calls[0].url, "https://api.example.test/questions?state=admissible");
  assert.equal(calls[2].options.method, "POST");
  assert.equal(calls[2].options.body, JSON.stringify({ toState: "active" }));
  assert.equal(calls[3].url, "https://api.example.test/tasks?status=open&tag=cpu-only");
  assert.equal(calls[5].url, "https://api.example.test/tasks/task-1/context?mode=blind");
  assert.equal(calls[6].url, "https://api.example.test/tasks/task-1/lease");
  assert.equal(calls[7].options.method, "DELETE");
});

test("attempt client starts attempts and records public trace events", async () => {
  const { calls, client } = setup({});
  await client.attempts.start("task-1", { attemptId: "attempt-1", contextBundleId: "bundle-1", contextMode: "frontier" });
  await client.attempts.get("attempt-1");
  await client.attempts.transition("attempt-1", "submitted");
  await client.attempts.recordTrace("attempt-1", { eventId: "trace-1", eventType: "attempt.progress", payload: { summary: "done" } });
  assert.equal(calls[0].url, "https://api.example.test/tasks/task-1/attempts");
  assert.equal(calls[1].url, "https://api.example.test/attempts/attempt-1");
  assert.equal(calls[2].options.body, JSON.stringify({ toState: "submitted" }));
  assert.equal(calls[3].url, "https://api.example.test/attempts/attempt-1/trace");
});

test("claim client covers create, revise, transition, graph, and revisions", async () => {
  const { calls, client } = setup({});
  await client.claims.create({ claimId: "claim-1", statement: "s", scope: ["a"], falsification: ["f"] });
  await client.claims.get("claim-1");
  await client.claims.revision("claim-1", 2);
  await client.claims.revise("claim-1", { statement: "next" }, { ifMatch: 'W/"c"' });
  await client.claims.transition("claim-1", "contested", { ifMatch: 'W/"c"' });
  await client.claims.graph("claim-1", { direction: "upstream", maxDepth: 2 });
  await client.claims.verifications("claim-1", { outcome: "supports" });
  assert.equal(calls[0].url, "https://api.example.test/claims");
  assert.equal(calls[2].url, "https://api.example.test/claims/claim-1/revisions/2");
  assert.equal(calls[3].url, "https://api.example.test/claims/claim-1/revisions");
  assert.equal(calls[4].url, "https://api.example.test/claims/claim-1/transitions");
  assert.equal(calls[5].url, "https://api.example.test/claims/claim-1/graph?direction=upstream&maxDepth=2");
  assert.equal(calls[6].url, "https://api.example.test/claims/claim-1/verifications?outcome=supports");
});

test("research graph client reads one filtered heterogeneous neighborhood", async () => {
  const { calls, client } = setup({ schemaVersion: "research-neighborhood.v1", nodes: [], edges: [] });
  await client.researchGraph.neighborhood("question", "question/1", {
    revision: 2,
    direction: "both",
    depth: 3,
    kinds: ["question", "answer", "dataset"],
    edgeTypes: ["answers", "uses_dataset"],
    cursor: "next page",
  });
  assert.equal(calls[0].url, "https://api.example.test/research-graph/question/question%2F1/neighborhood?revision=2&direction=both&depth=3&kinds=question%2Canswer%2Cdataset&edgeTypes=answers%2Cuses_dataset&cursor=next+page");
});

test("typed research clients share list, detail, prepare, and externally signed submit routes", async () => {
  const { calls, client } = setup({});
  await client.answers.list({ projectId: "project-1", state: "published" });
  await client.rebuttals.get("rebuttal/1");
  await client.evaluations.prepare({ evaluationId: "evaluation-1", nonce: "0123456789abcdef" });
  await client.datasets.submit({ datasetId: "dataset-1", signatureEnvelope: { signature: { value: "external" } } });
  await client.tools.list({ toolKind: "skill" });
  assert.equal(calls[0].url, "https://api.example.test/answers?projectId=project-1&state=published");
  assert.equal(calls[1].url, "https://api.example.test/rebuttals/rebuttal%2F1");
  assert.equal(calls[2].url, "https://api.example.test/evaluations/prepare");
  assert.equal(calls[3].url, "https://api.example.test/datasets");
  assert.equal(calls[4].url, "https://api.example.test/tools?toolKind=skill");
});

test("artifact client plans uploads and uploads bytes to the signed URL", async () => {
  const uploads = [];
  const plan = { uploadType: "single", key: "artifacts/artifact-1/1/sha256-abc", sizeBytes: 4, mediaType: "text/plain", url: "https://r2.example.test/signed" };
  const { calls, fetchImpl } = recordingFetch((url) => {
    if (url.endsWith("/artifacts/upload-plan")) return jsonResponse(201, plan);
    return jsonResponse(200, {});
  });
  const putFetch = async (url, options) => { uploads.push({ url, options }); return { ok: true, status: 200 }; };
  const client = createClient({ baseUrl: "https://api.example.test", fetchImpl });
  const receivedPlan = await client.artifacts.uploadPlan({ artifactId: "artifact-1", revision: 1, rawHash: `sha256:${"a".repeat(64)}`, sizeBytes: 4, mediaType: "text/plain", fileName: "evidence.txt" });
  const result = await client.artifacts.upload(receivedPlan, "data", { fetchImpl: putFetch });
  assert.equal(calls[0].url, "https://api.example.test/artifacts/upload-plan");
  assert.deepEqual(JSON.parse(calls[0].options.body), { artifactId: "artifact-1", revision: 1, rawHash: `sha256:${"a".repeat(64)}`, sizeBytes: 4, mediaType: "text/plain", fileName: "evidence.txt" });
  assert.equal(result.key, plan.key);
  assert.equal(uploads[0].url, "https://r2.example.test/signed");
  assert.equal(uploads[0].options.method, "PUT");
  assert.equal(uploads[0].options.headers["content-type"], "text/plain");
});

test("run and evidence clients cover create, link, and listing", async () => {
  const { calls, client } = setup({});
  await client.runs.create({ runId: "run-1", taskId: "task-1" });
  await client.runs.get("run-1");
  await client.evidence.create({ evidenceId: "evidence-1", evidenceType: "dataset", artifactId: "artifact-1", artifactRevision: 1 });
  await client.evidence.link("evidence-1", { claimId: "claim-1", claimRevision: 2, relationType: "supports" });
  await client.evidence.list({ claimId: "claim-1" });
  assert.equal(calls[0].url, "https://api.example.test/runs");
  assert.equal(calls[1].url, "https://api.example.test/runs/run-1");
  assert.equal(calls[3].url, "https://api.example.test/evidence/evidence-1/links");
  assert.equal(calls[4].url, "https://api.example.test/evidence?claimId=claim-1");
});

test("verification client prepares, submits, and lists receipts", async () => {
  const { calls, client } = setup({});
  await client.verifications.prepare({ claimId: "claim-1", claimRevision: 2, contractId: "contract-1", contractRevision: 1, nonce: "nonce-0123456789abcdef" });
  await client.verifications.submit({ receiptId: "receipt-1", outcome: "supports" });
  await client.verifications.receipt("receipt-1");
  await client.verifications.forClaim("claim-1", { contextMode: "blind" });
  assert.equal(calls[0].url, "https://api.example.test/verifications/prepare");
  assert.equal(calls[1].url, "https://api.example.test/verifications");
  assert.equal(calls[2].url, "https://api.example.test/verifications/receipt-1");
  assert.equal(calls[3].url, "https://api.example.test/claims/claim-1/verifications?contextMode=blind");
});

test("challenge and frontier clients call their routes", async () => {
  const { calls, client } = setup({});
  await client.challenges.create({ challengeId: "challenge-1", targetClaimId: "claim-1", targetClaimRevision: 2, reason: "r", impact: {} });
  await client.challenges.get("challenge-1");
  await client.challenges.transition("challenge-1", "admissible", { ifMatch: 'W/"e"' });
  await client.frontier.latest("project-1");
  await client.frontier.history("project-1", { limit: 5 });
  await client.frontier.diff("project-1", { fromSnapshotId: "frontier-1", toSnapshotId: "frontier-2" });
  assert.equal(calls[0].url, "https://api.example.test/challenges");
  assert.equal(calls[1].url, "https://api.example.test/challenges/challenge-1");
  assert.equal(calls[2].options.headers["if-match"], 'W/"e"');
  assert.equal(calls[3].url, "https://api.example.test/projects/project-1/frontier/latest");
  assert.equal(calls[4].url, "https://api.example.test/projects/project-1/frontier/history?limit=5");
  assert.equal(calls[5].url, "https://api.example.test/projects/project-1/frontier/diff?fromSnapshotId=frontier-1&toSnapshotId=frontier-2");
});

test("event client lists, exports NDJSON, and reads proofs and checkpoints", async () => {
  const { calls, fetchImpl } = recordingFetch((url) => {
    if (url.includes("/events/export")) {
      return { ok: true, status: 200, headers: { get: (name) => (name === "content-type" ? "application/x-ndjson" : null) }, text: async () => '{"eventId":"event-1"}\n' };
    }
    return jsonResponse(200, {});
  });
  const client = createClient({ baseUrl: "https://api.example.test", fetchImpl });
  await client.events.list({ objectType: "claim", objectId: "claim-1" });
  const ndjson = await client.events.exportRange({ firstEventId: "event-1", lastEventId: "event-1" });
  await client.events.proof("event-1");
  await client.events.checkpoint("checkpoint-1");
  await client.contributions.forActor("actor-1");
  await client.contributions.provenance("claim", "claim-1", 2);
  await client.contributions.mergeProposal("proposal-1");
  assert.equal(calls[0].url, "https://api.example.test/events?objectType=claim&objectId=claim-1");
  assert.equal(typeof ndjson, "string");
  assert.match(ndjson, /event-1/);
  assert.equal(calls[2].url, "https://api.example.test/events/event-1/proof");
  assert.equal(calls[3].url, "https://api.example.test/checkpoints/checkpoint-1");
  assert.equal(calls[4].url, "https://api.example.test/actors/actor-1");
  assert.equal(calls[5].url, "https://api.example.test/provenance/claim/claim-1?revision=2");
  assert.equal(calls[6].url, "https://api.example.test/merge-proposals/proposal-1");
});

function sampleEvents() {
  return ["event-1", "event-2", "event-3"].map((eventId, index) => ({
    schema: "srp.event.v1",
    event_id: eventId,
    event_type: "claim.created",
    payload: { claim_id: "claim-1" },
    hash: `sha256:${String(index).repeat(64)}`,
    signature: { algorithm: "Ed25519", value: "sig" },
    parents: [],
  }));
}

test("verifyEventProof validates inclusion proofs against their events", () => {
  const { client } = setup({});
  const events = sampleEvents();
  const leafHashes = events.map((event) => hashResearchEventLeaf(event));
  const proof = createMerkleInclusionProof({ leafHashes, leafIndex: 1 });
  assert.equal(buildMerkleTree(leafHashes).root, proof.root);
  assert.deepEqual(client.verifyEventProof({ proof, event: events[1] }), { valid: true, reason: null });
  const tampered = { ...proof, root: `sha256:${"f".repeat(64)}` };
  assert.equal(client.verifyEventProof({ proof: tampered }).valid, false);
  const mismatch = client.verifyEventProof({ proof, event: events[2] });
  assert.equal(mismatch.valid, false);
  assert.match(mismatch.reason, /leaf hash/);
});
