import test from "node:test";
import assert from "node:assert/strict";
import { exportFrontierBundle } from "../src/exporter.mjs";
import { verifyFrontierBundle } from "../src/verify.mjs";
import { precheckBundleImport, importFrontierBundle } from "../src/importer.mjs";
import { createSourceRepository, createTargetRepository } from "./helpers.mjs";

test("precheck reports no conflicts against an empty instance", async () => {
  const source = createSourceRepository();
  const target = createTargetRepository();
  const { files } = await exportFrontierBundle({ repository: source, snapshotId: "frontier_1" });
  const precheck = await precheckBundleImport({ repository: target, files });
  assert.equal(precheck.ok, true);
  assert.equal(precheck.claimCount, 2);
  assert.equal(precheck.evidenceCount, 1);
  assert.equal(precheck.receiptCount, 1);
});

test("import restores the frontier into an empty instance", async () => {
  const source = createSourceRepository();
  const target = createTargetRepository();
  const { files } = await exportFrontierBundle({ repository: source, snapshotId: "frontier_1" });
  const result = await importFrontierBundle({ repository: target, files });
  assert.equal(result.imported, true);
  assert.equal(result.claims, 2);
  assert.equal(result.evidence, 1);
  assert.equal(result.receipts, 1);
  assert.equal(result.checkpoints, 1);
  assert.equal(target.state.claims.size, 2);
  assert.equal(target.state.claimRevisions.size, 2);
  assert.equal(target.state.evidence.size, 1);
  assert.equal(target.state.receipts.size, 1);
  assert.equal(target.state.statements.size, 3);
  assert.equal(target.state.edges.length, 3);
  assert.equal(target.state.events.length, 2);
  assert.equal(target.state.checkpoints.size, 1);
  assert.equal(target.state.members.length, 2);
  assert.ok(target.state.snapshots.has("frontier_1"));
});

test("import refuses when conflicts exist and writes nothing", async () => {
  const source = createSourceRepository();
  const target = createTargetRepository();
  const { files } = await exportFrontierBundle({ repository: source, snapshotId: "frontier_1" });
  await importFrontierBundle({ repository: target, files });
  await assert.rejects(
    importFrontierBundle({ repository: target, files }),
    (error) => error.code === "BUNDLE_IMPORT_CONFLICT" && error.conflicts.length > 0,
  );
});

test("precheck surfaces a tampered bundle before import", async () => {
  const source = createSourceRepository();
  const target = createTargetRepository();
  const { files } = await exportFrontierBundle({ repository: source, snapshotId: "frontier_1" });
  const bad = { ...files };
  const claim = JSON.parse(bad["claims/claim_1.json"]);
  claim.claimRevision.statement = "tampered";
  bad["claims/claim_1.json"] = JSON.stringify(claim);
  await assert.rejects(
    precheckBundleImport({ repository: target, files: bad }),
    /offline verification/,
  );
});

test("disaster recovery: frontier recovered from bundle re-exports identically", async () => {
  const source = createSourceRepository();
  const { files } = await exportFrontierBundle({ repository: source, snapshotId: "frontier_1" });

  const recovered = createTargetRepository();
  await importFrontierBundle({ repository: recovered, files });

  // Rebuild a source-shaped repository over the restored state.
  const restored = {
    getFrontierSnapshot: recovered.getFrontierSnapshot,
    listFrontierMembers: async (snapshotId) => recovered.state.members
      .filter((m) => m.snapshotId === snapshotId)
      .map(({ snapshotId: _ignored, ...member }) => member),
    getClaimRevision: recovered.getClaimRevision,
    listEvidenceForClaimRevision: async (claimId, revision) => recovered.state.evidenceLinks.filter((l) => l.claimId === claimId && l.claimRevision === revision).map((l) => ({ evidenceId: l.evidenceId })),
    getEvidence: recovered.getEvidence,
    getArtifactRevision: async () => ({ artifactId: "artifact_1", revision: 1, rawHash: `sha256:${"a".repeat(64)}`, sizeBytes: 128, mediaType: "text/csv" }),
    listVerificationReceipts: async ({ claimId }) => [...recovered.state.receipts.values()].filter((r) => r.claimId === claimId),
    getVerificationReceipt: recovered.getVerificationReceipt,
    listVerificationFindings: async (receiptId) => recovered.state.findings.filter((f) => f.receiptId === receiptId),
    listContributionEdgesForObject: async (objectType, objectId) => recovered.state.edges.filter((e) => e.objectType === objectType && e.objectId === objectId),
    listContributionStatementsByIds: async (ids) => ids.map((id) => recovered.state.statements.get(id)).filter(Boolean),
    listResearchEvents: async ({ objectId }) => recovered.state.events.filter((e) => e.payload.claim_id === objectId),
    getMerkleCheckpointForEvent: async () => [...recovered.state.checkpoints.values()][0] ?? null,
    listResearchEventRange: async ({ firstEventId, lastEventId }) => {
      const events = recovered.state.events;
      const start = events.findIndex((e) => (e.eventId ?? e.event_id) === firstEventId);
      const end = events.findIndex((e) => (e.eventId ?? e.event_id) === lastEventId);
      return start < 0 || end < 0 ? [] : events.slice(start, end + 1);
    },
    getOtsProof: async () => null,
  };

  const reexport = await exportFrontierBundle({ repository: restored, snapshotId: "frontier_1" });
  const verification = verifyFrontierBundle(reexport.files);
  assert.equal(verification.valid, true, verification.findings.join("; "));
  assert.equal(reexport.manifest.projectId, "project_1");
  assert.equal(reexport.manifest.sequence, 3);
  assert.deepEqual(
    reexport.files["claims/claim_1.json"],
    files["claims/claim_1.json"],
  );
});
