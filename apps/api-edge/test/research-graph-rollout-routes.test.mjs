import test from "node:test";
import assert from "node:assert/strict";
import { createApp, createWorker } from "../src/index.mjs";
import { canonicalJson, rawHash } from "../../../packages/protocol/src/hash.mjs";
import { generateEd25519KeyPair } from "../../../packages/signatures/src/ed25519.mjs";
import { signEd25519Payload } from "../../../packages/signatures/src/client-signature.mjs";

const AUTH = { authenticate: async () => ({ sub: "subject-1" }) };
const eventFactory = async ({ eventType, payload }) => ({ eventType, payload });

test("compatibility routes select kernel-backed old shapes only after the cutover gate", async () => {
  const legacyCalls = [];
  const kernelCalls = [];
  const repository = {
    getClaimDownstreamGraph: async () => { legacyCalls.push("claim"); return []; },
    getEvidence: async () => { legacyCalls.push("evidence"); return null; },
    getChallenge: async () => { legacyCalls.push("challenge"); return null; },
    listVerificationReceipts: async () => { legacyCalls.push("receipt-list"); return []; },
    getVerificationReceipt: async () => { legacyCalls.push("receipt"); return null; },
    getLegacyClaimGraphFromResearchGraph: async () => {
      kernelCalls.push("claim");
      return { rootClaimId: "claim-1", maxDepth: 3, nodes: [{ claimId: "claim-kernel" }], edges: [], truncated: false, permissionPartial: false };
    },
    getLegacyEvidenceFromResearchGraph: async () => {
      kernelCalls.push("evidence");
      return { evidence: { evidenceId: "evidence-1" }, claimLinks: [], permissionPartial: false };
    },
    getLegacyChallengeFromResearchGraph: async () => {
      kernelCalls.push("challenge");
      return {
        challenge: { challengeId: "challenge-1" },
        currentRevision: { challengeId: "challenge-1", revision: 1, state: "open" },
        statusPolicy: { state: "open", allowedTransitions: [] }, impacts: [], linkedEvidence: [], permissionPartial: false,
      };
    },
    listLegacyClaimVerificationsFromResearchGraph: async () => {
      kernelCalls.push("receipt-list");
      return [{ receiptId: "receipt-1", claimId: "claim-1", claimRevision: 1 }];
    },
    getLegacyVerificationReceiptFromResearchGraph: async () => {
      kernelCalls.push("receipt");
      return { receipt: { receiptId: "receipt-1", claimId: "claim-1", claimRevision: 1 }, findings: [], permissionPartial: false };
    },
  };
  const app = createApp({
    repository,
    researchGraphRollout: { readMode: "kernel", writeMode: "kernel", cutoverReady: true },
  });

  const claim = await app.fetch(new Request("https://api.example.test/claims/claim-1/graph"), {});
  const evidence = await app.fetch(new Request("https://api.example.test/evidence/evidence-1"), {});
  const challenge = await app.fetch(new Request("https://api.example.test/challenges/challenge-1"), {});
  const list = await app.fetch(new Request("https://api.example.test/claims/claim-1/verifications"), {});
  const receipt = await app.fetch(new Request("https://api.example.test/verifications/receipt-1"), {});

  assert.equal(claim.status, 200);
  assert.equal((await claim.json()).nodes[0].claimId, "claim-kernel");
  assert.equal((await evidence.json()).evidence.evidenceId, "evidence-1");
  assert.equal((await challenge.json()).challenge.challengeId, "challenge-1");
  assert.equal((await list.json()).items[0].receiptId, "receipt-1");
  assert.equal((await receipt.json()).receipt.receiptId, "receipt-1");
  assert.deepEqual(kernelCalls, ["claim", "evidence", "challenge", "receipt-list", "receipt"]);
  assert.deepEqual(legacyCalls, []);
});

test("shadow route keeps the old Claim response authoritative and emits parity internally", async () => {
  const reports = [];
  const repository = {
    getClaimDownstreamGraph: async () => [{ claimId: "legacy-child" }],
    getLegacyClaimGraphFromResearchGraph: async () => ({
      rootClaimId: "claim-1", maxDepth: 3,
      nodes: [{ claimId: "kernel-child" }], edges: [], truncated: false, permissionPartial: false,
    }),
  };
  const app = createApp({
    repository,
    researchGraphRollout: {
      readMode: "shadow", writeMode: "legacy", cutoverReady: false,
      onParity: async (report) => reports.push(report),
    },
  });

  const response = await app.fetch(new Request("https://api.example.test/claims/claim-1/graph"), {});
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.nodes[0].claimId, "legacy-child");
  assert.equal(reports.length, 1);
  assert.equal(reports[0].surface, "claim_graph");
  assert.equal(reports[0].matches, false);
  assert.doesNotMatch(JSON.stringify(body), /parity|missingKernel|kernel-child/);
});

