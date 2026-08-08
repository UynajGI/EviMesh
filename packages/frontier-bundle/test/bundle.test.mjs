import test from "node:test";
import assert from "node:assert/strict";
import { exportFrontierBundle } from "../src/exporter.mjs";
import { verifyFrontierBundle } from "../src/verify.mjs";
import { parseManifest } from "../src/manifest.mjs";
import { readZip } from "../src/zip.mjs";
import { BUNDLE_FILES } from "../src/spec.mjs";
import { createSourceRepository } from "./helpers.mjs";

test("exports a complete frontier bundle with manifest, checksums, and report", async () => {
  const repository = createSourceRepository();
  const { files, manifest } = await exportFrontierBundle({ repository, snapshotId: "frontier_1" });

  assert.equal(manifest.projectId, "project_1");
  assert.equal(manifest.sequence, 3);
  assert.ok(files[BUNDLE_FILES.manifest]);
  assert.ok(files[BUNDLE_FILES.checksums]);
  assert.ok(files[BUNDLE_FILES.report]);
  assert.ok(files[BUNDLE_FILES.frontier]);
  assert.ok(files[BUNDLE_FILES.contributions]);
  assert.ok(files["claims/claim_1.json"]);
  assert.ok(files["claims/claim_2.json"]);
  assert.ok(files["evidence/evidence_1.json"]);
  assert.ok(files["verification-receipts/receipt_1.json"]);
  assert.ok(!files["verification-receipts/receipt_2.json"], "receipts pinned to other revisions must not be exported");
  assert.ok(files["artifacts-manifest.json"]);
  assert.ok(files["events.ndjson"]);
  assert.ok(files["checkpoints/checkpoint_event-1.json"]);
  assert.ok(files["proofs/event-1.json"]);

  const artifacts = JSON.parse(files["artifacts-manifest.json"]);
  assert.equal(artifacts.artifacts[0].artifactId, "artifact_1");
  assert.equal(artifacts.artifacts[0].rawHash, `sha256:${"a".repeat(64)}`);

  const claimFile = JSON.parse(files["claims/claim_1.json"]);
  assert.equal(claimFile.claimRevision.revision, 2);
  assert.equal(claimFile.member.membershipType, "core");

  const contributions = JSON.parse(files[BUNDLE_FILES.contributions]);
  assert.equal(contributions.statements.length, 3);
  assert.equal(contributions.edges.length, 3);

  const events = files["events.ndjson"].trim().split("\n");
  assert.equal(events.length, 2);
});

test("the exported bundle verifies offline and the report lists blockers", async () => {
  const repository = createSourceRepository();
  const { files, report } = await exportFrontierBundle({ repository, snapshotId: "frontier_1" });
  const verification = await verifyFrontierBundle(files);
  assert.equal(verification.valid, true, verification.findings.join("; "));
  assert.match(report, /Open blockers/);
  assert.match(report, /claim_2@1/);
  assert.match(report, /accepted: 1/);
});

test("offline verification catches tampered files and missing proofs", async () => {
  const repository = createSourceRepository();
  const { files } = await exportFrontierBundle({ repository, snapshotId: "frontier_1" });

  const tampered = { ...files };
  const claim = JSON.parse(tampered["claims/claim_1.json"]);
  claim.claimRevision.statement = "tampered statement";
  tampered["claims/claim_1.json"] = JSON.stringify(claim);
  const result = await verifyFrontierBundle(tampered);
  assert.equal(result.valid, false);
  assert.ok(result.findings.some((finding) => finding.includes("claims/claim_1.json")));

  const missingProof = { ...files };
  delete missingProof["proofs/event-1.json"];
  // Manifest still lists the proof → manifest file-missing finding.
  const missingResult = await verifyFrontierBundle(missingProof);
  assert.equal(missingResult.valid, false);
  // The exported event left without a proof must also be flagged, so a producer
  // cannot drop a proof and pass by regenerating manifest/checksums.
  assert.ok(missingResult.findings.some((finding) => finding.includes("exported event has no inclusion proof")));
});

