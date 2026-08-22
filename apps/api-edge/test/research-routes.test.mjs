import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/index.mjs";
import { buildMerkleTree } from "../../../packages/merkle/src/merkle-tree.mjs";
import { hashResearchEventLeaf } from "../../../packages/merkle/src/research-event-leaf.mjs";
import { verifyMerkleInclusionProof } from "../../../packages/merkle/src/verify-inclusion-proof.mjs";
import { canonicalJson } from "../../../packages/protocol/src/hash.mjs";
import { generateEd25519KeyPair } from "../../../packages/signatures/src/ed25519.mjs";
import { signEd25519Payload } from "../../../packages/signatures/src/client-signature.mjs";

const AUTH = { authenticate: async () => ({ sub: "supabase-subject" }) };

function identityRepository(extra = {}) {
  return {
    findIdentity: async () => ({ actorId: "actor-1" }),
    withTransaction: async (callback) => callback(transactionRepository(extra)),
    ...extra,
  };
}

function transactionRepository(extra = {}) {
  const passthrough = {};
  for (const [key, value] of Object.entries(extra)) {
    if (typeof value === "function") passthrough[key] = value;
  }
  return passthrough;
}

const eventFactory = async ({ eventType, payload }) => ({ eventType, payload });

test("lists artifacts with type and creator filters", async () => {
  const app = createApp({ repository: { listArtifacts: async ({ artifactType, createdBy }) => [
    { artifactId: "artifact-1", artifactType, createdBy, createdAt: "2026-08-06T00:00:00.000Z" },
  ] } });
  const response = await app.fetch(new Request("https://api.example.test/artifacts?artifactType=dataset&createdBy=actor-1&limit=6"), {});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.items.map((artifact) => artifact.artifactId), ["artifact-1"]);
});

test("returns one artifact and an immutable revision", async () => {
  const app = createApp({ repository: {
    getArtifact: async (artifactId) => ({ artifactId, createdBy: "actor-1" }),
    getCurrentArtifactRevision: async () => ({ artifactId: "artifact-1", revision: 2, rawHash: `sha256:${"a".repeat(64)}` }),
    listArtifactLocations: async () => [{ uri: "r2://evimesh/artifact-1" }],
    getArtifactRevision: async (artifactId, revision) => ({ artifactId, revision, rawHash: `sha256:${"a".repeat(64)}` }),
  } });
  const detail = await app.fetch(new Request("https://api.example.test/artifacts/artifact-1"), {});
  assert.equal(detail.status, 200);
  const detailBody = await detail.json();
  assert.equal(detailBody.currentRevision.revision, 2);
  assert.equal(detailBody.locations[0].uri, "r2://evimesh/artifact-1");
  const revision = await app.fetch(new Request("https://api.example.test/artifacts/artifact-1/revisions/2"), {});
  assert.equal(revision.status, 200);
  assert.equal((await revision.json()).artifactRevision.revision, 2);
});

test("lists evidence and returns one Evidence object", async () => {
  const app = createApp({ repository: {
    listEvidence: async ({ claimId }) => [{ evidenceId: "evidence-1", claimId, createdAt: "2026-08-06T00:00:00.000Z" }],
    getEvidence: async (evidenceId) => ({ evidenceId, evidenceType: "experimental_result" }),
    listEvidenceClaimLinks: async () => [{ claimId: "claim-1", claimRevision: 2, relationType: "supports" }],
  } });
  const list = await app.fetch(new Request("https://api.example.test/evidence?claimId=claim-1&limit=6"), {});
  assert.equal(list.status, 200);
  assert.deepEqual((await list.json()).items.map((item) => item.evidenceId), ["evidence-1"]);
  const detail = await app.fetch(new Request("https://api.example.test/evidence/evidence-1"), {});
  const body = await detail.json();
  assert.equal(body.evidence.evidenceType, "experimental_result");
  assert.equal(body.claimLinks[0].relationType, "supports");
});

test("lists runs and returns one Run receipt", async () => {
  const app = createApp({ repository: {
    listRuns: async ({ taskId }) => [{ runId: "run-1", taskId, createdAt: "2026-08-06T00:00:00.000Z" }],
    getRun: async (runId) => ({ runId, command: "python reproduce.py" }),
    listRunInputs: async () => [{ artifactId: "input-1", artifactRevision: 1 }],
    listRunOutputs: async () => [{ artifactId: "output-1", artifactRevision: 1 }],
  } });
  const list = await app.fetch(new Request("https://api.example.test/runs?taskId=task-1"), {});
  assert.equal(list.status, 200);
  assert.deepEqual((await list.json()).items.map((item) => item.runId), ["run-1"]);
  const detail = await app.fetch(new Request("https://api.example.test/runs/run-1"), {});
  const body = await detail.json();
  assert.equal(body.run.command, "python reproduce.py");
  assert.equal(body.outputs[0].artifactId, "output-1");
});