test("a legacy Claim route in dual-write mode shares one transaction and requires parity", async () => {
  const sequence = [];
  const transaction = {
    insertClaim: async (claim) => { sequence.push("legacy.claim"); return claim; },
    insertClaimRevision: async (revision) => { sequence.push("legacy.revision"); return revision; },
    appendResearchEvent: async (event) => { sequence.push("legacy.event"); return event; },
  };
  const repository = {
    findIdentity: async () => ({ actorId: "human-1" }),
    getActor: async () => ({ actorId: "human-1", actorType: "human" }),
    withTransaction: async (callback) => { sequence.push("transaction.begin"); return callback(transaction); },
    mirrorLegacyResearchMutationToKernel: async ({ transaction: used, surface, input }) => {
      assert.equal(used, transaction);
      assert.equal(surface, "claim.create");
      assert.equal(input.claimId, "claim-1");
      sequence.push("kernel.mirror");
      return { claimId: input.claimId, revision: 1 };
    },
    assertLegacyResearchMutationParity: async ({ surface, legacy, kernel }) => {
      assert.equal(surface, "claim.create");
      assert.equal(legacy.claim.claimId, kernel.claimId);
      sequence.push("parity");
      return true;
    },
  };
  const app = createApp({
    repository,
    claimEventFactory: eventFactory,
    claimRoleResolver: async () => "maintainer",
    researchGraphRollout: {
      readMode: "legacy", writeMode: "dual_write", cutoverReady: false,
      verifyResearchEvent: async () => true,
    },
    ...AUTH,
  });
  const response = await app.fetch(new Request("https://api.example.test/claims", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json" },
    body: JSON.stringify({
      claimId: "claim-1", questionId: "question-1", statement: "A testable claim.",
      scope: ["dataset"], assumptions: [], falsification: ["A failed reproduction"],
    }),
  }), {});

  assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
  assert.equal((await response.json()).claim.claimId, "claim-1");
  assert.deepEqual(sequence, ["transaction.begin", "legacy.claim", "legacy.revision", "legacy.event", "kernel.mirror", "parity"]);
});

test("Claim route can execute the production single-RPC dual-write path with a verified event", async () => {
  const calls = [];
  const repository = {
    findIdentity: async () => ({ actorId: "human-1" }),
    getActor: async () => ({ actorId: "human-1", actorType: "human" }),
    executeLegacyResearchMutationDualWrite: async (request) => {
      calls.push(request);
      return { legacy: request.expectedLegacy, kernel: { nodeId: request.command.claimId }, parity: true };
    },
  };
  const signedEventFactory = async ({ eventType, payload }) => ({
    eventId: "01993f21-16f8-7f01-8e42-0123456789ab",
    eventType,
    payload,
    hash: `sha256:${"a".repeat(64)}`,
    signature: { algorithm: "Ed25519", key_id: "human-key", value: "external-signature" },
    parents: [],
  });
  const app = createApp({
    repository,
    claimEventFactory: signedEventFactory,
    claimRoleResolver: async () => "maintainer",
    researchGraphRollout: {
      readMode: "legacy", writeMode: "dual_write", cutoverReady: false,
      verifyResearchEvent: async () => true,
    },
    ...AUTH,
  });
  const response = await app.fetch(new Request("https://api.example.test/claims", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json" },
    body: JSON.stringify({
      claimId: "claim-rpc", questionId: "question-1", statement: "A signed claim.",
      scope: ["dataset"], assumptions: [], falsification: ["A failed reproduction"],
    }),
  }), {});

  assert.equal(response.status, 201, JSON.stringify(await response.clone().json()));
  assert.equal((await response.json()).claim.claimId, "claim-rpc");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].mutationKind, "claim.create");
  assert.equal(calls[0].verifiedEvents[0].eventType, "claim.created");
  assert.equal(calls[0].expectedLegacy.revision.revision, 1);
});

