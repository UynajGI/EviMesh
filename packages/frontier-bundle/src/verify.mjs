import { parseManifest, sha256Hex } from "./manifest.mjs";
import { parseChecksums } from "./checksums.mjs";
import { BUNDLE_FILES, claimFilePath, roleForPath } from "./spec.mjs";
import { verifyMerkleInclusionProof } from "../../merkle/src/verify-inclusion-proof.mjs";
import { verifyMerkleCheckpoint } from "../../signatures/src/merkle-checkpoint.mjs";
import { hashResearchEventLeaf } from "../../merkle/src/research-event-leaf.mjs";

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

function toText(content) {
  return typeof content === "string" ? content : new TextDecoder().decode(content);
}

function parseJson(files, path) {
  try {
    return JSON.parse(toText(files[path]));
  } catch (error) {
    throw new BundleVerifyError(`bundle file ${path} is not valid JSON: ${error.message}`);
  }
}

function formalEvent(event) {
  if (event && event.schema === "srp.event.v1") return event;
  return {
    schema: "srp.event.v1",
    event_id: event.eventId ?? event.event_id,
    event_type: event.eventType ?? event.event_type,
    payload: event.payload,
    hash: event.hash,
    signature: event.signature,
    parents: event.parents ?? [],
  };
}

function parseEventsNdjson(files) {
  const events = new Map();
  const raw = files[BUNDLE_FILES.events];
  if (raw === undefined) return events;
  for (const line of toText(raw).split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    const event = JSON.parse(trimmed);
    const eventId = event.eventId ?? event.event_id;
    if (typeof eventId === "string") events.set(eventId, event);
  }
  return events;
}

/**
 * Offline-verify a frontier bundle (M12-12). Works without network access.
 * `files` maps bundle-relative paths to string or Uint8Array contents (e.g.
 * the direct output of `readZip`). Options: `platformKey` verifies checkpoint
 * signatures; each inclusion proof is additionally bound to the exported
 * event whose leaf it claims.
 */
export async function verifyFrontierBundle(files, { platformKey = null } = {}) {
  if (!files || typeof files !== "object") throw new BundleVerifyError("files map is required");
  const findings = [];
  const fail = (message) => findings.push(message);

  if (!(BUNDLE_FILES.manifest in files)) throw new BundleVerifyError("bundle is missing manifest.json");
  if (!(BUNDLE_FILES.checksums in files)) throw new BundleVerifyError("bundle is missing checksums.txt");
  const manifest = parseManifest(parseJson(files, BUNDLE_FILES.manifest));

  // Manifest hashes and sizes must match actual file bytes.
  for (const entry of manifest.files) {
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

  // Every file present must appear in BOTH the manifest and checksums.txt, so
  // an attacker cannot add an unmanifested file and pass by regenerating only
  // checksums.txt.
  const manifestPathSet = new Set(manifest.files.map((entry) => entry.path));
  const checksums = parseChecksums(toText(files[BUNDLE_FILES.checksums]));
  for (const [path, content] of Object.entries(files)) {
    if (path === BUNDLE_FILES.checksums || path === BUNDLE_FILES.manifest) continue;
    if (!manifestPathSet.has(path)) {
      fail(`file not listed in manifest.json: ${path}`);
    }
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

  // Cross-document consistency: claim files reference frontier members AND
  // every frontier member has a claim document.
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
  for (const member of frontier.members ?? []) {
    const path = claimFilePath(member.claimId);
    if (!(path in files)) fail(`frontier member has no claim document: ${member.claimId}@${member.claimRevision}`);
  }
  if (frontier.snapshot?.snapshotId !== manifest.frontierSnapshotId) fail("frontier snapshot id does not match manifest");
  if (frontier.snapshot?.sequence !== manifest.sequence) fail("frontier sequence does not match manifest");

  // Exported events, keyed by id, for binding inclusion proofs.
  let events = new Map();
  try {
    events = parseEventsNdjson(files);
  } catch (error) {
    fail(`events.ndjson is not valid NDJSON: ${error.message}`);
  }

  // Checkpoints and proofs must bind to each other and to the exported events.
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
      const ok = await verifyMerkleCheckpoint({ checkpoint, publicKey: platformKey });
      if (ok !== true) fail(`checkpoint signature did not verify: ${checkpoint.checkpointId}`);
    }
    checkpoints.set(checkpoint.checkpointId, checkpoint);
    if (otsProof && typeof otsProof.rootHash === "string" && otsProof.rootHash !== checkpoint.rootHash) {
      fail(`OTS proof root does not match checkpoint ${checkpoint.checkpointId}`);
    }
  }
  const coveredEventIds = new Set();
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
    // Bind the proof leaf to the exported event it claims.
    const event = events.get(proofDoc.eventId);
    if (!event) {
      fail(`proof references event missing from events.ndjson: ${proofDoc.eventId}`);
    } else {
      let leafHash = null;
      try {
        leafHash = hashResearchEventLeaf(formalEvent(event));
      } catch (error) {
        fail(`event ${proofDoc.eventId} cannot form a Merkle leaf: ${error.message}`);
      }
      if (leafHash !== null && leafHash !== proofDoc.proof.leafHash) {
        fail(`proof leaf does not match exported event: ${proofDoc.eventId}`);
      } else if (leafHash !== null) {
        coveredEventIds.add(proofDoc.eventId);
      }
    }
  }

  // Every exported event must be covered by a checkpoint-backed inclusion
  // proof; a producer that drops a proof cannot pass by regenerating the
  // manifest and checksums.
  for (const eventId of events.keys()) {
    if (!coveredEventIds.has(eventId)) {
      fail(`exported event has no inclusion proof: ${eventId}`);
    }
  }

  return Object.freeze({ valid: findings.length === 0, manifest, findings });
}