test("returns a Challenge with status policy and a revision etag", async () => {
  const app = createApp({ repository: {
    getChallenge: async (challengeId) => ({ challengeId, createdBy: "actor-1" }),
    getCurrentChallengeRevision: async () => ({ challengeId: "challenge-1", revision: 1, state: "open", targetClaimId: "claim-1", targetClaimRevision: 2 }),
    listChallengeImpacts: async () => [],
    listEvidenceForClaimRevision: async () => [],
  } });
  const response = await app.fetch(new Request("https://api.example.test/challenges/challenge-1"), {});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.statusPolicy.state, "open");
  assert.match(body.etag, /^W\/"challenge-1:1:/);
});

test("returns an Attempt with its trace summary", async () => {
  const app = createApp({ repository: {
    getAttempt: async (attemptId) => ({ attemptId, state: "active", actorId: "actor-1" }),
    listTraceEvents: async () => [{ eventId: "trace-1", eventType: "attempt.progress" }],
  } });
  const response = await app.fetch(new Request("https://api.example.test/attempts/attempt-1"), {});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).attempt.attemptId, "attempt-1");
});

test("returns an Actor contribution profile", async () => {
  const app = createApp({ repository: {
    listContributionStatements: async () => [{ statementId: "statement-1", role: "originator" }],
    listContributionEdges: async () => [{ statementId: "statement-1", edgeType: "produced", objectType: "claim", objectId: "claim-1" }],
  } });
  const response = await app.fetch(new Request("https://api.example.test/actors/actor-1"), {});
  assert.equal(response.status, 200);
  assert.equal((await response.json()).statements[0].statementId, "statement-1");
});

test("lists Verification receipts for one Claim and returns one receipt", async () => {
  const app = createApp({ repository: {
    listVerificationReceipts: async ({ claimId }) => [{ receiptId: "receipt-1", claimId, outcome: "reproduce" }],
    getVerificationReceipt: async (receiptId) => ({ receiptId, outcome: "reproduce" }),
    listVerificationFindings: async () => [{ findingId: "finding-1", severity: "note" }],
  } });
  const list = await app.fetch(new Request("https://api.example.test/claims/claim-1/verifications?outcome=reproduce"), {});
  assert.equal(list.status, 200);
  assert.deepEqual((await list.json()).items.map((item) => item.receiptId), ["receipt-1"]);
  const detail = await app.fetch(new Request("https://api.example.test/verifications/receipt-1"), {});
  assert.equal((await detail.json()).findings[0].findingId, "finding-1");
});

test("lists research events and exports contiguous NDJSON ranges", async () => {
  const events = [
    { eventId: "event-1", eventType: "claim.created", createdAt: "2026-08-06T00:00:00.000Z" },
    { eventId: "event-2", eventType: "claim.revised", createdAt: "2026-08-06T01:00:00.000Z" },
  ];
  const app = createApp({ repository: {
    listResearchEvents: async ({ eventType }) => events.filter((event) => !eventType || event.eventType === eventType),
    listResearchEventRange: async () => events,
  } });
  const list = await app.fetch(new Request("https://api.example.test/events?eventType=claim.created&limit=6"), {});
  assert.equal(list.status, 200);
  assert.deepEqual((await list.json()).items.map((event) => event.eventId), ["event-1"]);
  const exportResponse = await app.fetch(new Request("https://api.example.test/events/export?firstEventId=event-1&lastEventId=event-2"), {});
  assert.equal(exportResponse.status, 200);
  assert.equal(exportResponse.headers.get("content-type"), "application/x-ndjson");
  const lines = (await exportResponse.text()).trim().split("\n");
  assert.equal(lines.length, 2);
  assert.equal(JSON.parse(lines[0]).eventId, "event-1");
});

test("returns a Merkle inclusion proof and checkpoint for an Event", async () => {
  const events = ["event-1", "event-2"].map((eventId, index) => ({
    eventId,
    eventType: "claim.created",
    payload: { claim_id: "claim-1" },
    hash: `sha256:${String(index).repeat(64)}`,
    signature: { algorithm: "Ed25519", value: "sig" },
    parents: [],
  }));
  const rootHash = buildMerkleTree(events.map((event) => hashResearchEventLeaf({
    schema: "srp.event.v1", event_id: event.eventId, event_type: event.eventType,
    payload: event.payload, hash: event.hash, signature: event.signature, parents: event.parents,
  }))).root;
  const checkpointSignature = { algorithm: "Ed25519", keyId: "key-1", value: "sig" };
  const app = createApp({ repository: {
    getMerkleCheckpointForEvent: async () => ({ checkpointId: "checkpoint-1", firstEventId: "event-1", lastEventId: "event-2", eventCount: 2, rootHash }),
    listResearchEventRange: async () => events,
    getMerkleCheckpoint: async (checkpointId) => ({ checkpointId, firstEventId: "event-1", lastEventId: "event-2", eventCount: 2, rootHash, signature: checkpointSignature }),
  } });
  const proof = await app.fetch(new Request("https://api.example.test/events/event-2/proof"), {});
  assert.equal(proof.status, 200, await proof.clone().text());
  const proofBody = await proof.json();
  assert.equal(proofBody.checkpointId, "checkpoint-1");
  assert.equal(verifyMerkleInclusionProof(proofBody.proof), true);
  const checkpoint = await app.fetch(new Request("https://api.example.test/checkpoints/checkpoint-1"), {});
  assert.equal(checkpoint.status, 200, await checkpoint.clone().text());
  const checkpointBody = await checkpoint.json();
  assert.equal(checkpointBody.rootHash, rootHash);
  assert.equal(checkpointBody.signature.algorithm, "Ed25519");
});

