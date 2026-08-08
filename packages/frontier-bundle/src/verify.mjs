import { parseManifest, sha256Hex } from "./manifest.mjs";
import { parseChecksums } from "./checksums.mjs";
import { BUNDLE_FILES, roleForPath } from "./spec.mjs";
import { verifyMerkleInclusionProof } from "../../merkle/src/verify-inclusion-proof.mjs";
import { verifyMerkleCheckpoint } from "../../signatures/src/merkle-checkpoint.mjs";

export class BundleVerifyError extends Error {
  constructor(message, code = "BUNDLE_VERIFY_FAILED") {
    super(message);
    this.name = "BundleVerifyError";
    this.code = code;
  }
}

function toBytes(content) {
  return typeof content === "string" ? new TextEncoder().encode(content) : content;
}

function parseJson(files, path) {
  try {
    return JSON.parse(files[path]);
  } catch (error) {
    throw new BundleVerifyError(`bundle file ${path} is not valid JSON: ${error.message}`);
  }
}

/**
 * Offline-verify a frontier bundle (M12-12). Works without network access.
 * `files` maps bundle-relative paths to string or Uint8Array contents.
 * Options: platformKey (verify checkpoint signatures), requireProofs (every
 * exported event must carry an inclusion proof bound to a checkpoint).
 */
export function verifyFrontierBundle(files, { platformKey = null } = {}) {
  if (!files || typeof files !== "object") throw new BundleVerifyError("files map is required");
  const findings = [];
  const fail = (message) => findings.push(message);

  if (!(BUNDLE_FILES.manifest in files)) throw new BundleVerifyError("bundle is missing manifest.json");
  if (!(BUNDLE_FILES.checksums in files)) throw new BundleVerifyError("bundle is missing checksums.txt");
  const manifest = parseManifest(parseJson(files, BUNDLE_FILES.manifest));

  // Manifest hashes and sizes must match actual file bytes.
  const manifestPaths = new Set();
  for (const entry of manifest.files) {
    manifestPaths.add(entry.path);
    const content = files[entry.path];
    if (content === undefined) {
      fail(`manifest file missing from bundle: ${entry.path}`);
      continue;
    }
    const bytes = toBytes(content);
    if (bytes.length !== entry.sizeBytes) fail(`size mismatch for ${entry.path}: expected ${entry.sizeBytes}, got ${bytes.length}`);
    if (sha256Hex(bytes) !== entry.sha256) fail(`sha256 mismatch for ${entry.path}`);
    const role = roleForPath(entry.path);
    if (role !== entry.role) fail(`role mismatch for ${entry.path}: expected ${role}, got ${entry.role}`);
  }

  // checksums.txt must agree with every file present.
  const checksums = parseChecksums(files[BUNDLE_FILES.checksums]);
  for (const [path, content] of Object.entries(files)) {
    if (path === BUNDLE_FILES.checksums) continue;
    const expected = checksums.get(path);
    if (expected === undefined) {
      fail(`file not listed in checksums.txt: ${path}`);
    } else if (sha256Hex(toBytes(content)) !== expected) {
      fail(`checksum mismatch for ${path}`);
    }
  }
  for (const path of checksums.keys()) {
    if (!(path in files)) fail(`checksums.txt lists missing file: ${path}`);
  }

  // Cross-document consistency.
  const frontier = parseJson(files, BUNDLE_FILES.frontier);
  const memberRefs = new Set((frontier.members ?? []).map((member) => `${member.claimId}@${member.claimRevision}`));
  for (const entry of manifest.files) {
    if (entry.role !== "claim") continue;
    if (files[entry.path] === undefined) continue; // already reported as missing above
    const claimFile = parseJson(files, entry.path);
    const member = claimFile.member;
    if (!memberRefs.has(`${member?.claimId}@${member?.claimRevision}`)) fail(`claim file not referenced by frontier: ${entry.path}`);
    if (claimFile.claimRevision?.claimId !== member?.claimId) fail(`claim revision does not match member in ${entry.path}`);
    if (claimFile.claimRevision?.revision !== member?.claimRevision) fail(`claim revision number does not match member in ${entry.path}`);
  }
  if (frontier.snapshot?.snapshotId !== manifest.frontierSnapshotId) fail("frontier snapshot id does not match manifest");
  if (frontier.snapshot?.sequence !== manifest.sequence) fail("frontier sequence does not match manifest");

  // Checkpoints and proofs must bind to each other.
  const checkpoints = new Map();
  for (const entry of manifest.files) {
    if (entry.role !== "checkpoint") continue;
    if (files[entry.path] === undefined) continue; // already reported as missing above
    const { checkpoint, otsProof } = parseJson(files, entry.path);
    if (!checkpoint?.checkpointId || typeof checkpoint.rootHash !== "string") {
      fail(`invalid checkpoint document: ${entry.path}`);
      continue;
    }
    if (platformKey) {
      const ok = verifyMerkleCheckpoint({ checkpoint, publicKey: platformKey });
      if (ok !== true) fail(`checkpoint signature did not verify: ${checkpoint.checkpointId}`);
    }
    checkpoints.set(checkpoint.checkpointId, checkpoint);
    if (otsProof && typeof otsProof.rootHash === "string" && otsProof.rootHash !== checkpoint.rootHash) {
      fail(`OTS proof root does not match checkpoint ${checkpoint.checkpointId}`);
    }
  }
  for (const entry of manifest.files) {
    if (entry.role !== "proof") continue;
    if (files[entry.path] === undefined) continue; // already reported as missing above
    const proofDoc = parseJson(files, entry.path);
    if (!verifyMerkleInclusionProof(proofDoc.proof)) {
      fail(`inclusion proof does not reconstruct its root: ${entry.path}`);
      continue;
    }
    const checkpoint = checkpoints.get(proofDoc.checkpointId);
    if (!checkpoint) fail(`proof references missing checkpoint: ${proofDoc.checkpointId}`);
    else if (proofDoc.proof.root !== checkpoint.rootHash) fail(`proof root not covered by checkpoint ${proofDoc.checkpointId}`);
  }

  return Object.freeze({ valid: findings.length === 0, manifest, findings });
}
