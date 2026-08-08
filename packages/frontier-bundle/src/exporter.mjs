import { buildManifest, sha256Hex } from "./manifest.mjs";
import { generateChecksums } from "./checksums.mjs";
import { createZip } from "./zip.mjs";
import { buildReport } from "./report.mjs";
import {
  BUNDLE_FILES,
  checkpointFilePath,
  claimFilePath,
  evidenceFilePath,
  proofFilePath,
  receiptFilePath,
} from "./spec.mjs";
import { buildMerkleTree } from "../../merkle/src/merkle-tree.mjs";
import { hashResearchEventLeaf } from "../../merkle/src/research-event-leaf.mjs";
import { createMerkleInclusionProof } from "../../merkle/src/inclusion-proof.mjs";

export class BundleExportError extends Error {
  constructor(message, code = "BUNDLE_EXPORT_INVALID") {
    super(message);
    this.name = "BundleExportError";
    this.code = code;
  }
}

function requireMethod(repository, method) {
  if (!repository || typeof repository[method] !== "function") {
    throw new BundleExportError(`repository ${method} is required`);
  }
}

function jsonFile(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function toBytes(content) {
  return typeof content === "string" ? new TextEncoder().encode(content) : content;
}

/** Normalize a stored event to the formal leaf shape (mirrors research-event-proof). */
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

function eventIdOf(event) {
  return event?.eventId ?? event?.event_id;
}

/** Build one Merkle inclusion proof for an event inside its checkpoint range. */
async function buildEventProof({ repository, checkpoint, event }) {
  const events = await repository.listResearchEventRange({ firstEventId: checkpoint.firstEventId, lastEventId: checkpoint.lastEventId });
  if (!Array.isArray(events) || events.length === 0) return null;
  const leafHashes = events.map((candidate) => hashResearchEventLeaf(formalEvent(candidate)));
  const leafIndex = events.findIndex((candidate) => eventIdOf(candidate) === eventIdOf(event));
  if (leafIndex < 0) return null;
  const proof = createMerkleInclusionProof({ leafHashes, leafIndex });
  if (proof.root !== checkpoint.rootHash) return null;
  return { eventId: eventIdOf(event), checkpointId: checkpoint.checkpointId, proof };
}

/**
 * Export one published Frontier as a verifiable bundle (M12-03..M12-11).
 * Returns `{ files, manifest, report }`; with `zip: true` also `zip` bytes.
 */
export async function exportFrontierBundle({ repository, snapshotId, zip = false, createdAt = new Date().toISOString() } = {}) {
  requireMethod(repository, "getFrontierSnapshot");
  requireMethod(repository, "listFrontierMembers");
  requireMethod(repository, "getClaimRevision");
  requireMethod(repository, "listEvidenceForClaimRevision");
  requireMethod(repository, "getEvidence");
  requireMethod(repository, "getArtifactRevision");
  requireMethod(repository, "listVerificationReceipts");
  requireMethod(repository, "getVerificationReceipt");
  requireMethod(repository, "listVerificationFindings");
  requireMethod(repository, "listContributionEdgesForObject");
  requireMethod(repository, "listContributionStatementsByIds");
  requireMethod(repository, "listResearchEvents");

  const snapshot = await repository.getFrontierSnapshot(snapshotId);
  if (!snapshot) throw new BundleExportError("frontier snapshot not found", "FRONTIER_SNAPSHOT_NOT_FOUND");
  const members = await repository.listFrontierMembers(snapshotId);
  if (!Array.isArray(members) || members.length === 0) throw new BundleExportError("frontier snapshot has no members", "FRONTIER_EMPTY");

  const files = {};

  // M12-03: fixed Claim revisions for every member.
  const claimRevisions = [];
  for (const member of members) {
    const revision = await repository.getClaimRevision(member.claimId, member.claimRevision);
    if (!revision) throw new BundleExportError(`claim revision not found: ${member.claimId}@${member.claimRevision}`, "CLAIM_REVISION_NOT_FOUND");
    files[claimFilePath(member.claimId)] = jsonFile({ member, claimRevision: revision });
    claimRevisions.push({ member, revision });
  }

  // M12-04: referenced Evidence and their artifact digests.
  const evidenceEntries = [];
  const artifactRefs = [];
  const seenEvidence = new Set();
  for (const { member } of claimRevisions) {
    const evidenceRows = (await repository.listEvidenceForClaimRevision(member.claimId, member.claimRevision)) ?? [];
    for (const row of evidenceRows) {
      if (seenEvidence.has(row.evidenceId)) continue;
      seenEvidence.add(row.evidenceId);
      const evidence = await repository.getEvidence(row.evidenceId);
      if (!evidence) throw new BundleExportError(`evidence not found: ${row.evidenceId}`, "EVIDENCE_NOT_FOUND");
      files[evidenceFilePath(row.evidenceId)] = jsonFile({ evidence, claimId: member.claimId, claimRevision: member.claimRevision });
      evidenceEntries.push({ evidenceId: row.evidenceId, claimId: member.claimId });
      if (evidence.artifactId && Number.isInteger(evidence.artifactRevision)) {
        const artifactRevision = await repository.getArtifactRevision(evidence.artifactId, evidence.artifactRevision);
        if (!artifactRevision) throw new BundleExportError(`artifact revision not found: ${evidence.artifactId}@${evidence.artifactRevision}`, "ARTIFACT_REVISION_NOT_FOUND");
        artifactRefs.push({ artifactId: evidence.artifactId, revision: evidence.artifactRevision, rawHash: artifactRevision.rawHash, sizeBytes: artifactRevision.sizeBytes ?? 0, mediaType: artifactRevision.mediaType ?? null, role: "evidence" });
      }
    }
  }

  // M12-05: VerificationReceipts the frontier depends on.
  const receiptEntries = [];
  const seenReceipts = new Set();
  for (const { member } of claimRevisions) {
    const receipts = (await repository.listVerificationReceipts({ claimId: member.claimId })) ?? [];
    for (const receipt of receipts) {
      if (receipt.claimRevision !== member.claimRevision || seenReceipts.has(receipt.receiptId)) continue;
      seenReceipts.add(receipt.receiptId);
      const fullReceipt = await repository.getVerificationReceipt(receipt.receiptId);
      const findings = (await repository.listVerificationFindings(receipt.receiptId)) ?? [];
      files[receiptFilePath(receipt.receiptId)] = jsonFile({ receipt: fullReceipt ?? receipt, findings });
      receiptEntries.push({ receiptId: receipt.receiptId, claimId: member.claimId, outcome: receipt.outcome ?? null });
    }
  }

  // M12-06: contribution graph for exported objects.
  const edges = [];
  const statementIds = new Set();
  const contributionObjects = [
    ...claimRevisions.map(({ member }) => ({ objectType: "claim", objectId: member.claimId })),
    ...evidenceEntries.map(({ evidenceId }) => ({ objectType: "evidence", objectId: evidenceId })),
    ...receiptEntries.map(({ receiptId }) => ({ objectType: "verification", objectId: receiptId })),
  ];
  if (typeof repository.listContributionEdgesForObject === "function") {
    for (const { objectType, objectId } of contributionObjects) {
      const objectEdges = (await repository.listContributionEdgesForObject(objectType, objectId)) ?? [];
      for (const edge of objectEdges) {
        edges.push(edge);
        if (edge.statementId) statementIds.add(edge.statementId);
      }
    }
  }
  const statements = statementIds.size > 0 ? (await repository.listContributionStatementsByIds([...statementIds])) ?? [] : [];
  files[BUNDLE_FILES.contributions] = jsonFile({ statements, edges });

  // M12-07: research events for exported claims as NDJSON.
  const eventsById = new Map();
  for (const { member } of claimRevisions) {
    const events = (await repository.listResearchEvents({ objectId: member.claimId })) ?? [];
    for (const event of events) eventsById.set(eventIdOf(event), event);
  }
  const events = [...eventsById.values()].sort((a, b) => String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")) || String(eventIdOf(a)).localeCompare(String(eventIdOf(b))));
  files[BUNDLE_FILES.events] = events.length > 0 ? `${events.map((event) => JSON.stringify(event)).join("\n")}\n` : "";

  // M12-08: Merkle checkpoints and inclusion proofs for exported events.
  const checkpointsById = new Map();
  if (typeof repository.getMerkleCheckpointForEvent === "function") {
    for (const event of events) {
      const checkpoint = await repository.getMerkleCheckpointForEvent(eventIdOf(event));
      if (!checkpoint) continue;
      if (!checkpointsById.has(checkpoint.checkpointId)) {
        const otsProof = typeof repository.getOtsProof === "function" ? await repository.getOtsProof(checkpoint.checkpointId) : null;
        checkpointsById.set(checkpoint.checkpointId, { checkpoint, otsProof: otsProof ?? null });
        files[checkpointFilePath(checkpoint.checkpointId)] = jsonFile({ checkpoint, otsProof: otsProof ?? null });
      }
      const proof = await buildEventProof({ repository, checkpoint, event });
      if (proof) files[proofFilePath(eventIdOf(event))] = jsonFile(proof);
    }
  }

  files[BUNDLE_FILES.artifactsManifest] = jsonFile({ artifacts: artifactRefs });
  files[BUNDLE_FILES.frontier] = jsonFile({ snapshot, members });

  const report = buildReport({ snapshot, members, claimRevisions, evidenceEntries, receiptEntries, checkpoints: checkpointsById.size });
  files[BUNDLE_FILES.report] = report;

  const manifestEntries = Object.entries(files).map(([path, content]) => {
    const bytes = toBytes(content);
    return { path, sha256: sha256Hex(bytes), sizeBytes: bytes.length };
  });
  const manifest = buildManifest({ projectId: snapshot.projectId, frontierSnapshotId: snapshot.snapshotId, sequence: snapshot.sequence, files: manifestEntries, createdAt });
  files[BUNDLE_FILES.manifest] = jsonFile(manifest);
  files[BUNDLE_FILES.checksums] = generateChecksums(files);

  const result = { files, manifest, report };
  if (zip) result.zip = createZip(Object.fromEntries(Object.entries(files).map(([path, content]) => [path, toBytes(content)])));
  return result;
}