test("returns a MergeProposal with satisfied and unsatisfied conditions", async () => {
  const app = createApp({ repository: { getMergeProposal: async (proposalId) => ({
    proposalId,
    evaluation: { requirement_results: [{ rule: "blind_count", met: true }, { rule: "challenge_window", met: false }] },
  }) } });
  const response = await app.fetch(new Request("https://api.example.test/merge-proposals/proposal-1"), {});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.conditions.satisfied.map((condition) => condition.rule), ["blind_count"]);
  assert.deepEqual(body.conditions.unsatisfied.map((condition) => condition.rule), ["challenge_window"]);
});

test("returns object provenance paths for one revision", async () => {
  const app = createApp({ repository: {
    getObjectRevision: async () => ({ objectType: "claim", objectId: "claim-1", revision: 1, statement: "s" }),
    listContributionEdgesForObject: async () => [{ statementId: "statement-1", edgeType: "produced" }],
    listContributionStatementsByIds: async () => [{ statementId: "statement-1", actorId: "actor-1", role: "originator", eventId: "event-1" }],
    listResearchEventsByIds: async () => [{ eventId: "event-1", eventType: "claim.created" }],
    listFrontiersForObjectRevision: async () => [{ snapshotId: "frontier-1", sequence: 1 }],
  } });
  const response = await app.fetch(new Request("https://api.example.test/provenance/claim/claim-1?revision=1"), {});
  assert.equal(response.status, 200, await response.clone().text());
  const body = await response.json();
  assert.equal(body.object.objectId, "claim-1");
  assert.equal(body.actorEvents[0].event.eventId, "event-1");
});

test("diffs two Frontier snapshots of one project", async () => {
  const members = new Map([
    ["frontier-1", [{ claimId: "claim-1", claimRevision: 1, membershipType: "core" }]],
    ["frontier-2", [{ claimId: "claim-1", claimRevision: 2, membershipType: "core" }, { claimId: "claim-2", claimRevision: 1, membershipType: "core" }]],
  ]);
  const app = createApp({ repository: {
    getFrontierSnapshot: async (snapshotId) => ({ snapshotId, projectId: "project-1", sequence: snapshotId === "frontier-1" ? 1 : 2 }),
    listFrontierMembers: async (snapshotId) => members.get(snapshotId),
  } });
  const response = await app.fetch(new Request("https://api.example.test/projects/project-1/frontier/diff?fromSnapshotId=frontier-1&toSnapshotId=frontier-2"), {});
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.added.map((member) => member.claimId), ["claim-2"]);
});

test("rejects a revision that lost an If-Match race inside the transaction", async () => {
  const outerRevision = { claimId: "claim-1", revision: 1, statement: "s", scope: ["s"], assumptions: [], falsification: ["f"], state: "candidate" };
  const transactionRevision = { claimId: "claim-1", revision: 2, statement: "concurrent", scope: ["s"], assumptions: [], falsification: ["f"], state: "candidate" };
  const insertClaimRevision = async (revision) => revision;
  const updateClaim = async (claimId, projection) => ({ claimId, ...projection });
  const appendResearchEvent = async (event) => event;
  const app = createApp({
    repository: {
      findIdentity: async () => ({ actorId: "actor-1" }),
      getClaim: async (claimId) => ({ claimId, questionId: null, state: outerRevision.state }),
      getCurrentClaimRevision: async () => outerRevision,
      insertClaimRevision,
      updateClaim,
      appendResearchEvent,
      withTransaction: async (callback) => callback({
        getCurrentClaimRevision: async () => transactionRevision,
        insertClaimRevision,
        updateClaim,
        appendResearchEvent,
      }),
    },
    claimEventFactory: async ({ eventType, payload }) => ({ eventType, payload }),
    claimRoleResolver: async () => "maintainer",
    ...AUTH,
  });
  const detail = await (await app.fetch(new Request("https://api.example.test/claims/claim-1"), {})).json();
  const stale = await app.fetch(new Request("https://api.example.test/claims/claim-1/revisions", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json", "if-match": detail.etag },
    body: JSON.stringify({ statement: "should lose the race" }),
  }), {});
  assert.equal(stale.status, 412);
});

