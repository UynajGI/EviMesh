/**
 * Frontier Bundle directory specification (M12-01).
 *
 * A bundle is a content-addressed directory snapshot of one published
 * Frontier plus every object needed to verify it offline:
 *
 *   manifest.json                      bundle manifest (files, hashes, roles)
 *   checksums.txt                      SHA-256 of every file in the bundle
 *   report.md                          human-readable frontier report
 *   frontier.json                      the FrontierSnapshot and its members
 *   claims/<claimId>.json              one fixed Claim revision per member
 *   evidence/<evidenceId>.json         referenced Evidence objects
 *   artifacts-manifest.json            hash/size/role for referenced artifacts
 *   verification-receipts/<id>.json    receipts the frontier depends on
 *   contributions.json                 contribution statements and edges
 *   events.ndjson                      research events for the exported objects
 *   checkpoints/<checkpointId>.json    Merkle checkpoints (+ OTS proof)
 *   proofs/<eventId>.json              Merkle inclusion proofs per event
 *   prerequisites.json                 reference rows (project/actors/artifacts/…)
 *                                      needed to import into an empty instance
 */

export const BUNDLE_SCHEMA = "evimesh.frontier-bundle.v1";

export const BUNDLE_FILES = Object.freeze({
  manifest: "manifest.json",
  checksums: "checksums.txt",
  report: "report.md",
  frontier: "frontier.json",
  contributions: "contributions.json",
  events: "events.ndjson",
  artifactsManifest: "artifacts-manifest.json",
  prerequisites: "prerequisites.json",
});

export const BUNDLE_DIRECTORIES = Object.freeze({
  claims: "claims",
  evidence: "evidence",
  verificationReceipts: "verification-receipts",
  checkpoints: "checkpoints",
  proofs: "proofs",
});

export const FILE_ROLES = Object.freeze([
  "manifest",
  "checksums",
  "report",
  "frontier",
  "claim",
  "evidence",
  "artifacts-manifest",
  "verification-receipt",
  "contributions",
  "events",
  "checkpoint",
  "proof",
  "prerequisites",
]);

export function claimFilePath(claimId) {
  return `${BUNDLE_DIRECTORIES.claims}/${claimId}.json`;
}

export function evidenceFilePath(evidenceId) {
  return `${BUNDLE_DIRECTORIES.evidence}/${evidenceId}.json`;
}

export function receiptFilePath(receiptId) {
  return `${BUNDLE_DIRECTORIES.verificationReceipts}/${receiptId}.json`;
}

export function checkpointFilePath(checkpointId) {
  return `${BUNDLE_DIRECTORIES.checkpoints}/${checkpointId}.json`;
}

export function proofFilePath(eventId) {
  return `${BUNDLE_DIRECTORIES.proofs}/${eventId}.json`;
}

export function roleForPath(path) {
  if (path === BUNDLE_FILES.manifest) return "manifest";
  if (path === BUNDLE_FILES.checksums) return "checksums";
  if (path === BUNDLE_FILES.report) return "report";
  if (path === BUNDLE_FILES.frontier) return "frontier";
  if (path === BUNDLE_FILES.contributions) return "contributions";
  if (path === BUNDLE_FILES.events) return "events";
  if (path === BUNDLE_FILES.artifactsManifest) return "artifacts-manifest";
  if (path === BUNDLE_FILES.prerequisites) return "prerequisites";
  if (path.startsWith(`${BUNDLE_DIRECTORIES.claims}/`)) return "claim";
  if (path.startsWith(`${BUNDLE_DIRECTORIES.evidence}/`)) return "evidence";
  if (path.startsWith(`${BUNDLE_DIRECTORIES.verificationReceipts}/`)) return "verification-receipt";
  if (path.startsWith(`${BUNDLE_DIRECTORIES.checkpoints}/`)) return "checkpoint";
  if (path.startsWith(`${BUNDLE_DIRECTORIES.proofs}/`)) return "proof";
  return null;
}
