import test from "node:test";
import assert from "node:assert/strict";
import { runMirrorQueuePass, buildMirrorClientFromEnv, FRONTIER_PUBLISHED_EVENT_TYPE } from "../src/mirror-queue.mjs";
import { createMirrorWorker, MirrorWorkerError } from "../src/index.mjs";
import { createSourceRepository } from "../../../packages/frontier-bundle/test/helpers.mjs";

function queueRepository({ failMirror = false } = {}) {
  const source = createSourceRepository();
  const outboxState = { processed: [], retried: [], deadLettered: [], claimed: [] };
  const events = new Map([
    ["event-frontier", { eventId: "event-frontier", eventType: FRONTIER_PUBLISHED_EVENT_TYPE, payload: { snapshot_id: "frontier_1" } }],
    ["event-other", { eventId: "event-other", eventType: "claim.created", payload: {} }],
  ]);
  return {
    source,
    outboxState,
    events,
    getResearchEvent: async (eventId) => events.get(eventId) ?? null,
    getFrontierSnapshot: source.getFrontierSnapshot,
    listFrontierMembers: source.listFrontierMembers,
    getClaimRevision: source.getClaimRevision,
    listEvidenceForClaimRevision: source.listEvidenceForClaimRevision,
    getEvidence: source.getEvidence,
    getArtifactRevision: source.getArtifactRevision,
    listVerificationReceipts: source.listVerificationReceipts,
    getVerificationReceipt: source.getVerificationReceipt,
    listVerificationFindings: source.listVerificationFindings,
    listContributionEdgesForObject: source.listContributionEdgesForObject,
    listContributionStatementsByIds: source.listContributionStatementsByIds,
    listResearchEvents: source.listResearchEvents,
    getMerkleCheckpointForEvent: source.getMerkleCheckpointForEvent,
    listResearchEventRange: source.listResearchEventRange,
    getOtsProof: async () => null,
    insertMirrorReceipt: async (receipt) => { outboxState.mirrorReceipt = receipt; return receipt; },
    withTransaction: async (callback) => callback({}),
    claimPendingOutboxJobs: async ({ workerId, limit }) => {
      outboxState.claimed.push(workerId);
      return [
        { outboxId: "outbox-frontier", eventId: "event-frontier", status: "processing", attempts: 0, lockedAt: new Date().toISOString() },
        { outboxId: "outbox-other", eventId: "event-other", status: "processing", attempts: 0, lockedAt: new Date().toISOString() },
      ].slice(0, limit);
    },
    markOutboxProcessed: async ({ outboxId, processedAt }) => { outboxState.processed.push(outboxId); return { outboxId, status: "processed", processedAt }; },
    rescheduleOutboxJob: async ({ outboxId, attempts, lastError, availableAt }) => { outboxState.retried.push({ outboxId, attempts }); return { outboxId, status: "pending", attempts, lastError, availableAt }; },
    markOutboxDeadLetter: async ({ outboxId, attempts, lastError }) => { outboxState.deadLettered.push({ outboxId, attempts }); return { outboxId, status: "dead_letter", attempts, lastError }; },
    _failMirror: failMirror,
  };
}

function makeMirrorClient(repository) {
  return {
    createRelease: async ({ tag }) => {
      if (repository._failMirror) throw new Error("mirror down");
      return { releaseId: 1, url: `https://github.com/o/r/releases/tag/${tag}` };
    },
    uploadAsset: async ({ releaseId, fileName }) => ({ assetId: 2, url: `https://github.com/o/r/download/${fileName}`, sha256: `${"a".repeat(64)}`, sizeBytes: 10 }),
  };
}

test("buildMirrorClientFromEnv returns null without a token and a client with one", () => {
  assert.equal(buildMirrorClientFromEnv({}), null);
  assert.equal(buildMirrorClientFromEnv({ GITHUB_MIRROR_TOKEN: "" }), null);
  const client = buildMirrorClientFromEnv({ GITHUB_MIRROR_TOKEN: "token", GITHUB_MIRROR_OWNER: "o", GITHUB_MIRROR_REPO: "r" });
  assert.equal(typeof client.createRelease, "function");
  assert.equal(typeof client.uploadAsset, "function");
});

test("queue pass mirrors frontier jobs and requeues non-frontier jobs", async () => {
  const repository = queueRepository();
  const result = await runMirrorQueuePass({ repository, mirrorClient: makeMirrorClient(repository), workerId: "w1", limit: 10 });
  assert.equal(result.processed, 2);
  const mirrored = result.results.find((r) => r.outboxId === "outbox-frontier");
  const skipped = result.results.find((r) => r.outboxId === "outbox-other");
  assert.equal(mirrored.mirrored, true);
  assert.equal(skipped.skipped, true);
  assert.deepEqual(repository.outboxState.processed, ["outbox-frontier"]);
  assert.deepEqual(repository.outboxState.retried.map((r) => r.outboxId), ["outbox-other"]);
});

test("queue pass requeues frontier jobs when the mirror client is not configured", async () => {
  const repository = queueRepository();
  const result = await runMirrorQueuePass({ repository, mirrorClient: null, workerId: "w2", limit: 10 });
  const frontier = result.results.find((r) => r.outboxId === "outbox-frontier");
  assert.equal(frontier.skipped, true);
  assert.equal(frontier.reason, "mirror client not configured");
  assert.equal(repository.outboxState.processed.length, 0);
});

test("createMirrorWorker requires a claim-capable repository and runs a pass", async () => {
  assert.throws(() => createMirrorWorker({}), MirrorWorkerError);
  const repository = queueRepository();
  repository.env = { GITHUB_MIRROR_TOKEN: "token", GITHUB_MIRROR_OWNER: "o", GITHUB_MIRROR_REPO: "r" };
  const worker = createMirrorWorker({ repository });
  assert.equal(typeof worker.scheduled, "function");
  assert.equal(typeof worker.queue, "function");
});