test("rejects frontier diffs for snapshots owned by another project", async () => {
  const members = new Map([
    ["frontier-1", [{ claimId: "claim-1", claimRevision: 1, membershipType: "core" }]],
    ["frontier-2", [{ claimId: "claim-1", claimRevision: 2, membershipType: "core" }]],
  ]);
  const app = createApp({ repository: {
    getFrontierSnapshot: async (snapshotId) => ({ snapshotId, projectId: "project-B", sequence: 1 }),
    listFrontierMembers: async (snapshotId) => members.get(snapshotId),
  } });
  const response = await app.fetch(new Request("https://api.example.test/projects/project-A/frontier/diff?fromSnapshotId=frontier-1&toSnapshotId=frontier-2"), {});
  assert.equal(response.status, 404);
  assert.equal((await response.json()).code, "FRONTIER_SNAPSHOT_NOT_FOUND");
});

test("exposes revision etags on claim, task, and project details", async () => {
  const app = createApp({ repository: {
    getClaim: async (claimId) => ({ claimId, state: "candidate" }),
    getCurrentClaimRevision: async (claimId) => ({ claimId, revision: 3, statement: "s", scope: [], assumptions: [], falsification: ["f"] }),
    getTask: async (taskId) => ({ taskId, state: "open" }),
    getCurrentTaskRevision: async (taskId) => ({ taskId, revision: 1, title: "t", description: "d", inputs: [], outputs: {}, acceptance: [], contextMode: "frontier" }),
    listTaskDependencies: async () => [],
    listCurrentTaskLeases: async () => [],
    getProject: async (projectId) => ({ projectId, state: "active" }),
    getCurrentProjectRevision: async (projectId) => ({ projectId, revision: 2, name: "n", summary: "s", license: "CC-BY-4.0" }),
  } });
  const claim = await (await app.fetch(new Request("https://api.example.test/claims/claim-1"), {})).json();
  const task = await (await app.fetch(new Request("https://api.example.test/tasks/task-1"), {})).json();
  const project = await (await app.fetch(new Request("https://api.example.test/projects/project-1"), {})).json();
  assert.match(claim.etag, /^W\/"claim-1:3:/);
  assert.match(task.etag, /^W\/"task-1:1:/);
  assert.match(project.etag, /^W\/"project-1:2:/);
});

test("creates a Claim through the authenticated command boundary", async () => {
  const app = createApp({
    repository: identityRepository({
      insertClaim: async (claim) => claim,
      insertClaimRevision: async (revision) => revision,
      appendResearchEvent: async (event) => event,
    }),
    claimEventFactory: eventFactory,
    claimRoleResolver: async () => "maintainer",
    ...AUTH,
  });
  const response = await app.fetch(new Request("https://api.example.test/claims", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json" },
    body: JSON.stringify({ claimId: "claim-1", questionId: "question-1", statement: "The method reproduces.", scope: ["dataset"], assumptions: [], falsification: ["a failed reproduction"] }),
  }), {});
  assert.equal(response.status, 201);
  assert.equal((await response.json()).claim.claimId, "claim-1");
});

test("returns 503 for Claim creation when the command boundary is not configured", async () => {
  const app = createApp({ repository: identityRepository(), ...AUTH });
  const response = await app.fetch(new Request("https://api.example.test/claims", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json" },
    body: JSON.stringify({ claimId: "claim-1", statement: "s", scope: ["s"], falsification: ["f"] }),
  }), {});
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "CLAIM_CREATION_UNAVAILABLE");
});

test("revises a Claim when If-Match matches the current revision etag", async () => {
  const current = { claimId: "claim-1", revision: 2, statement: "old", scope: ["s"], assumptions: [], falsification: ["f"], state: "candidate" };
  const app = createApp({
    repository: identityRepository({
      getClaim: async (claimId) => ({ claimId, questionId: null, state: current.state }),
      getCurrentClaimRevision: async () => current,
      insertClaimRevision: async (revision) => revision,
      updateClaim: async (claimId, projection) => ({ claimId, ...projection }),
      appendResearchEvent: async (event) => event,
    }),
    claimEventFactory: eventFactory,
    claimRoleResolver: async () => "maintainer",
    ...AUTH,
  });
  const detail = await app.fetch(new Request("https://api.example.test/claims/claim-1"), {});
  const etag = (await detail.json()).etag;
  const matched = await app.fetch(new Request("https://api.example.test/claims/claim-1/revisions", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json", "if-match": etag },
    body: JSON.stringify({ statement: "new statement" }),
  }), {});
  assert.equal(matched.status, 201);
  assert.equal((await matched.json()).revision.revision, 3);
  const stale = await app.fetch(new Request("https://api.example.test/claims/claim-1/revisions", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json", "if-match": 'W/"claim-1:1:stale"' },
    body: JSON.stringify({ statement: "conflict" }),
  }), {});
  assert.equal(stale.status, 412);
});