test("zip bundle round-trips through the stored ZIP format", async () => {
  const repository = createSourceRepository();
  const { files, zip } = await exportFrontierBundle({ repository, snapshotId: "frontier_1", zip: true });
  assert.ok(zip instanceof Uint8Array);
  const unzipped = readZip(zip);
  assert.deepEqual(Object.keys(unzipped).sort(), Object.keys(files).sort());
  // verifyFrontierBundle accepts readZip's Uint8Array entries directly.
  const verification = await verifyFrontierBundle(unzipped);
  assert.equal(verification.valid, true, verification.findings.join("; "));
});

test("export rejects unknown snapshots and empty frontiers", async () => {
  const repository = createSourceRepository();
  await assert.rejects(
    exportFrontierBundle({ repository, snapshotId: "nope" }),
    (error) => error.code === "FRONTIER_SNAPSHOT_NOT_FOUND",
  );
  repository.listFrontierMembers = async () => [];
  await assert.rejects(
    exportFrontierBundle({ repository, snapshotId: "frontier_1" }),
    (error) => error.code === "FRONTIER_EMPTY",
  );
});

test("manifest parsing validates structure", () => {
  assert.throws(() => parseManifest({ schema: "wrong" }), /schema must be/);
  assert.throws(() => parseManifest(null), /manifest must be an object/);
});

test("preserves every evidence-claim link with relationType and createdBy", async () => {
  const repository = createSourceRepository();
  // evidence_1 is linked to BOTH frontier claims with different relations.
  repository.listEvidenceForClaimRevision = async (claimId, revision) => {
    if (claimId === "claim_1" && revision === 2) return [{ evidenceId: "evidence_1", relationType: "supports", createdBy: "actor_2" }];
    if (claimId === "claim_2" && revision === 1) return [{ evidenceId: "evidence_1", relationType: "qualifies", createdBy: "actor_3" }];
    return [];
  };
  const { files } = await exportFrontierBundle({ repository, snapshotId: "frontier_1" });
  const evidenceDoc = JSON.parse(files["evidence/evidence_1.json"]);
  assert.equal(evidenceDoc.links.length, 2);
  const byClaim = Object.fromEntries(evidenceDoc.links.map((link) => [link.claimId, link]));
  assert.equal(byClaim.claim_1.relationType, "supports");
  assert.equal(byClaim.claim_1.createdBy, "actor_2");
  assert.equal(byClaim.claim_2.relationType, "qualifies");
  assert.equal(byClaim.claim_2.createdBy, "actor_3");
});

test("flags a frontier member that has no claim document", async () => {
  const repository = createSourceRepository();
  const { files } = await exportFrontierBundle({ repository, snapshotId: "frontier_1" });
  const withoutClaim = { ...files };
  delete withoutClaim["claims/claim_2.json"];
  const result = await verifyFrontierBundle(withoutClaim);
  assert.equal(result.valid, false);
  assert.ok(result.findings.some((finding) => finding.includes("frontier member has no claim document")));
});

test("flags a proof whose leaf does not match the exported event", async () => {
  const repository = createSourceRepository();
  const { files } = await exportFrontierBundle({ repository, snapshotId: "frontier_1" });
  const tamperedEvent = { ...files };
  const eventLines = tamperedEvent[BUNDLE_FILES.events].trim().split("\n");
  const firstEvent = JSON.parse(eventLines[0]);
  firstEvent.payload = { claim_id: "claim_1", tampered: true };
  eventLines[0] = JSON.stringify(firstEvent);
  tamperedEvent[BUNDLE_FILES.events] = `${eventLines.join("\n")}\n`;
  const result = await verifyFrontierBundle(tamperedEvent);
  assert.equal(result.valid, false);
  assert.ok(result.findings.some((finding) => finding.includes("proof leaf does not match exported event")));
});
