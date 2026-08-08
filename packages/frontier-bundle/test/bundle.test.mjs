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
  const verification = verifyFrontierBundle(files);
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
  const result = verifyFrontierBundle(tampered);
  assert.equal(result.valid, false);
  assert.ok(result.findings.some((finding) => finding.includes("claims/claim_1.json")));

  const missingProof = { ...files };
  delete missingProof["proofs/event-1.json"];
  // Manifest still lists the proof → manifest file-missing finding.
  const missingResult = verifyFrontierBundle(missingProof);
  assert.equal(missingResult.valid, false);
});

test("zip bundle round-trips through the stored ZIP format", async () => {
  const repository = createSourceRepository();
  const { files, zip } = await exportFrontierBundle({ repository, snapshotId: "frontier_1", zip: true });
  assert.ok(zip instanceof Uint8Array);
  const unzipped = readZip(zip);
  assert.deepEqual(Object.keys(unzipped).sort(), Object.keys(files).sort());
  const verification = verifyFrontierBundle(Object.fromEntries(Object.entries(unzipped).map(([path, bytes]) => [path, new TextDecoder().decode(bytes)])));
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