test("transitions a Claim state machine through the API", async () => {
  const current = { claimId: "claim-1", revision: 1, statement: "s", scope: ["s"], assumptions: [], falsification: ["f"], state: "candidate" };
  const app = createApp({
    repository: identityRepository({
      getClaim: async (claimId) => ({ claimId, questionId: null, state: current.state }),
      getCurrentClaimRevision: async () => current,
      insertClaimRevision: async (revision) => revision,
      updateClaim: async (claimId, projection) => ({ claimId, ...projection }),
      appendResearchEvent: async (event) => event,
    }),
    claimEventFactory: eventFactory,
    claimRoleResolver: async () => "maintainer",
    ...AUTH,
  });
  const detail = await (await app.fetch(new Request("https://api.example.test/claims/claim-1"), {})).json();
  const response = await app.fetch(new Request("https://api.example.test/claims/claim-1/transitions", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json", "if-match": detail.etag },
    body: JSON.stringify({ toState: "under_verification" }),
  }), {});
  assert.equal(response.status, 201);
  assert.equal((await response.json()).revision.state, "under_verification");
});

test("rejects an invalid Claim state transition with 409", async () => {
  const current = { claimId: "claim-1", revision: 1, statement: "s", scope: ["s"], assumptions: [], falsification: ["f"], state: "candidate" };
  const app = createApp({
    repository: identityRepository({
      getClaim: async (claimId) => ({ claimId, questionId: null, state: current.state }),
      getCurrentClaimRevision: async () => current,
      insertClaimRevision: async (revision) => revision,
      updateClaim: async (claimId, projection) => ({ claimId, ...projection }),
      appendResearchEvent: async (event) => event,
    }),
    claimEventFactory: eventFactory,
    claimRoleResolver: async () => "maintainer",
    ...AUTH,
  });
  const detail = await (await app.fetch(new Request("https://api.example.test/claims/claim-1"), {})).json();
  const response = await app.fetch(new Request("https://api.example.test/claims/claim-1/transitions", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json", "if-match": detail.etag },
    body: JSON.stringify({ toState: "accepted" }),
  }), {});
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, "STATE_TRANSITION_INVALID");
});

test("creates a Task through the authenticated command boundary", async () => {
  const app = createApp({
    repository: identityRepository({
      insertTask: async (task) => task,
      insertTaskRevision: async (revision) => revision,
      appendResearchEvent: async (event) => event,
    }),
    taskEventFactory: eventFactory,
    taskRoleResolver: async () => "maintainer",
    ...AUTH,
  });
  const response = await app.fetch(new Request("https://api.example.test/tasks", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json" },
    body: JSON.stringify({ taskId: "task-1", title: "Reproduce", description: "Reproduce the number.", outputs: { metric: "rmse" }, acceptance: ["rmse within tolerance"], contextMode: "blind" }),
  }), {});
  assert.equal(response.status, 201);
  assert.equal((await response.json()).task.state, "draft");
});

test("transitions a Question state through the API", async () => {
  const app = createApp({
    repository: identityRepository({
      getQuestionState: async (questionId) => ({ questionId, state: "draft" }),
      updateQuestion: async (questionId, patch) => ({ questionId, ...patch }),
      appendResearchEvent: async (event) => event,
    }),
    questionEventFactory: eventFactory,
    questionRoleResolver: async () => "maintainer",
    ...AUTH,
  });
  const response = await app.fetch(new Request("https://api.example.test/questions/question-1/transitions", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json" },
    body: JSON.stringify({ toState: "proposed" }),
  }), {});
  assert.equal(response.status, 201, await response.clone().text());
  assert.equal((await response.json()).question.state, "proposed");
});

test("uses server-side risk signals for automatic Question transitions", async () => {
  const request = (body) => new Request("https://api.example.test/questions/question-1/transitions", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json" },
    body: JSON.stringify({ toState: "proposed", automaticPublication: true, ...body }),
  });
  const makeApp = (signals, calls = []) => createApp({
    repository: identityRepository({
      getQuestionState: async (questionId) => ({ questionId, state: "draft" }),
      updateQuestion: async (questionId, patch) => ({ questionId, ...patch }),
      appendResearchEvent: async (event) => event,
    }),
    questionEventFactory: eventFactory,
    questionRoleResolver: async () => "maintainer",
    questionRiskResolver: async (context) => {
      calls.push(context);
      return signals;
    },
    ...AUTH,
  });

  const calls = [];
  const open = await makeApp([], calls).fetch(request({ riskSignals: ["malicious_file"] }), {});
  assert.equal(open.status, 201, await open.clone().text());
  assert.deepEqual(calls[0], {
    repository: calls[0].repository,
    actorId: "actor-1",
    questionId: "question-1",
    toState: "proposed",
    claims: { sub: "supabase-subject" },
  });

  for (const [signals, code] of [
    [["missing_evidence"], "QUESTION_RISK_REVIEW_REQUIRED"],
    [["personal_data"], "QUESTION_RISK_RESTRICTED"],
    [["malicious_file"], "QUESTION_RISK_PROHIBITED"],
  ]) {
    const response = await makeApp(signals).fetch(request({ riskSignals: [] }), {});
    assert.equal(response.status, 409, await response.clone().text());
    assert.equal((await response.json()).code, code);
  }
});

