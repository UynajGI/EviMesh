import test from "node:test";
import assert from "node:assert/strict";
import { processFrontierMirrorJob, resolveFrontierSnapshotForEvent, MirrorReleaseError } from "../src/mirror-release-worker.mjs";
import { createSourceRepository } from "../../../packages/frontier-bundle/test/helpers.mjs";

function mirrorRepository({ failMirror = false } = {}) {
  const source = createSourceRepository();
  const outboxState = { processed: [], retried: [], deadLettered: [] };
  return {
    source,
    outboxState,
    getResearchEvent: async (eventId) => (eventId === "event-frontier" ? { eventId, payload: { entity_type: "frontier_snapshot", snapshot_id: "frontier_1" } } : null),
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

test("resolves the frontier snapshot from the outbox event", async () => {
  const repository = mirrorRepository();
  const snapshot = await resolveFrontierSnapshotForEvent({ repository, eventId: "event-frontier" });
  assert.equal(snapshot.snapshotId, "frontier_1");
  await assert.rejects(resolveFrontierSnapshotForEvent({ repository, eventId: "nope" }), (e) => e.code === "MIRROR_RELEASE_EVENT_NOT_FOUND");
});

test("mirrors the bundle and acknowledges the job on success", async () => {
  const repository = mirrorRepository();
  const result = await processFrontierMirrorJob({
    repository,
    outboxId: "outbox-1",
    eventId: "event-frontier",
    attempts: 0,
    mirrorClient: makeMirrorClient(repository),
  });
  assert.equal(result.mirrored, true);
  assert.equal(result.snapshotId, "frontier_1");
  assert.match(result.releaseUrl, /releases\/tag\/frontier\/project_1\/3/);
  assert.deepEqual(repository.outboxState.processed, ["outbox-1"]);
  assert.equal(repository.outboxState.mirrorReceipt.frontierSnapshotId, "frontier_1");
});

test("schedules a retry when mirroring fails below max attempts", async () => {
  const repository = mirrorRepository({ failMirror: true });
  const result = await processFrontierMirrorJob({
    repository,
    outboxId: "outbox-2",
    eventId: "event-frontier",
    attempts: 2,
    maxAttempts: 10,
    mirrorClient: makeMirrorClient(repository),
  });
  assert.equal(result.mirrored, false);
  assert.equal(result.retryScheduled, true);
  assert.equal(result.attempts, 3);
  assert.equal(repository.outboxState.retried.length, 1);
  assert.equal(repository.outboxState.retried[0].attempts, 3);
  assert.equal(repository.outboxState.deadLettered.length, 0);
});

test("dead-letters the job at the attempt ceiling", async () => {
  const repository = mirrorRepository({ failMirror: true });
  const result = await processFrontierMirrorJob({
    repository,
    outboxId: "outbox-3",
    eventId: "event-frontier",
    attempts: 9,
    maxAttempts: 10,
    mirrorClient: makeMirrorClient(repository),
  });
  assert.equal(result.mirrored, false);
  assert.equal(result.deadLettered, true);
  assert.equal(repository.outboxState.deadLettered.length, 1);
  assert.equal(repository.outboxState.retried.length, 0);
});

test("requires a mirror client and a valid event", async () => {
  const repository = mirrorRepository();
  await assert.rejects(
    processFrontierMirrorJob({ repository, outboxId: "o", eventId: "event-frontier", attempts: 0 }),
    (e) => e.code === "MIRROR_RELEASE_CLIENT_INVALID",
  );
  await assert.rejects(
    processFrontierMirrorJob({ repository, outboxId: "o", eventId: "missing-event", attempts: 0, mirrorClient: makeMirrorClient(repository) }),
    (e) => e.code === "MIRROR_RELEASE_EVENT_NOT_FOUND",
  );
  assert.ok(MirrorReleaseError);
});