test("Claim RPC dual-write uses the default real public-key verifier after nonce consumption", async () => {
  const keyPair = generateEd25519KeyPair();
  const requestBody = {
    claimId: "claim-real-signature",
    questionId: "question-1",
    statement: "A cryptographically signed claim.",
    scope: ["dataset"],
    assumptions: [],
    falsification: ["A failed reproduction"],
  };
  const nonce = "nonce-rpc-real-01234567";
  const signingText = canonicalJson({ event_type: "claim.created", payload: requestBody, nonce });
  const envelope = {
    schema: "srp.client-signature-envelope.v1",
    event_type: "claim.created",
    payload: requestBody,
    nonce,
    signing_bytes_hash: `sha256:${rawHash(signingText)}`,
    signature: {
      algorithm: "Ed25519",
      key_id: "human-key",
      value: await signEd25519Payload({ signingBytes: new TextEncoder().encode(signingText), privateKey: keyPair.private_key }),
    },
  };
  let rpcRequest = null;
  const repository = {
    findIdentity: async () => ({ actorId: "human-1" }),
    getActor: async () => ({ actorId: "human-1", actorType: "human" }),
    findActiveSigningKey: async () => ({
      keyId: "human-key", actorId: "human-1", algorithm: "Ed25519",
      publicKey: keyPair.public_key, revokedAt: null, deletedAt: null,
    }),
    claimSignatureNonce: async () => true,
    executeLegacyResearchMutationDualWrite: async (request) => {
      rpcRequest = request;
      return { legacy: request.expectedLegacy, kernel: { nodeId: request.command.claimId }, parity: true };
    },
  };
  const signedEventFactory = async ({ eventType, payload }) => ({
    eventId: "01993f21-16f8-7f01-8e42-0123456789ab",
    eventType,
    payload,
    hash: `sha256:${"b".repeat(64)}`,
    signature: { algorithm: "Ed25519", key_id: "event-key", value: "event-factory-signature" },
    parents: [],
  });
  const app = createApp({
    repository,
    claimEventFactory: signedEventFactory,
    claimRoleResolver: async () => "maintainer",
    researchGraphRollout: { readMode: "legacy", writeMode: "dual_write", cutoverReady: false },
    ...AUTH,
  });
  const response = await app.fetch(new Request("https://api.example.test/claims", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json" },
    body: JSON.stringify({ ...requestBody, signatureEnvelope: envelope }),
  }), {});

  assert.equal(response.status, 201, await response.clone().text());
  assert.equal(rpcRequest.command.clientSignatureVerified, true);
  assert.deepEqual(rpcRequest.verifiedEvents[0].payload.publisher_signature_envelope, envelope);
  assert.notEqual(rpcRequest.verifiedEvents[0].hash, envelope.signing_bytes_hash);
});

test("default RPC verifier rejects confirm-like unsigned legacy mutations before the service transaction", async () => {
  let rpcCalls = 0;
  const repository = {
    findIdentity: async () => ({ actorId: "human-1" }),
    getActor: async () => ({ actorId: "human-1", actorType: "human" }),
    executeLegacyResearchMutationDualWrite: async () => { rpcCalls += 1; throw new Error("must not run"); },
  };
  const app = createApp({
    repository,
    claimEventFactory: async ({ eventType, payload }) => ({
      eventId: "01993f21-16f8-7f01-8e42-0123456789ab",
      eventType,
      payload,
      hash: `sha256:${"c".repeat(64)}`,
      signature: { algorithm: "Ed25519", key_id: "event-key", value: "event-signature" },
      parents: [],
    }),
    claimRoleResolver: async () => "maintainer",
    researchGraphRollout: { readMode: "legacy", writeMode: "dual_write", cutoverReady: false },
    ...AUTH,
  });
  const response = await app.fetch(new Request("https://api.example.test/claims", {
    method: "POST",
    headers: { authorization: "Bearer test-token", "content-type": "application/json" },
    body: JSON.stringify({
      claimId: "claim-unsigned", statement: "Unsigned.", scope: ["dataset"],
      assumptions: [], falsification: ["A failed reproduction"], confirm: true,
    }),
  }), {});

  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, "RESEARCH_GRAPH_EXTERNAL_SIGNATURE_REQUIRED");
  assert.equal(rpcCalls, 0);
});

test("hosted Worker rejects invalid rollout bindings before touching Supabase", async () => {
  let upstreamCalls = 0;
  const worker = createWorker({ fetchImpl: async () => { upstreamCalls += 1; return Response.json([]); } });
  const response = await worker.fetch(new Request("https://api.example.test/questions"), {
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    RESEARCH_GRAPH_READ_MODE: "kernel",
    RESEARCH_GRAPH_WRITE_MODE: "legacy",
    RESEARCH_GRAPH_CUTOVER_READY: "true",
  });

  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "RESEARCH_GRAPH_ROLLOUT_INVALID");
  assert.match(response.headers.get("x-request-id"), /^[0-9a-f-]{36}$/);
  assert.equal(upstreamCalls, 0);
});