test("fails closed when automatic Question publication has no risk resolver", async () => {
  const app = createApp({
    repository: identityRepository({
      getQuestionState: async (questionId) => ({ questionId, state: "draft" }),
      updateQuestion: async (questionId, patch) => ({ questionId, ...patch }),
      appendResearchEvent: async (event) => event,
    }),
    questionEventFactory: eventFactory,
    questionRoleResolver: async () => "maintainer",
    ...AUTH,
  });
  const response = await app.fetch(new Request("https://api.example.test/questions/question-1/transitions", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json" },
    body: JSON.stringify({ toState: "proposed", automaticPublication: true, riskSignals: [] }),
  }), {});
  assert.equal(response.status, 503, await response.clone().text());
  assert.equal((await response.json()).code, "QUESTION_RISK_RESOLVER_UNAVAILABLE");
});

test("revises a project revision with If-Match", async () => {
  const current = { projectId: "project-1", revision: 1, state: "active", name: "old", summary: "old", license: "CC-BY-4.0", maintainerIds: ["actor-1"] };
  const app = createApp({
    repository: identityRepository({
      getProject: async (projectId) => ({ projectId, state: "active" }),
      getCurrentProjectRevision: async () => current,
      insertProjectRevision: async (revision) => revision,
      updateProject: async (projectId, patch) => ({ projectId, ...patch }),
      appendResearchEvent: async (event) => event,
    }),
    projectEventFactory: eventFactory,
    ...AUTH,
  });
  const detail = await (await app.fetch(new Request("https://api.example.test/projects/project-1"), {})).json();
  const response = await app.fetch(new Request("https://api.example.test/projects/project-1/revisions", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json", "if-match": detail.etag },
    body: JSON.stringify({ name: "new name", summary: "new summary", license: "CC-BY-4.0" }),
  }), {});
  assert.equal(response.status, 201);
  assert.equal((await response.json()).revision.revision, 2);
});

test("transitions an Attempt and appends a public trace event", async () => {
  const attempts = new Map([["attempt-1", { attemptId: "attempt-1", state: "active", actorId: "actor-1" }]]);
  const app = createApp({
    repository: identityRepository({
      getAttempt: async (attemptId) => attempts.get(attemptId),
      updateAttempt: async (attemptId, patch) => Object.assign(attempts.get(attemptId), patch),
      insertTraceEvent: async (traceEvent) => traceEvent,
      appendResearchEvent: async (event) => event,
    }),
    attemptEventFactory: eventFactory,
    attemptRoleResolver: async () => "contributor",
    ...AUTH,
  });
  const transition = await app.fetch(new Request("https://api.example.test/attempts/attempt-1/transitions", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json" },
    body: JSON.stringify({ toState: "submitted" }),
  }), {});
  assert.equal(transition.status, 201);
  assert.equal((await transition.json()).attempt.state, "submitted");
});

test("creates Evidence and links it to a fixed ClaimRevision", async () => {
  const app = createApp({
    repository: identityRepository({
      insertEvidence: async (evidence) => evidence,
      appendResearchEvent: async (event) => event,
      getEvidence: async (evidenceId) => ({ evidenceId, createdBy: "actor-1" }),
      getClaimRevision: async (claimId, revision) => ({ claimId, revision, statement: "s" }),
      insertEvidenceClaimLink: async (link) => link,
    }),
    evidenceEventFactory: eventFactory,
    evidenceRoleResolver: async () => "contributor",
    ...AUTH,
  });
  const created = await app.fetch(new Request("https://api.example.test/evidence", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json" },
    body: JSON.stringify({ evidenceId: "evidence-1", evidenceType: "experimental_result", artifactId: "artifact-1", artifactRevision: 1 }),
  }), {});
  assert.equal(created.status, 201, await created.clone().text());
  assert.equal((await created.json()).evidence.evidenceId, "evidence-1");
  const linked = await app.fetch(new Request("https://api.example.test/evidence/evidence-1/links", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json" },
    body: JSON.stringify({ claimId: "claim-1", claimRevision: 2, relationType: "supports" }),
  }), {});
  assert.equal(linked.status, 201, await linked.clone().text());
  assert.equal((await linked.json()).link.claimRevision, 2);
});

test("records a Run receipt through the API", async () => {
  const keyPair = generateEd25519KeyPair();
  const app = createApp({
    repository: identityRepository({
      findActiveSigningKey: async () => ({ keyId: "key-1", actorId: "actor-1", algorithm: "Ed25519", publicKey: keyPair.public_key }),
      getArtifactRevision: async (artifactId, revision) => ({ artifactId, revision }),
      getArtifactVerification: async () => ({ status: "verified" }),
      insertRun: async (run) => run,
      insertRunInput: async (input) => input,
      insertRunOutput: async (output) => output,
      appendResearchEvent: async (event) => event,
    }),
    runEventFactory: eventFactory,
    runRoleResolver: async () => "contributor",
    ...AUTH,
  });
  const unsignedRun = {
    schema: "srp.run.v1",
    run_id: "run-1",
    task_id: "task-1",
    context_bundle_id: "bundle-1",
    input_artifact_ids: ["artifact-input@1"],
    source_code: "artifact-code@1",
    container: "python@sha256:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
    command: "python",
    args: ["reproduce.py"],
    environment: { python: "3.12" },
    hardware: { cpu: "x86_64" },
    random_seed: { seed: 42 },
    started_at: "2026-08-06T00:00:00.000Z",
    ended_at: "2026-08-06T00:05:00.000Z",
    network_access: false,
    output_artifact_ids: ["artifact-output@1"],
    exit_code: 0,
    actor_id: "actor-1",
    signing_key_id: "key-1",
  };
  const signature = await signEd25519Payload({
    signingBytes: new TextEncoder().encode(canonicalJson(unsignedRun)),
    privateKey: keyPair.private_key,
  });
  const runBody = {
    runId: "run-1", taskId: "task-1", contextBundleId: "bundle-1",
    sourceCode: "artifact-code@1",
    container: "python@sha256:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
    command: "python", args: ["reproduce.py"], environment: { python: "3.12" }, hardware: { cpu: "x86_64" },
    randomSeed: { seed: 42 }, startedAt: "2026-08-06T00:00:00.000Z", endedAt: "2026-08-06T00:05:00.000Z", exitCode: 0,
    actorId: "actor-1",
    signingKeyId: "key-1",
    signature,
    inputs: [{ artifactId: "artifact-input", artifactRevision: 1 }],
    outputs: [{ artifactId: "artifact-output", artifactRevision: 1 }],
  };
  const response = await app.fetch(new Request("https://api.example.test/runs", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json" },
    body: JSON.stringify(runBody),
  }), {});
  assert.equal(response.status, 201, await response.clone().text());
  const created = await response.json();
  assert.equal(created.run.runId, "run-1");
  assert.equal(created.run.signingKeyId, "key-1");

  const invalidSignature = await app.fetch(new Request("https://api.example.test/runs", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json" },
    body: JSON.stringify({ ...runBody, signature: "not-a-valid-signature" }),
  }), {});
  assert.equal(invalidSignature.status, 400);
  assert.equal((await invalidSignature.json()).code, "RUN_SIGNATURE_MISMATCH");

  const foreignKey = await app.fetch(new Request("https://api.example.test/runs", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json" },
    body: JSON.stringify({ signingKeyId: "key-owned-by-another-actor" }),
  }), {});
  assert.equal(foreignKey.status, 403);
  assert.equal((await foreignKey.json()).code, "SIGNING_KEY_ID_MISMATCH");

  const mismatch = await app.fetch(new Request("https://api.example.test/runs", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json" },
    body: JSON.stringify({ actorId: "human-2" }),
  }), {});
  assert.equal(mismatch.status, 403);
  assert.equal((await mismatch.json()).code, "ACTOR_IDENTITY_MISMATCH");
});

test("plans a signed single-object artifact upload", async () => {
  const app = createApp({
    uploadSigner: async ({ key, expiresAt }) => ({ url: `https://r2.example.test/evimesh/${key}?expires=${expiresAt.getTime()}` }),
  });
  const response = await app.fetch(new Request("https://api.example.test/artifacts/upload-plan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ artifactId: "artifact-1", revision: 1, rawHash: `sha256:${"c".repeat(64)}`, sizeBytes: 1024, mediaType: "text/plain" }),
  }), {});
  assert.equal(response.status, 201);
  const plan = await response.json();
  assert.equal(plan.uploadType, "single");
  assert.match(plan.url, /^https:\/\/r2\.example\.test\/evimesh\//);
});

test("returns 503 for upload plans when no signer is configured", async () => {
  const app = createApp({});
  const response = await app.fetch(new Request("https://api.example.test/artifacts/upload-plan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ artifactId: "artifact-1", revision: 1, rawHash: `sha256:${"c".repeat(64)}`, sizeBytes: 1, mediaType: "text/plain" }),
  }), {});
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "UPLOAD_UNAVAILABLE");
});

test("creates an Artifact with its first location", async () => {
  const app = createApp({
    repository: identityRepository({
      insertArtifact: async (artifact) => artifact,
      insertArtifactRevision: async (revision) => revision,
      insertArtifactLocation: async (location) => location,
      appendResearchEvent: async (event) => event,
    }),
    artifactEventFactory: eventFactory,
    artifactRoleResolver: async () => "contributor",
    ...AUTH,
  });
  const response = await app.fetch(new Request("https://api.example.test/artifacts", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json" },
    body: JSON.stringify({ artifactId: "artifact-1", artifactType: "dataset", rawHash: `sha256:${"d".repeat(64)}`, sizeBytes: 10, mediaType: "text/csv", license: "CC-BY-4.0", locationId: "location-1", location: "r2://evimesh/artifact-1" }),
  }), {});
  assert.equal(response.status, 201, await response.clone().text());
  assert.equal((await response.json()).location.locationId, "location-1");
});

test("prepares and submits a VerificationReceipt", async () => {
  const app = createApp({
    repository: identityRepository({
      getRun: async (runId) => ({ runId }),
      getClaimRevision: async (claimId, revision) => ({ claimId, revision, statement: "s" }),
      getVerificationContractRevision: async (contractId, revision) => ({ contractId, revision, verificationTypes: ["reproduction"], contextModes: ["blind"] }),
      listVerificationReceiptsByActorRun: async () => [],
      insertVerificationReceipt: async (receipt) => receipt,
      insertVerificationFinding: async (finding) => finding,
      insertContributionStatement: async (statement) => statement,
      appendResearchEvent: async (event) => event,
    }),
    verificationEventFactory: eventFactory,
    verificationRoleResolver: async () => "contributor",
    ...AUTH,
  });
  const prepare = await app.fetch(new Request("https://api.example.test/verifications/prepare", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json" },
    body: JSON.stringify({ claimId: "claim-1", claimRevision: 2, contractId: "contract-1", contractRevision: 1, nonce: "nonce-0123456789abcdef" }),
  }), {});
  assert.equal(prepare.status, 200, await prepare.clone().text());
  const prepared = await prepare.json();
  assert.equal(prepared.eventType, "verification.submitted");
  assert.equal(prepared.payload.claim_revision, 2);
  const submit = await app.fetch(new Request("https://api.example.test/verifications", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json" },
    body: JSON.stringify({
      receiptId: "receipt-1", runId: "run-1", claimId: "claim-1", claimRevision: 2, contractId: "contract-1", contractRevision: 1,
      outcome: "supports", verificationTypes: ["reproduction"], contextMode: "blind", sawExpectedOutputs: false,
      implementationRelation: "independent", dataRelation: "same_input", modelFamily: "none",
      contributionStatementId: "statement-1",
      findings: [{ findingId: "finding-1", severity: "note", code: "match", details: {} }, { severity: "note", code: "derived" }],
    }),
  }), {});
  assert.equal(submit.status, 201, await submit.clone().text());
  const submitted = await submit.json();
  assert.equal(submitted.receipt.outcome, "supports");
  assert.equal(submitted.contribution.statementId, "statement-1");
  assert.deepEqual(submitted.findings.map((finding) => finding.findingId), ["finding-1", "receipt-1_finding_2"]);
});

test("creates and transitions a Challenge", async () => {
  const current = { challengeId: "challenge-1", revision: 1, state: "open", targetClaimId: "claim-1", targetClaimRevision: 2 };
  const app = createApp({
    repository: identityRepository({
      getClaimRevision: async (claimId, revision) => ({ claimId, revision, statement: "s" }),
      insertChallenge: async (challenge) => challenge,
      insertChallengeRevision: async (revision) => revision,
      getChallenge: async (challengeId) => ({ challengeId, createdBy: "actor-1" }),
      getCurrentChallengeRevision: async () => current,
      listChallengeImpacts: async () => [],
      listEvidenceForClaimRevision: async () => [],
      appendResearchEvent: async (event) => event,
    }),
    challengeEventFactory: eventFactory,
    challengeRoleResolver: async () => "maintainer",
    ...AUTH,
  });
  const created = await app.fetch(new Request("https://api.example.test/challenges", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json" },
    body: JSON.stringify({ challengeId: "challenge-1", targetClaimId: "claim-1", targetClaimRevision: 2, reason: "counterexample found", impact: { scope: "downstream" } }),
  }), {});
  assert.equal(created.status, 201, await created.clone().text());
  const detail = await (await app.fetch(new Request("https://api.example.test/challenges/challenge-1"), {})).json();
  const transition = await app.fetch(new Request("https://api.example.test/challenges/challenge-1/transitions", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json", "if-match": detail.etag },
    body: JSON.stringify({ toState: "admissible" }),
  }), {});
  assert.equal(transition.status, 201, await transition.clone().text());
  assert.equal((await transition.json()).revision.state, "admissible");
});

test("returns 401 for command routes without a bearer token", async () => {
  const app = createApp({
    repository: identityRepository(),
    claimEventFactory: eventFactory,
    claimRoleResolver: async () => "maintainer",
  });
  const response = await app.fetch(new Request("https://api.example.test/claims", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ claimId: "claim-1", statement: "s", scope: ["s"], falsification: ["f"] }),
  }), {});
  assert.equal(response.status, 401);
});
